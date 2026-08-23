-- 0003_entity_status_teams.sql — Sprint 1, etapa 6
--
-- Enum entity_status, as DUAS funções de enforcement de inativação, e a tabela
-- teams com sua RLS. Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- O que NÃO entra aqui, de propósito:
--   - `source_ref` e seu índice único parcial  → migration 0007
--   - `inactivated_at/by/reason` e a trilha    → migration 0008
--   - a FK de current_manager_id               → migration 0005, com managers
-- MODELO_DADOS.md §2.4 mostra a forma final da tabela; esta migration mostra o
-- estado dela nesta etapa.

-- ---------------------------------------------------------------------------
-- 1. Enum de status de entidade
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'entity_status') then
    create type public.entity_status as enum ('ativo', 'inativo');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Enforcement de inativação — DUAS funções, não uma (D-022)
--
-- Copiar uma função de "só administrador inativa" para todas as entidades
-- deixaria o gestor dependente do administrador para operação corriqueira, e
-- transformaria o banco num cemitério de registros "inativos" que na verdade só
-- foram concluídos.
--
-- Por que trigger e não policy: a policy de UPDATE não enxerga o valor ANTIGO
-- da linha, então não consegue distinguir "está virando inativo agora" de "já
-- era inativo". A transição só é observável em trigger, comparando old e new.
--
-- `is distinct from` e não `<>`: com nulo de um dos lados, `<>` devolve nulo, a
-- condição não dispara e a barreira falha em silêncio.
--
-- auth.uid() nulo (SQL Editor, service role, manutenção) não é bloqueado.
-- ---------------------------------------------------------------------------

-- Cadastro mestre: directors, managers, teams, sellers, companies e afins.
create or replace function public.enforce_inactivation_is_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.status = 'inativo'
     and old.status is distinct from 'inativo'
     and not public.is_admin() then
    raise exception 'Apenas administrador pode inativar este registro.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Catálogo e instrumentos de gestão comercial: commercial_products,
-- crm_loss_reasons, crm_portfolios (RLS_PERMISSOES §5.7).
--
-- CRIADA AQUI E AINDA SEM USO. Nenhuma tabela desta sprint a aplica — as três
-- que a usam nascem nas Sprints 3 e 4. Está nesta migration porque a ordem
-- autorizada da sprint a coloca aqui, junto da irmã: as duas formam a matriz de
-- D-022, e separá-las convidaria a aplicar a de administrador onde cabe a de
-- gestor, que é exatamente o erro que D-022 existe para evitar.
create or replace function public.enforce_inactivation_is_manager_or_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.status = 'inativo'
     and old.status is distinct from 'inativo'
     and not public.has_role('administrador', 'gestor_adm') then
    raise exception 'Apenas gestor ou administrador pode inativar este registro.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tabela teams
--
-- `current_manager_id` nasce SEM FK: managers ainda não existe. A FK circular
-- teams -> managers é fechada na 0005, por bloco DO sobre pg_constraint.
--
-- `conta_na_meta` não tem uso na V1 — não há cálculo de meta. Vem junto porque
-- reconstruir a classificação depois exigiria revisitar equipe por equipe
-- (MODELO_DADOS §2.4).
--
-- `valid_from`/`valid_to` são vigência: encerramento OPERACIONAL, em que o
-- histórico continua contando. Não confundir com `status = 'inativo'`, que é
-- erro cadastral e tira a linha de tudo (D-022).
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text,
  current_manager_id uuid,
  conta_na_meta      boolean not null default true,
  status             public.entity_status not null default 'ativo',
  valid_from         date,
  valid_to           date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id) default auth.uid(),
  updated_by         uuid references public.profiles (id)
);

create index if not exists teams_status_idx on public.teams (status);
create index if not exists teams_current_manager_idx
  on public.teams (current_manager_id);

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

drop trigger if exists teams_enforce_inactivation on public.teams;
create trigger teams_enforce_inactivation
  before update on public.teams
  for each row execute function public.enforce_inactivation_is_admin();

-- ===========================================================================
-- 4. RLS — espelho de supabase/policies/teams.sql
--
-- Matriz §3, módulo `estrutura_comercial`: leitura para todos os papéis;
-- escrita para gestor e administrador; inativação só administrador.
--
-- A leitura ampla é deliberada (RLS_PERMISSOES §5.1): são nomes de colegas de
-- trabalho, necessários para preencher selects de atribuição. O dado sensível
-- não está aqui.
--
-- `auth_role() is not null` e não `true`: exige um perfil existente, não apenas
-- um JWT válido. Usuário sem linha em profiles não lê nada.
-- ===========================================================================
alter table public.teams enable row level security;

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select
  using (public.auth_role() is not null);

drop policy if exists teams_insert on public.teams;
create policy teams_insert on public.teams
  for insert
  with check (public.has_role('administrador', 'gestor_adm'));

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams
  for update
  using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- DELETE: nenhuma policy. Saída de circulação é status = 'inativo', e quem
-- inativa é o administrador, pelo trigger acima.
