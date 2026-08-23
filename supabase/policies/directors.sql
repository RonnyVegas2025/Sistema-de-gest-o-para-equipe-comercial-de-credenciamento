-- Espelho das policies de public.directors.
--
-- NÃO é aplicado por si só — as policies vão ao banco pela migration que as
-- cria (0004_directors.sql). A sincronia é manual.
--
-- Fonte: RLS_PERMISSOES.md §3 (módulo `estrutura_comercial`) e §5.1.
-- Leitura ampla entre autenticados · escrita gestor e administrador ·
-- inativação só administrador, por trigger.

alter table public.directors enable row level security;

create policy directors_select on public.directors
  for select
  using (public.auth_role() is not null);

create policy directors_insert on public.directors
  for insert
  with check (public.has_role('administrador', 'gestor_adm'));

create policy directors_update on public.directors
  for update
  using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- DELETE — nenhuma policy.
--
-- Não há policy de inativação: a transição para 'inativo' é barrada pelo
-- trigger directors_enforce_inactivation, porque a policy de UPDATE não enxerga
-- o valor antigo e não distingue a transição do estado.
