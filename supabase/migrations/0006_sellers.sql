-- 0006_sellers.sql — Sprint 1, etapa 6
--
-- Tabela sellers e sua RLS. Fecha a estrutura comercial da sprint. Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- O que NÃO entra aqui, de propósito:
--   - `source_ref` e seu índice único parcial  → migration 0007
--   - `inactivated_at/by/reason` e a trilha    → migration 0008
--   - `current_seller_id()`, `scoped_seller_ids()` e o recorte → migration 0009
--
-- ---------------------------------------------------------------------------
-- SEM `sellers.manager_id`.
--
-- O gestor do vendedor é SEMPRE o gestor atual da equipe:
--
--     seller.team_id  ->  team.current_manager_id  ->  manager
--
-- Uma coluna `manager_id` aqui seria a mesma armadilha de `managers.team_id`
-- (D-017): no dia em que a equipe trocar de gestor, `teams.current_manager_id`
-- passa a apontar para Maria e `sellers.manager_id` continua em João. Duas
-- fontes para o mesmo fato, divergindo em silêncio — e a divergência não produz
-- erro, só resposta errada.
--
-- A resolução de escopo da 0009 percorre o caminho pela equipe e não precisa da
-- coluna. A importação da 0007 deriva o gestor da equipe pelo mesmo motivo.
--
-- Se algum dia houver necessidade funcional de gestor independente da equipe, a
-- coluna volta documentada como snapshot ou vínculo independente — nunca como
-- espelho do que a equipe já diz.
-- ---------------------------------------------------------------------------
create table if not exists public.sellers (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  phone       text,
  mobile      text,
  team_id     uuid references public.teams (id),
  profile_id  uuid references public.profiles (id),
  status      public.entity_status not null default 'ativo',
  joined_at   date,
  left_at     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid(),
  updated_by  uuid references public.profiles (id)
);

-- Os três sustentam `scoped_seller_ids()` na 0009 (RLS_PERMISSOES §4.3):
-- `sellers_team_idx` é percorrido pelo caminho do gestor e do diretor;
-- `sellers_profile_idx`, por `current_seller_id()`. Sem eles, a função vira
-- varredura por linha avaliada em toda policy com recorte.
create index if not exists sellers_status_idx on public.sellers (status);
create index if not exists sellers_team_idx on public.sellers (team_id);
create index if not exists sellers_profile_idx on public.sellers (profile_id);

drop trigger if exists sellers_set_updated_at on public.sellers;
create trigger sellers_set_updated_at
  before update on public.sellers
  for each row execute function public.set_updated_at();

drop trigger if exists sellers_enforce_inactivation on public.sellers;
create trigger sellers_enforce_inactivation
  before update on public.sellers
  for each row execute function public.enforce_inactivation_is_admin();

-- ===========================================================================
-- RLS — espelho de supabase/policies/sellers.sql
--
-- Matriz §3, módulo `estrutura_comercial`, e §5.1: leitura ampla entre
-- autenticados; escrita por gestor e administrador; inativação só administrador.
--
-- ATENÇÃO ao que esta leitura ampla NÃO é. Ler o NOME de um consultor não é ver
-- a CARTEIRA dele. O recorte por escopo (D-018) vive nas tabelas de
-- relacionamento, carteira, oportunidade e atividade, via `scoped_seller_ids()`
-- na 0009. Esta tabela é cadastro de pessoas, necessária para preencher selects
-- de atribuição — e é por isso que o consultor a lê inteira.
-- ===========================================================================
alter table public.sellers enable row level security;

drop policy if exists sellers_select on public.sellers;
create policy sellers_select on public.sellers
  for select
  using (public.auth_role() is not null);

drop policy if exists sellers_insert on public.sellers;
create policy sellers_insert on public.sellers
  for insert
  with check (public.has_role('administrador', 'gestor_adm'));

drop policy if exists sellers_update on public.sellers;
create policy sellers_update on public.sellers
  for update
  using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- DELETE: nenhuma policy. Saída de circulação é status = 'inativo'; saída da
-- operação é `left_at`, que é encerramento e preserva o histórico (D-022).
