-- 0005_managers.sql — Sprint 1, etapa 6
--
-- Tabela managers, sua RLS, e o fechamento da FK circular teams -> managers.
-- Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- O que NÃO entra aqui, de propósito:
--   - `source_ref` e seu índice único parcial  → migration 0007
--   - `inactivated_at/by/reason` e a trilha    → migration 0008
--   - `current_manager_id()` e o escopo        → migration 0009
--
-- ---------------------------------------------------------------------------
-- SEM `managers.team_id` (D-017).
--
-- A coluna existe no sistema de origem e é vestigial: nenhuma regra a lê — nem
-- painel, nem importação — e existia só para se auto-exibir. Exibia errado,
-- mostrando uma equipe de "pertencimento" que escondia as várias que o gestor de
-- fato gerencia. Foi ocultada lá, não removida.
--
-- No CRM o vínculo de gerência é `teams.current_manager_id`, e é UM PARA MUITOS:
-- um gestor gerencia várias equipes. Uma coluna `team_id` aqui divergiria no dia
-- em que a segunda equipe aparecesse.
-- ---------------------------------------------------------------------------
create table if not exists public.managers (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  role_title  text,
  mobile      text,
  phone       text,
  director_id uuid references public.directors (id),
  profile_id  uuid references public.profiles (id),
  status      public.entity_status not null default 'ativo',
  active_from date,
  active_to   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid(),
  updated_by  uuid references public.profiles (id)
);

-- `managers_profile_idx` e `managers_director_idx` sustentam a resolução de
-- escopo da 0009: current_manager_id() casa por profile_id = auth.uid(), e o
-- caminho do diretor percorre managers.director_id (RLS_PERMISSOES §4.3).
create index if not exists managers_status_idx on public.managers (status);
create index if not exists managers_director_idx on public.managers (director_id);
create index if not exists managers_profile_idx on public.managers (profile_id);

drop trigger if exists managers_set_updated_at on public.managers;
create trigger managers_set_updated_at
  before update on public.managers
  for each row execute function public.set_updated_at();

drop trigger if exists managers_enforce_inactivation on public.managers;
create trigger managers_enforce_inactivation
  before update on public.managers
  for each row execute function public.enforce_inactivation_is_admin();

-- ---------------------------------------------------------------------------
-- Fechamento da FK circular teams.current_manager_id -> managers(id)
--
-- `teams` nasceu na 0003 com a coluna sem FK, porque `managers` não existia.
-- Agora existe, e a constraint é adicionada.
--
-- `alter table add constraint` guardado por bloco DO sobre pg_constraint
-- (CLAUDE.md): `add constraint` não aceita `if not exists`, então reaplicar a
-- migration sem a guarda levantaria erro de objeto duplicado e a idempotência
-- se perderia.
--
-- Sem ação de delete, como nas demais FKs desta sprint: apagar um gestor que
-- ainda é o gestor atual de alguma equipe é bloqueado, em vez de deixar a
-- equipe apontando para o vazio em silêncio. Saída de circulação é
-- `status = 'inativo'`, não DELETE.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'teams_current_manager_id_fkey'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_current_manager_id_fkey
      foreign key (current_manager_id) references public.managers (id);
  end if;
end
$$;

-- ===========================================================================
-- RLS — espelho de supabase/policies/managers.sql
--
-- Matriz §3, módulo `estrutura_comercial`, e §5.1: leitura ampla entre
-- autenticados; escrita por gestor e administrador; inativação só administrador,
-- pelo trigger acima.
-- ===========================================================================
alter table public.managers enable row level security;

drop policy if exists managers_select on public.managers;
create policy managers_select on public.managers
  for select
  using (public.auth_role() is not null);

drop policy if exists managers_insert on public.managers;
create policy managers_insert on public.managers
  for insert
  with check (public.has_role('administrador', 'gestor_adm'));

drop policy if exists managers_update on public.managers;
create policy managers_update on public.managers
  for update
  using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- DELETE: nenhuma policy. Saída de circulação é status = 'inativo'.
