-- Espelho das policies de public.companies.
--
-- NÃO é aplicado por si só — vão ao banco pela migration 0012_companies.sql.
-- A sincronia é manual.
--
-- Fonte: RLS_PERMISSOES.md §5.2 e §5.8; D-006, D-016, D-024.

alter table public.companies enable row level security;

-- ---------------------------------------------------------------------------
-- SELECT — leitura ampla entre autenticados, e ela é DELIBERADA.
--
-- Não é repetição do DE-025 do sistema de origem, onde uma leitura ampla
-- "provisória" seguiu aberta três sprints. Aqui a amplitude é o requisito:
--
--   O consultor não é dono do CNPJ (D-006). A busca por estabelecimento
--   existente precisa ENCONTRÁ-LO mesmo fora do escopo — senão o índice único
--   parcial de CNPJ vira erro de duplicidade sem explicação, que é exatamente
--   o que D-006 e D-016 existem para evitar.
--
-- O recorte protege o RELACIONAMENTO (crm_company_relationships, 0013), não a
-- IDENTIDADE. Fechar esta policy não protegeria dado nenhum — quebraria a busca
-- e devolveria o cadastro duplicado.
--
-- E leitura ampla não é exibição ampla (D-024): a RLS diz se a linha é legível,
-- a aplicação diz quanto exibir. É o que sustenta D-016 — o consultor fora do
-- escopo sabe que o estabelecimento existe e que está atribuído, sem receber o
-- nome do colega responsável.
-- ---------------------------------------------------------------------------
create policy companies_select on public.companies
  for select
  using (public.auth_role() is not null);

-- ---------------------------------------------------------------------------
-- INSERT / UPDATE — os quatro papéis operacionais.
--
-- `comercial` cadastra: é o consultor em campo que encontra o estabelecimento.
-- `analista_adm` cadastra por apoio administrativo. `financeiro` e `auditoria`
-- ficam de fora — consultam, não mantêm cadastro.
-- ---------------------------------------------------------------------------
create policy companies_insert on public.companies
  for insert
  with check (public.has_role(
    'administrador', 'gestor_adm', 'analista_adm', 'comercial'));

create policy companies_update on public.companies
  for update
  using (public.has_role(
    'administrador', 'gestor_adm', 'analista_adm', 'comercial'))
  with check (public.has_role(
    'administrador', 'gestor_adm', 'analista_adm', 'comercial'));

-- ---------------------------------------------------------------------------
-- DELETE — nenhuma policy.
--
-- Estabelecimento sai de circulação por `status = 'inativo'`, que é correção de
-- cadastro incorreto, restrita a administrador e com trilha (D-022). Encerrar o
-- RELACIONAMENTO comercial é outra operação, vive em
-- `crm_company_relationships.ended_at` (0013) e preserva o histórico.
--
-- A RLS filtra, não levanta: um DELETE sem policy devolve `DELETE 0`, sem erro.
-- ---------------------------------------------------------------------------
