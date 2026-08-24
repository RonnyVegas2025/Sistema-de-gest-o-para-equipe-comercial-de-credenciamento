-- Espelho das policies de public.managers.
--
-- NÃO é aplicado por si só — vão ao banco pela migration 0005_managers.sql.
-- A sincronia é manual.
--
-- Fonte: RLS_PERMISSOES.md §3 (módulo `estrutura_comercial`) e §5.1.

alter table public.managers enable row level security;

create policy managers_select on public.managers
  for select
  using (public.auth_role() is not null);

create policy managers_insert on public.managers
  for insert
  with check (public.has_role('administrador', 'gestor_adm'));

create policy managers_update on public.managers
  for update
  using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- DELETE — nenhuma policy. Inativação pelo trigger
-- managers_enforce_inactivation, que usa enforce_inactivation_is_admin().
--
-- Nota de escopo, para a 0009: a leitura aqui é ampla, e é isso mesmo — são
-- nomes de colegas, necessários para selects de atribuição. O recorte por
-- escopo NÃO vive nesta tabela; vive nas tabelas de carteira e oportunidade,
-- via scoped_seller_ids(). Ler o nome de um gestor não é ver a carteira dele.
