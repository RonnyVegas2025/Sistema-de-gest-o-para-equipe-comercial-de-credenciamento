-- 0012_companies.sql — Sprint 2, etapa 3
--
-- Estabelecimento: identidade permanente, dados públicos da consulta de CNPJ e
-- coordenadas. Primeira migration da Sprint 2. Idempotente.
--
-- APLICAÇÃO: SQL Editor do painel do Supabase (D-031).
--
-- O que NÃO entra aqui, de propósito:
--   - `crm_company_relationships` e o recorte por escopo  → migration 0013
--   - `crm_contacts`                                      → migration 0014
--   - carteira, oportunidade, atividade                   → sprints seguintes
--
-- ===========================================================================
-- POR QUE ESTA TABELA NÃO TEM RECORTE — e por que isso está escrito aqui
--
-- A regra de aceite da Sprint 2 diz: nenhuma tabela `crm_*` nasce sem a sua
-- policy com recorte na mesma migration. `companies` fica FORA da regra, por
-- decisão registrada e não por omissão.
--
--   1. Não é `crm_*`. É cadastro corporativo, não domínio comercial.
--   2. Não tem coluna de responsável (D-006): "o consultor não é proprietário
--      da empresa. Identidade não tem dono."
--   3. A leitura ampla é DELIBERADA (RLS_PERMISSOES §5.2): a busca por CNPJ
--      precisa encontrar o estabelecimento mesmo fora do escopo. Sem isso, o
--      índice único parcial vira erro de duplicidade sem explicação — que é
--      exatamente o que D-006 e D-016 existem para evitar.
--
-- O que o recorte protege é o RELACIONAMENTO (0013), não a IDENTIDADE. E
-- leitura ampla não é exibição ampla (D-024): a RLS diz se a linha é legível, a
-- aplicação diz quanto exibir — é o que sustenta o comportamento de D-016, em
-- que o consultor fora do escopo sabe que o estabelecimento existe sem receber
-- o nome do colega responsável.
--
-- `supabase/checks/0012_verificacao.sql` registra a ausência de recorte como
-- resultado ESPERADO, com este motivo. Tabela sem recorte e sem explicação, lida
-- seis meses depois, é indistinguível de dívida esquecida.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- SEM `source_ref`, e isso não é esquecimento da 0007.
--
-- As quatro tabelas da estrutura comercial têm `source_ref` porque o Painel ADM
-- é fonte de verdade delas e o CRM as carrega por importação (D-004). Com
-- `companies` é o contrário: **o CRM é a fonte de verdade** — população
-- distinta, estabelecimento credenciado não é cliente de agregados —, e não há
-- sincronização entre os dois bancos.
--
-- Reconciliação com o legado, quando necessária, usa `legacy_customer_code`.
-- Acrescentar `source_ref` aqui criaria a expectativa de uma origem externa que
-- não existe.
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id                      uuid primary key default gen_random_uuid(),
  legal_name              text not null,
  trade_name              text,
  cnpj                    text,
  legacy_customer_code    text,
  parent_company_id       uuid references public.companies (id),
  relationship_start_date date,
  status                  public.entity_status not null default 'ativo',

  -- Dados públicos vindos da consulta de CNPJ (D-008)
  situacao_cadastral      text,
  cnae_principal          text,
  atividade               text,
  cep                     text,
  logradouro              text,
  numero                  text,
  complemento             text,
  bairro                  text,
  municipio               text,
  uf                      text,
  telefone                text,
  cnpj_lookup_at          timestamptz,
  cnpj_lookup_source      text,

  -- Geolocalização do estabelecimento
  latitude                numeric(10,7),
  longitude               numeric(10,7),

  -- Convenção de inativação: QUATRO colunas (D-033). As três primeiras
  -- respondem por que este registro está inativo; `reactivation_reason`
  -- responde por que foi reativado.
  inactivated_at          timestamptz,
  inactivated_by          uuid references public.profiles (id),
  inactivation_reason     text,
  reactivation_reason     text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- `parent_company_id` sem ação de delete (mesmo critério de D-034).
--
-- `references` sem `on delete` é NO ACTION: apagar uma matriz com filiais
-- apontando para ela é recusado. Falhar alto é melhor que `set null`, que
-- desvincularia a filial em silêncio, sem nenhum registro de que houve vínculo.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- FORMATO CANÔNICO DE CNPJ (D-039)
--
-- Quatorze dígitos, sem pontuação. O CHECK não é preciosismo: o índice único
-- parcial abaixo é a barreira contra cadastro duplicado, e ele NÃO enxerga
-- '12.345.678/0001-90' e '12345678000190' como o mesmo CNPJ.
--
-- Sem esta constraint, a unicidade passaria a depender de todo chamador
-- normalizar — importação, tela de cadastro, integração de consulta, API
-- futura —, e bastaria um esquecer para o duplicado entrar sem erro nenhum.
--
-- Consequência aceita: normalizar é responsabilidade de quem escreve, e o banco
-- recusa o que não estiver canônico. Isso custa tratamento de erro na tela de
-- cadastro. É melhor esse custo que duplicata silenciosa.
--
-- Guardado por bloco DO sobre pg_constraint: `alter table add constraint` não
-- tem `if not exists`, e a migration precisa ser reexecutável.
-- ===========================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'companies_cnpj_canonico'
       and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_cnpj_canonico
      check (cnpj is null or cnpj ~ '^[0-9]{14}$');
  end if;
end
$$;

-- ===========================================================================
-- Índices
--
-- O único parcial permite inativar e recadastrar o mesmo CNPJ: a restrição vale
-- só entre os ativos.
-- ===========================================================================
create unique index if not exists companies_cnpj_active_unique
  on public.companies (cnpj)
  where status = 'ativo' and cnpj is not null;

create index if not exists companies_status_idx on public.companies (status);
create index if not exists companies_municipio_uf_idx
  on public.companies (municipio, uf);

-- ===========================================================================
-- Triggers de manutenção e guardas de status
--
-- `enforce_inactivation_is_admin` (0003): `companies` é CADASTRO MESTRE na
-- matriz de D-022 — inativação é correção de registro incorreto e cabe só ao
-- administrador. Encerrar relacionamento comercial é outra coisa, e vive em
-- `crm_company_relationships.ended_at` (0013).
-- ===========================================================================
drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists companies_enforce_inactivation on public.companies;
create trigger companies_enforce_inactivation
  before update on public.companies
  for each row execute function public.enforce_inactivation_is_admin();

-- ===========================================================================
-- TRILHA CADASTRAL — função PRÓPRIA da entidade (D-023)
--
-- Nada de gravador genérico: uma função capaz de inserir qualquer `scope` com
-- qualquer `target_id` anularia a imutabilidade de `crm_record_status_history` —
-- bastaria chamá-la com os argumentos certos para forjar histórico. O `scope`
-- fica FIXO no corpo, e a função não aceita parâmetro.
--
-- Assinatura obrigatória:
--   security definer          — é o que atravessa a RLS de uma tabela sem
--                               policy de INSERT; é o mecanismo, não um atalho
--   set search_path = public  — fixo e mínimo
--   revoke execute            — de public E de authenticated
--
-- Os DOIS revokes, não um. Revogar só de `authenticated` é inócuo: o grant
-- implícito de PUBLIC sustenta o privilégio e nada dá sinal — a trilha continua
-- gravável de fora. Ver RLS_PERMISSOES §5.6.
--
-- `scope = 'company'` já está no CHECK de crm_record_status_history desde a
-- 0008, que previu os escopos futuros. Nenhum ALTER é necessário aqui.
--
-- O Security Advisor do Supabase vai apontar esta função por causa do
-- `security definer`. É o mecanismo. Documentar a exceção, não "corrigir".
-- ===========================================================================
create or replace function public.write_record_status_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_record_status_history
    (scope, target_id, previous_status, new_status, reason, changed_by)
  values ('company', old.id, old.status, new.status, new.inactivation_reason, auth.uid());
  return null;
end;
$$;
revoke execute on function public.write_record_status_company() from public, authenticated;

-- ---------------------------------------------------------------------------
-- Os três gatilhos de status.
--
-- Todos com `when (old.status is distinct from new.status)` — nunca `<>`, que
-- devolve nulo quando um dos lados é nulo e faria a condição não disparar.
-- UPDATE que não muda status não gera linha de trilha.
-- ---------------------------------------------------------------------------
drop trigger if exists companies_stamp_status on public.companies;
create trigger companies_stamp_status
  before update on public.companies
  for each row
  when (old.status is distinct from new.status)
  execute function public.stamp_status_transition();

drop trigger if exists companies_enforce_reactivation on public.companies;
create trigger companies_enforce_reactivation
  before update on public.companies
  for each row
  when (old.status is distinct from new.status)
  execute function public.enforce_reactivation_is_admin();

drop trigger if exists companies_record_status_history on public.companies;
create trigger companies_record_status_history
  after update on public.companies
  for each row
  when (old.status is distinct from new.status)
  execute function public.write_record_status_company();

-- ===========================================================================
-- RLS — espelho de supabase/policies/companies.sql
--
-- Leitura ampla entre autenticados, pelo motivo do cabeçalho. Escrita para
-- comercial, analista_adm, gestor_adm e administrador (RLS_PERMISSOES §5.2).
-- ===========================================================================
alter table public.companies enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select
  using (public.auth_role() is not null);

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert
  with check (public.has_role(
    'administrador', 'gestor_adm', 'analista_adm', 'comercial'));

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update
  using (public.has_role(
    'administrador', 'gestor_adm', 'analista_adm', 'comercial'))
  with check (public.has_role(
    'administrador', 'gestor_adm', 'analista_adm', 'comercial'));

-- DELETE: nenhuma policy. Estabelecimento sai de circulação por
-- `status = 'inativo'`, que é correção de cadastro e gera trilha. Encerramento
-- do relacionamento comercial é `ended_at` na 0013, e preserva o histórico
-- (D-022).
