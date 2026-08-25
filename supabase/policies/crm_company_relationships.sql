-- Espelho das policies de public.crm_company_relationships.
--
-- NÃO é aplicado por si só — vão ao banco pela migration 0013_relacionamento.sql.
-- A sincronia é manual.
--
-- Fonte: RLS_PERMISSOES.md §5.3; D-014, D-018, D-022.

alter table public.crm_company_relationships enable row level security;

-- ---------------------------------------------------------------------------
-- É AQUI QUE D-018 FECHA.
--
-- A Sprint 1 entregou scoped_seller_ids() provada — gate de cinco usuários
-- 8/8 — mas sem nenhuma tabela onde prendê-la. A função estava provada; o
-- enforcement, não. Esta é a primeira tabela com recorte real.
--
-- AS TRÊS POLICIES PRECISAM DO PREDICADO, e o UPDATE é o menos óbvio: sem
-- recorte nele, o consultor reatribui para si um relacionamento fora do escopo,
-- e o SELECT recortado esconde a operação depois de feita. A leitura fica
-- correta enquanto a escrita não é.
--
-- O RAMO DE GESTÃO NÃO É CONVENIÊNCIA. Relacionamento importado e ainda não
-- distribuído tem responsible_seller_id nulo; sem `has_role`, o predicado o
-- esconderia de todos — inclusive de quem precisa distribuí-lo. Distribuir é
-- ação de gestão (§5.3), e dado que ninguém enxerga é dado que ninguém
-- corrige.
-- ---------------------------------------------------------------------------
create policy crm_company_rel_select on public.crm_company_relationships
  for select
  using (
    responsible_seller_id in (select public.scoped_seller_ids())
    or public.has_role('administrador', 'gestor_adm')
  );

create policy crm_company_rel_insert on public.crm_company_relationships
  for insert
  with check (
    responsible_seller_id in (select public.scoped_seller_ids())
    or public.has_role('administrador', 'gestor_adm')
  );

create policy crm_company_rel_update on public.crm_company_relationships
  for update
  using (
    responsible_seller_id in (select public.scoped_seller_ids())
    or public.has_role('administrador', 'gestor_adm')
  )
  with check (
    responsible_seller_id in (select public.scoped_seller_ids())
    or public.has_role('administrador', 'gestor_adm')
  );

-- ---------------------------------------------------------------------------
-- DELETE — nenhuma policy.
--
-- Encerrar o relacionamento é `ended_at`: operação de gestão, dentro do escopo,
-- e o histórico CONTINUA CONTANDO. Retirar por erro cadastral é
-- `status = 'inativo'`, só administrador, com trilha. As duas coisas são
-- diferentes, e D-022 existe porque confundi-las custa histórico.
--
-- A RLS filtra, não levanta: DELETE sem policy devolve `DELETE 0`, sem erro.
-- ---------------------------------------------------------------------------
