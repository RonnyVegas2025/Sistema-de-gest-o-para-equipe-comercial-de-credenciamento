-- Espelho das policies de public.teams.
--
-- NÃO é aplicado por si só — as policies vão ao banco pela migration que as
-- cria (0003_entity_status_teams.sql). Este arquivo existe para o estado das
-- policies ser legível por domínio. A sincronia é manual.
--
-- Fonte: RLS_PERMISSOES.md §3 (módulo `estrutura_comercial`) e §5.1.
--
-- Matriz: leitura para todos os papéis · escrita para gestor e administrador ·
-- inativação só administrador.

alter table public.teams enable row level security;

-- SELECT — leitura ampla entre autenticados, deliberada (§5.1): são nomes de
-- colegas de trabalho, necessários para preencher selects de atribuição. O dado
-- sensível não está aqui.
--
-- `auth_role() is not null` e não `true`: exige perfil existente, não apenas
-- JWT válido. Usuário autenticado sem linha em profiles não lê nada.
create policy teams_select on public.teams
  for select
  using (public.auth_role() is not null);

create policy teams_insert on public.teams
  for insert
  with check (public.has_role('administrador', 'gestor_adm'));

create policy teams_update on public.teams
  for update
  using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- DELETE — nenhuma policy.
--
-- A inativação NÃO é feita por policy, e sim pelo trigger
-- teams_enforce_inactivation, que usa enforce_inactivation_is_admin(). O motivo
-- é que a policy de UPDATE não enxerga o valor antigo da linha: ela não
-- distingue "está virando inativo agora" de "já era inativo". Só o trigger vê a
-- transição.
--
-- Não confundir com encerramento operacional: `valid_to` é vigência, o gestor
-- preenche, e o histórico continua contando (D-022). `status = 'inativo'` é
-- erro cadastral e tira a linha de tudo.
