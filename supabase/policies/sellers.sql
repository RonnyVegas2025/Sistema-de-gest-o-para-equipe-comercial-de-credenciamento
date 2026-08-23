-- Espelho das policies de public.sellers.
--
-- NÃO é aplicado por si só — vão ao banco pela migration 0006_sellers.sql.
-- A sincronia é manual.
--
-- Fonte: RLS_PERMISSOES.md §3 (módulo `estrutura_comercial`) e §5.1.

alter table public.sellers enable row level security;

-- SELECT — leitura ampla entre autenticados.
--
-- O QUE ISTO NÃO É: ler o NOME de um consultor não é ver a CARTEIRA dele. O
-- recorte por escopo (D-018) vive nas tabelas de relacionamento, carteira,
-- oportunidade e atividade, via scoped_seller_ids() na 0009. Esta tabela é
-- cadastro de pessoas, necessária para preencher selects de atribuição — por
-- isso o consultor a lê inteira.
--
-- Confundir as duas coisas levaria a fechar esta policy e quebrar a atribuição,
-- ou a deixar a de carteira aberta achando que "já está resolvido aqui".
create policy sellers_select on public.sellers
  for select
  using (public.auth_role() is not null);

create policy sellers_insert on public.sellers
  for insert
  with check (public.has_role('administrador', 'gestor_adm'));

create policy sellers_update on public.sellers
  for update
  using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- DELETE — nenhuma policy.
--
-- Duas saídas distintas, que não se confundem (D-022):
--   `left_at`            saída da operação — encerramento, histórico conta
--   `status = 'inativo'` erro cadastral — sai de tudo, só administrador
