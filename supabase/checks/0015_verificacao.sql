-- Verificação da migration 0015 — somente leitura, não altera nada.
-- View crm_merchant_origin_status, para a página "Novos Comércios".
-- Toda linha deve sair com status OK.
--
-- LIMITE DESTE SCRIPT, escrito porque a 0014 ensinou: ele confere ATRIBUTO e
-- TEXTO. Que a view exista, que seja view e não tabela materializada, que
-- `security_invoker` esteja ligado, quais colunas ela expõe, e que a definição
-- referencie as três relações de baixo.
--
-- **Não confere que ela RECORTA.** Nenhuma linha aqui é lida por um consultor e
-- negada a outro — este script roda como dono, e o dono não é filtrado por RLS.
-- O recorte é exercitado em `supabase/dev/comportamento/0015_view.sql`, no
-- cluster local, sob `set local role authenticated` (D-018, D-043).

with
existe as (
  select 'view' as secao, 'crm_merchant_origin_status existe e é VIEW' as verificacao,
         'v' as esperado,
         coalesce((select relkind::text from pg_class
                    where oid = to_regclass('public.crm_merchant_origin_status')),
                  '(ausente)') as obtido
),
-- O ponto da migration. `security_invoker=true` é o que faz a view herdar a RLS
-- de quem consulta; sem ele ela roda como dona e devolve a base inteira.
invoker as (
  select 'view', 'security_invoker LIGADO — é o recorte (0015)',
         'sim',
         case
           when to_regclass('public.crm_merchant_origin_status') is null then '(view ausente)'
           when coalesce(
                  (select 'security_invoker=true' = any(reloptions) from pg_class
                    where oid = to_regclass('public.crm_merchant_origin_status')), false)
             then 'sim'
           else 'NAO — a view roda como dona e atravessa a RLS'
         end
),
-- Materializada não herda RLS de nada e guarda cópia dos dados: seria outra
-- coisa com o mesmo nome.
nao_materializada as (
  select 'view', 'NÃO é view materializada', 'ok',
         case when to_regclass('public.crm_merchant_origin_status') is null then '(view ausente)'
              when exists (select 1 from pg_class
                            where oid = to_regclass('public.crm_merchant_origin_status')
                              and relkind = 'm') then 'É MATERIALIZADA'
              else 'ok' end
),
col_esperada (nome, tipo) as (
  values ('relationship_id','uuid'), ('company_id','uuid'),
         ('responsible_seller_id','uuid'), ('team_id','uuid'),
         ('relationship_type','crm_relationship_type'),
         ('relationship_started_at','date'),
         ('ended_at','timestamp with time zone'),
         ('relationship_status','entity_status'),
         ('legal_name','text'), ('trade_name','text'), ('cnpj','text'),
         ('municipio','text'), ('uf','text'),
         ('company_status','entity_status'),
         ('company_created_at','timestamp with time zone'),
         ('tem_origem','boolean')
),
col_real as (
  select a.attname::text nome, format_type(a.atttypid, a.atttypmod)::text tipo
  from pg_attribute a
  where a.attrelid = to_regclass('public.crm_merchant_origin_status')
    and a.attnum > 0 and not a.attisdropped
),
colunas as (
  select 'coluna', 'view.'||e.nome, e.tipo,
         coalesce((select r.tipo from col_real r where r.nome = e.nome), '(ausente)')
  from col_esperada e
),
sem_extras as (
  select 'coluna', 'nenhuma coluna a mais na view', '(nenhuma)',
         coalesce((select string_agg(r.nome, ', ' order by r.nome) from col_real r
                    where r.nome not in (select nome from col_esperada)), '(nenhuma)')
),
-- Degrau, não topo: casar texto pega a remoção, não o desligamento (D-043).
definicao as (
  select 'definição', 'a view lê as três relações de baixo',
         'relacionamento+empresas+demandas',
         case when to_regclass('public.crm_merchant_origin_status') is null then '(ausente)'
         else
           case when pg_get_viewdef(to_regclass('public.crm_merchant_origin_status')) like '%crm_company_relationships%'
                 and pg_get_viewdef(to_regclass('public.crm_merchant_origin_status')) like '%companies%'
                 and pg_get_viewdef(to_regclass('public.crm_merchant_origin_status')) like '%crm_accreditation_demands%'
                then 'relacionamento+empresas+demandas'
                else 'FALTA alguma' end
         end
),
filtro_merchant as (
  select 'definição', 'restrita a is_merchant', 'sim',
         case when to_regclass('public.crm_merchant_origin_status') is null then '(ausente)'
              when pg_get_viewdef(to_regclass('public.crm_merchant_origin_status')) like '%is_merchant%'
                then 'sim' else 'NAO' end
),
-- View não tem RLS própria; ela não deve virar alvo de policy por engano.
sem_policy as (
  select 'RLS', 'a view não tem policy própria (não faz sentido)', '0',
         coalesce((select count(*)::text from pg_policy
                    where polrelid = to_regclass('public.crm_merchant_origin_status')), '0')
),
tudo (secao, verificacao, esperado, obtido) as (
  select * from existe
  union all select * from invoker
  union all select * from nao_materializada
  union all select * from colunas
  union all select * from sem_extras
  union all select * from definicao
  union all select * from filtro_merchant
  union all select * from sem_policy
)
select secao, verificacao, esperado, obtido,
       case when esperado = obtido then 'OK' else 'FALTA' end as status
from tudo;
