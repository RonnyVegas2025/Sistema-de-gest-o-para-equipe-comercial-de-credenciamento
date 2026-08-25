-- 0013_relacionamento.sql — Sprint 2, etapa 5
--
-- `crm_company_relationships`: o relacionamento comercial do CRM com o
-- estabelecimento. Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- ===========================================================================
-- AQUI O RECORTE DEIXA DE SER FUNÇÃO PROVADA E VIRA BARREIRA REAL.
--
-- A Sprint 1 entregou `scoped_seller_ids()` com gate de cinco usuários
-- passando 8/8 — mas sem nenhuma tabela onde prendê-la. A função estava
-- provada; o *enforcement* não. É esta migration que fecha D-018.
--
-- Por isso a regra de aceite da Sprint 2 se aplica aqui pela primeira vez com
-- toda a força: a policy com recorte nasce NESTA migration, e
-- `supabase/checks/0013_verificacao.sql` confere o predicado literalmente.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Enums. Valor interno é estável; o rótulo exibido pode mudar sem quebrar
-- integração. Expansão prevista por `alter type add value` — ex-cliente,
-- suspenso — sem migration de dados.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'crm_relationship_type') then
    create type public.crm_relationship_type as enum ('prospect', 'base_vegas');
  end if;
  if not exists (select 1 from pg_type where typname = 'crm_opportunity_origin') then
    create type public.crm_opportunity_origin as enum (
      'novo_prospect', 'base_vegas', 'importacao', 'indicacao', 'outro');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- SEM `portfolio_id`, e não é esquecimento.
--
-- A carteira vigente do estabelecimento é descoberta pelo vínculo:
--
--     companies → crm_portfolio_companies (ended_at is null) → crm_portfolios
--
-- Uma coluna aqui seria segunda fonte de verdade: poderia apontar para a
-- Carteira A enquanto o vínculo vigente aponta para a B, sem nada no banco
-- impedindo — e a divergência não produz erro, só resposta errada. Mesmo
-- defeito de `managers.team_id` (D-017).
-- ---------------------------------------------------------------------------
create table if not exists public.crm_company_relationships (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies (id),
  relationship_type       public.crm_relationship_type not null default 'prospect',
  origin                  public.crm_opportunity_origin not null default 'novo_prospect',
  responsible_seller_id   uuid references public.sellers (id),
  team_id                 uuid references public.teams (id),
  relationship_started_at date,

  -- ENCERRAMENTO OPERACIONAL (D-022). O gestor encerra o relacionamento dentro
  -- do escopo, e o histórico CONTINUA CONTANDO. Distinto de `status`.
  ended_at                timestamptz,
  ended_by                uuid references public.profiles (id),
  end_reason              text,

  -- INATIVAÇÃO POR REGISTRO INCORRETO (D-022). Sai de tudo, só administrador.
  status                  public.entity_status not null default 'ativo',
  inactivated_at          timestamptz,
  inactivated_by          uuid references public.profiles (id),
  inactivation_reason     text,
  reactivation_reason     text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ===========================================================================
-- Índices
--
-- O único em `company_id` é o que faz valer o 1:1 de D-014 — sem ele, "uma
-- linha por empresa" seria convenção, não garantia.
--
-- O de `responsible_seller_id` sustenta o recorte: sem ele, toda avaliação de
-- policy vira varredura da tabela inteira.
-- ===========================================================================
create unique index if not exists crm_company_rel_company_unique
  on public.crm_company_relationships (company_id);
create index if not exists crm_company_rel_seller_idx
  on public.crm_company_relationships (responsible_seller_id);
create index if not exists crm_company_rel_team_idx
  on public.crm_company_relationships (team_id);
create index if not exists crm_company_rel_type_idx
  on public.crm_company_relationships (relationship_type);

-- ===========================================================================
-- Triggers de manutenção e guardas de status
-- ===========================================================================
drop trigger if exists crm_company_rel_set_updated_at on public.crm_company_relationships;
create trigger crm_company_rel_set_updated_at
  before update on public.crm_company_relationships
  for each row execute function public.set_updated_at();

drop trigger if exists crm_company_rel_enforce_inactivation on public.crm_company_relationships;
create trigger crm_company_rel_enforce_inactivation
  before update on public.crm_company_relationships
  for each row execute function public.enforce_inactivation_is_admin();

-- ===========================================================================
-- TRILHA CADASTRAL — função própria da entidade (D-023)
--
-- `scope = 'relationship'` já está no CHECK de crm_record_status_history desde
-- a 0008. Assinatura obrigatória: security definer (é o que atravessa a RLS de
-- uma tabela sem policy de INSERT), search_path fixo, e execute revogado de
-- public E de authenticated — os dois, porque o grant implícito de PUBLIC
-- sustenta o privilégio sozinho (RLS_PERMISSOES §5.6).
-- ===========================================================================
create or replace function public.write_record_status_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_record_status_history
    (scope, target_id, previous_status, new_status, reason, changed_by)
  values ('relationship', old.id, old.status, new.status, new.inactivation_reason, auth.uid());
  return null;
end;
$$;
revoke execute on function public.write_record_status_relationship() from public, authenticated;

drop trigger if exists crm_company_rel_stamp_status on public.crm_company_relationships;
create trigger crm_company_rel_stamp_status
  before update on public.crm_company_relationships
  for each row
  when (old.status is distinct from new.status)
  execute function public.stamp_status_transition();

drop trigger if exists crm_company_rel_enforce_reactivation on public.crm_company_relationships;
create trigger crm_company_rel_enforce_reactivation
  before update on public.crm_company_relationships
  for each row
  when (old.status is distinct from new.status)
  execute function public.enforce_reactivation_is_admin();

drop trigger if exists crm_company_rel_record_status_history on public.crm_company_relationships;
create trigger crm_company_rel_record_status_history
  after update on public.crm_company_relationships
  for each row
  when (old.status is distinct from new.status)
  execute function public.write_record_status_relationship();

-- ===========================================================================
-- RLS COM RECORTE — espelho de supabase/policies/crm_company_relationships.sql
--
-- O predicado de RLS_PERMISSOES §5.3, literal:
--
--     responsible_seller_id in (select public.scoped_seller_ids())
--
-- Mais o ramo de gestão para RESPONSÁVEL NULO. Um relacionamento importado e
-- ainda não distribuído tem `responsible_seller_id is null`, e o predicado
-- acima o esconderia de todo mundo — inclusive de quem precisa distribuí-lo.
-- Distribuir é ação de gestão (§5.3), então ele fica visível a `gestor_adm` e
-- `administrador`, e invisível ao consultor.
--
-- Sem esse ramo, a carteira recém-importada sumiria da tela de quem deveria
-- atribuí-la — e o dado existiria sem ninguém conseguir agir sobre ele.
-- ===========================================================================
alter table public.crm_company_relationships enable row level security;

drop policy if exists crm_company_rel_select on public.crm_company_relationships;
create policy crm_company_rel_select on public.crm_company_relationships
  for select
  using (
    responsible_seller_id in (select public.scoped_seller_ids())
    or public.has_role('administrador', 'gestor_adm')
  );

drop policy if exists crm_company_rel_insert on public.crm_company_relationships;
create policy crm_company_rel_insert on public.crm_company_relationships
  for insert
  with check (
    responsible_seller_id in (select public.scoped_seller_ids())
    or public.has_role('administrador', 'gestor_adm')
  );

drop policy if exists crm_company_rel_update on public.crm_company_relationships;
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

-- DELETE: nenhuma policy. Encerrar é `ended_at` — operação de gestão que
-- preserva o histórico. Retirar por erro cadastral é `status = 'inativo'`, só
-- administrador, com trilha (D-022).
