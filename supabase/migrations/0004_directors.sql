-- 0004_directors.sql — Sprint 1, etapa 6
--
-- Tabela directors e sua RLS. Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- O que NÃO entra aqui, de propósito:
--   - `source_ref` e seu índice único parcial  → migration 0007
--   - `inactivated_at/by/reason` e a trilha    → migration 0008
--   - `current_director_id()` e o escopo       → migration 0009
--
-- Por que directors existe, se não há papel `diretor`: papel diz o que a pessoa
-- FAZ, hierarquia diz sobre QUAIS DADOS (D-005). Diretor é um `gestor_adm` cujo
-- vínculo aqui resolve o escopo para a diretoria inteira. Criar um sétimo papel
-- faria a matriz crescer a cada nível hierárquico.

-- ---------------------------------------------------------------------------
-- Tabela directors
--
-- `profile_id` é NULÁVEL (D-004): a pessoa da operação pode não ter conta de
-- acesso ao sistema. O cadastro comercial existe independentemente de login —
-- e o vínculo, quando existe, é o que `current_director_id()` vai usar na 0009
-- para resolver escopo.
--
-- `active_from`/`active_to` são período de atuação: encerramento OPERACIONAL,
-- em que o histórico continua contando. Não confundir com `status = 'inativo'`,
-- que é erro cadastral (D-022).
--
-- COMPORTAMENTO A CONFIRMAR — a FK de `profile_id` não declara ação de delete,
-- então vale NO ACTION. Consequência observada em teste: com um diretor
-- vinculado a um perfil, apagar aquele usuário no painel de Auth do Supabase é
-- BLOQUEADO, com erro de FK citando `directors`.
--
-- Mantido assim de propósito, por ora: o CRM não apaga usuário — saída de
-- circulação é `is_active = false` —, então o bloqueio recusa uma operação que
-- o sistema não sanciona, e falha alto em vez de desvincular em silêncio. A
-- alternativa seria `on delete set null`, que preserva o cadastro comercial e
-- descarta o vínculo.
--
-- Se a decisão mudar, é migration nova; esta não se edita (D-021). O mesmo vale
-- para `created_by`/`updated_by`.
-- ---------------------------------------------------------------------------
create table if not exists public.directors (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text,
  profile_id  uuid references public.profiles (id),
  status      public.entity_status not null default 'ativo',
  active_from date,
  active_to   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid(),
  updated_by  uuid references public.profiles (id)
);

-- `directors_profile_idx` não é conveniência: `current_director_id()` (0009)
-- resolve por `profile_id = auth.uid()` a cada avaliação de policy. Sem índice,
-- vira varredura por linha avaliada (RLS_PERMISSOES §4.3).
create index if not exists directors_status_idx on public.directors (status);
create index if not exists directors_profile_idx on public.directors (profile_id);

drop trigger if exists directors_set_updated_at on public.directors;
create trigger directors_set_updated_at
  before update on public.directors
  for each row execute function public.set_updated_at();

drop trigger if exists directors_enforce_inactivation on public.directors;
create trigger directors_enforce_inactivation
  before update on public.directors
  for each row execute function public.enforce_inactivation_is_admin();

-- ===========================================================================
-- RLS — espelho de supabase/policies/directors.sql
--
-- Matriz §3, módulo `estrutura_comercial`, e §5.1: leitura ampla entre
-- autenticados; escrita por gestor e administrador; inativação só administrador,
-- pelo trigger acima.
-- ===========================================================================
alter table public.directors enable row level security;

drop policy if exists directors_select on public.directors;
create policy directors_select on public.directors
  for select
  using (public.auth_role() is not null);

drop policy if exists directors_insert on public.directors;
create policy directors_insert on public.directors
  for insert
  with check (public.has_role('administrador', 'gestor_adm'));

drop policy if exists directors_update on public.directors;
create policy directors_update on public.directors
  for update
  using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- DELETE: nenhuma policy. Saída de circulação é status = 'inativo'.
