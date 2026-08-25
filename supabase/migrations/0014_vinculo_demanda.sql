-- 0014_vinculo_demanda.sql — Sprint 2, etapa 5b
--
-- Origem da demanda de credenciamento (D-041, D-042). Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- ===========================================================================
-- PRÉ-REQUISITO DURO: a 0013 precisa estar aplicada.
--
-- Não é ordem por conveniência. O recorte desta tabela passa por
-- `crm_company_relationships.responsible_seller_id`, porque
-- `scoped_seller_ids()` devolve CONSULTORES e não empresas — não há como
-- recortar um vínculo entre duas empresas sem atravessar o relacionamento.
--
-- A distinção importa: ordem por conveniência alguém reordena numa sprint
-- futura sem pensar; pré-requisito quebra e explica por quê.
-- ===========================================================================

-- ===========================================================================
-- 1. MARCADORES DE PAPEL EM `companies` (D-041, decisão 1)
--
-- Empresa cliente e comércio credenciado são ambos linhas em `companies`: são
-- pessoas jurídicas com CNPJ e endereço idênticos, e o índice único parcial de
-- CNPJ é POR TABELA — em duas tabelas, o mesmo CNPJ entraria nas duas sem nada
-- impedir. E o caso não é hipotético: uma empresa cliente pode também ser
-- credenciada como comércio.
--
-- A classificação é EXPLÍCITA. Deduzir "é empresa cliente" da ausência de linha
-- em `crm_company_relationships` seria o mesmo erro que a regra de
-- `prospect × base_vegas` proíbe: classificação inferida por nulo.
--
-- Migration NOVA, jamais edição da 0012 — ela já está aplicada em produção.
-- ===========================================================================
alter table public.companies
  add column if not exists is_merchant boolean not null default false;
alter table public.companies
  add column if not exists is_client_company boolean not null default false;

create index if not exists companies_is_merchant_idx
  on public.companies (is_merchant) where is_merchant;
create index if not exists companies_is_client_company_idx
  on public.companies (is_client_company) where is_client_company;

-- ===========================================================================
-- 2. CATÁLOGO DE ORIGENS (D-042, decisão 1)
--
-- Tabela, não enum, pelo critério de D-011: a lista é mantida pelo gestor.
-- Campanha sazonal e reativação de comércio inativo são candidatas plausíveis,
-- e com enum cada uma custaria `alter type add value` mais deploy.
--
-- `match_key` estável separado do `name` exibido, como em `crm_loss_reasons`:
-- "Melhoria de Rede — Pós-Vendas" vai ser renomeado; o `match_key` não.
-- ===========================================================================
create table if not exists public.crm_demand_origins (
  id                      uuid primary key default gen_random_uuid(),
  match_key               text not null,
  name                    text not null,

  -- A flag que o trigger lê (D-042, decisão 2). Regra de comportamento vem de
  -- dado do catálogo, nunca de comparação com literal: `origin = 'empresa_cliente'`
  -- quebraria num rename e não cobriria uma segunda origem que também nomeia
  -- empresa. Mesmo mecanismo de `requires_notes` em `crm_loss_reasons` (D-011).
  requires_client_company boolean not null default false,

  status                  public.entity_status not null default 'ativo',
  inactivated_at          timestamptz,
  inactivated_by          uuid references public.profiles (id),
  inactivation_reason     text,
  reactivation_reason     text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists crm_demand_origins_match_key_unique
  on public.crm_demand_origins (match_key);

-- As três origens (D-042). Semeadas por `match_key`, para reexecução limpa.
insert into public.crm_demand_origins (match_key, name, requires_client_company)
values
  ('EMPRESA_CLIENTE',           'Empresa cliente',               true),
  ('MELHORIA_REDE_POS_VENDAS',  'Melhoria de Rede — Pós-Vendas', false),
  ('MELHORIA_REDE_VENDA_NOVA',  'Melhoria de Rede — Venda Nova', false)
on conflict (match_key) do update
  set name = excluded.name,
      requires_client_company = excluded.requires_client_company;

-- ===========================================================================
-- 3. O VÍNCULO DE DEMANDA (D-041 decisão 2, D-042 decisão 5)
--
-- N:N, e NÃO contradiz D-014. A distinção é de ASSUNTO, não de cardinalidade:
--
--   crm_company_relationships   nosso relacionamento COM o estabelecimento · 1:1
--   esta tabela                 qual empresa DEMANDOU o credenciamento  · N:N
--
-- Seria contradição pôr a demandante como coluna no relacionamento — aí um
-- comércio com duas demandantes exigiria duas linhas de relacionamento.
--
-- GUARDA APENAS ORIGEM. Previsão de faturamento e comissão pertencem ao
-- comércio, porque a comissão é paga UMA VEZ por comércio mesmo com várias
-- empresas demandando.
--
-- `responsible_seller_id` e `team_id` aqui NÃO são o responsável pelo comércio,
-- que vive em `crm_company_relationships`. São quem CONDUZIU a ação — numa
-- melhoria de rede a atribuição da ação é justamente o que interessa, e
-- sobrepor os dois fatos a perderia.
-- ===========================================================================
create table if not exists public.crm_accreditation_demands (
  id                    uuid primary key default gen_random_uuid(),
  merchant_company_id   uuid not null references public.companies (id),
  origin_id             uuid not null references public.crm_demand_origins (id),
  client_company_id     uuid references public.companies (id),
  requested_at          date,
  responsible_seller_id uuid references public.sellers (id),
  team_id               uuid references public.teams (id),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists crm_demands_merchant_idx
  on public.crm_accreditation_demands (merchant_company_id);
create index if not exists crm_demands_client_idx
  on public.crm_accreditation_demands (client_company_id);
create index if not exists crm_demands_origin_idx
  on public.crm_accreditation_demands (origin_id);

-- ===========================================================================
-- 4. O TRIGGER BICONDICIONAL (D-042, decisões 3 e 4)
--
-- NÃO É `security definer`, e isso é deliberado. A assinatura de D-023 vale
-- para TRILHA, que precisa atravessar a RLS de uma tabela sem policy de INSERT.
-- Validação não atravessa nada: recusa ou deixa passar, com os privilégios de
-- quem chamou. Copiar por hábito ampliaria superfície sem ganho — e faria o
-- Security Advisor apontar um lint sem explicação, o que ensina a ignorar os
-- que têm.
--
-- BICONDICIONAL, não implicação:
--
--   requires_client_company = true   →  client_company_id NOT NULL, ou recusa
--   requires_client_company = false  →  client_company_id NULL,     ou recusa
--
-- A segunda direção é a que uma implicação simples deixaria passar, e é a que
-- corrompe a contagem: uma linha "melhoria de rede" com empresa preenchida por
-- engano é ambígua para a única pergunta que o vínculo existe para responder —
-- conta como demanda nomeada ou não? E o erro é invisível, porque a linha com
-- todos os campos preenchidos PARECE mais completa que as corretas.
--
-- Três recusas, três mensagens distintas: quem recebe o erro precisa saber qual
-- das três violou.
-- ===========================================================================
create or replace function public.enforce_demand_origin_shape()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  exige boolean;
begin
  select o.requires_client_company into exige
    from public.crm_demand_origins o
   where o.id = new.origin_id;

  if exige is null then
    raise exception 'Origem de demanda inexistente.' using errcode = '23503';
  end if;

  if exige and new.client_company_id is null then
    raise exception 'Esta origem exige a empresa cliente demandante.'
      using errcode = '23514';
  end if;

  if not exige and new.client_company_id is not null then
    raise exception 'Esta origem não admite empresa cliente demandante.'
      using errcode = '23514';
  end if;

  -- D-042, decisão 4. Sem isto, nada impediria apontar um COMÉRCIO como
  -- demandante de si mesmo, e essa linha passaria por todas as outras
  -- validações.
  --
  -- Verifica PRESENÇA e PAPEL, não PERTINÊNCIA: não diz se é a empresa certa.
  -- Apontar a demandante errada passa daqui, e isso é conferência humana.
  if new.client_company_id is not null
     and not exists (
       select 1 from public.companies c
        where c.id = new.client_company_id and c.is_client_company
     ) then
    raise exception 'A empresa demandante precisa estar marcada como empresa cliente.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists crm_demands_enforce_origin_shape on public.crm_accreditation_demands;
create trigger crm_demands_enforce_origin_shape
  before insert or update on public.crm_accreditation_demands
  for each row execute function public.enforce_demand_origin_shape();

drop trigger if exists crm_demands_set_updated_at on public.crm_accreditation_demands;
create trigger crm_demands_set_updated_at
  before update on public.crm_accreditation_demands
  for each row execute function public.set_updated_at();

drop trigger if exists crm_demand_origins_set_updated_at on public.crm_demand_origins;
create trigger crm_demand_origins_set_updated_at
  before update on public.crm_demand_origins
  for each row execute function public.set_updated_at();

-- Catálogo: inativação por gestor ou administrador (D-022, categoria catálogo).
drop trigger if exists crm_demand_origins_enforce_inactivation on public.crm_demand_origins;
create trigger crm_demand_origins_enforce_inactivation
  before update on public.crm_demand_origins
  for each row execute function public.enforce_inactivation_is_manager_or_admin();

-- ===========================================================================
-- 5. RLS
--
-- O CATÁLOGO tem leitura ampla: é lista de opções de formulário, sem dado
-- sensível. Escrita por gestão (RLS_PERMISSOES §5.5).
--
-- O VÍNCULO tem recorte PELO COMÉRCIO (D-041, decisão 5) — é o objeto do
-- trabalho comercial e é dele que sai a comissão. O caminho é transitivo, via
-- o relacionamento do comércio, porque `scoped_seller_ids()` devolve
-- consultores e não empresas.
--
-- O ramo de gestão cobre o comércio SEM linha de relacionamento — importado e
-- ainda não distribuído. Sem ele, as demandas de um comércio recém-carregado
-- ficariam invisíveis a todo mundo, inclusive a quem precisa atribuí-lo.
-- Mesmo critério de §5.3: distribuir é ação de gestão.
-- ===========================================================================
alter table public.crm_demand_origins enable row level security;

drop policy if exists crm_demand_origins_select on public.crm_demand_origins;
create policy crm_demand_origins_select on public.crm_demand_origins
  for select using (public.auth_role() is not null);

drop policy if exists crm_demand_origins_insert on public.crm_demand_origins;
create policy crm_demand_origins_insert on public.crm_demand_origins
  for insert with check (public.has_role('administrador', 'gestor_adm'));

drop policy if exists crm_demand_origins_update on public.crm_demand_origins;
create policy crm_demand_origins_update on public.crm_demand_origins
  for update using (public.has_role('administrador', 'gestor_adm'))
  with check (public.has_role('administrador', 'gestor_adm'));

alter table public.crm_accreditation_demands enable row level security;

drop policy if exists crm_demands_select on public.crm_accreditation_demands;
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

drop policy if exists crm_demands_insert on public.crm_accreditation_demands;
create policy crm_demands_insert on public.crm_accreditation_demands
  for insert
  with check (
    exists (
      select 1 from public.crm_company_relationships r
       where r.company_id = crm_accreditation_demands.merchant_company_id
         and r.responsible_seller_id in (select public.scoped_seller_ids())
    )
    or public.has_role('administrador', 'gestor_adm')
  );

drop policy if exists crm_demands_update on public.crm_accreditation_demands;
create policy crm_demands_update on public.crm_accreditation_demands
  for update
  using (
    exists (
      select 1 from public.crm_company_relationships r
       where r.company_id = crm_accreditation_demands.merchant_company_id
         and r.responsible_seller_id in (select public.scoped_seller_ids())
    )
    or public.has_role('administrador', 'gestor_adm')
  )
  with check (
    exists (
      select 1 from public.crm_company_relationships r
       where r.company_id = crm_accreditation_demands.merchant_company_id
         and r.responsible_seller_id in (select public.scoped_seller_ids())
    )
    or public.has_role('administrador', 'gestor_adm')
  );

-- DELETE: nenhuma policy, nas duas tabelas. Origem sai de circulação por
-- `status = 'inativo'`; demanda registrada é fato histórico — o que muda é a
-- origem estar ativa ou não, nunca a demanda ter existido.
