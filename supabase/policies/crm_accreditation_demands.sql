-- Espelho das policies de public.crm_accreditation_demands e
-- public.crm_demand_origins.
--
-- NÃO é aplicado por si só — vão ao banco pela migration 0014_vinculo_demanda.sql.
-- A sincronia é manual.
--
-- Fonte: RLS_PERMISSOES.md §5.3 e §5.5; D-041, D-042.

-- ---------------------------------------------------------------------------
-- CATÁLOGO — leitura ampla, escrita por gestão.
--
-- É lista de opções de formulário, sem dado sensível. Fechar a leitura só
-- quebraria o select da tela.
-- ---------------------------------------------------------------------------
create policy crm_demand_origins_select on public.crm_demand_origins
  for select using (public.auth_role() is not null);

create policy crm_demand_origins_insert on public.crm_demand_origins
  for insert with check (public.has_role('administrador', 'gestor_adm'));

create policy crm_demand_origins_update on public.crm_demand_origins
  for update using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

-- ---------------------------------------------------------------------------
-- VÍNCULO — recorte PELO COMÉRCIO, transitivo.
--
-- `scoped_seller_ids()` devolve CONSULTORES, não empresas: não há como recortar
-- um vínculo entre duas empresas sem atravessar `crm_company_relationships`.
-- Daí o `exists`, e daí a 0013 ser pré-requisito duro da 0014 — não ordem por
-- conveniência.
--
-- Recorta pelo COMÉRCIO e não pela empresa demandante (D-041, decisão 5): é o
-- objeto do trabalho comercial e é dele que sai a comissão. Recortar pela
-- demandante faria o consultor perder de vista o próprio credenciamento quando
-- a demanda viesse de carteira alheia.
--
-- AS TRÊS POLICIES, pelo motivo da 0013: SELECT recortado com UPDATE aberto
-- deixa reatribuir fora do escopo, e o SELECT esconde a operação depois de
-- feita.
--
-- O RAMO DE GESTÃO cobre o comércio SEM linha de relacionamento — importado e
-- ainda não distribuído. Sem ele, as demandas de um comércio recém-carregado
-- ficariam invisíveis a todos, inclusive a quem precisa atribuí-lo.
-- ---------------------------------------------------------------------------
create policy crm_demands_select on public.crm_accreditation_demands
  for select
  using (
    exists (
      select 1 from public.crm_company_relationships r
       where r.company_id = crm_accreditation_demands.merchant_company_id
         and r.responsible_seller_id in (select public.scoped_seller_ids())
    )
    or public.has_role('administrador', 'gestor_adm')
  );

-- insert e update repetem o mesmo predicado — ver a migration.

-- ---------------------------------------------------------------------------
-- DELETE — nenhuma policy, nas duas tabelas.
--
-- Origem sai de circulação por `status = 'inativo'`. Demanda registrada é fato
-- histórico: o que muda é a origem estar ativa ou não, nunca a demanda ter
-- existido.
-- ---------------------------------------------------------------------------
