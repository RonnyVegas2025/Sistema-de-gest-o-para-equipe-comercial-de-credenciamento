-- Verificação da migration 0014 — somente leitura, não altera nada.
-- Vínculo de demanda, catálogo de origens e marcadores de papel (D-041, D-042).
-- Toda linha deve sair com status OK.

with
marcadores as (
  select 'coluna' as secao, 'companies.'||e.nome as verificacao,
         'boolean / aceita nulo=nao / default=false' as esperado,
         coalesce((select format_type(a.atttypid,a.atttypmod)||' / aceita nulo='||
                          case when a.attnotnull then 'nao' else 'sim' end||
                          ' / default='||coalesce(pg_get_expr(d.adbin,d.adrelid),'(nenhum)')
                   from pg_attribute a
                   left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
                   where a.attrelid='public.companies'::regclass and a.attname=e.nome
                     and not a.attisdropped),'(ausente)') as obtido
  from (values ('is_merchant'),('is_client_company')) as e(nome)
),
cat_col (nome, tipo, nulo) as (
  values ('id','uuid','nao'),('match_key','text','nao'),('name','text','nao'),
         ('requires_client_company','boolean','nao'),('status','entity_status','nao'),
         ('inactivated_at','timestamp with time zone','sim'),
         ('inactivated_by','uuid','sim'),('inactivation_reason','text','sim'),
         ('reactivation_reason','text','sim'),
         ('created_at','timestamp with time zone','nao'),
         ('updated_at','timestamp with time zone','nao')
),
cat_reais as (
  select a.attname::text nome, format_type(a.atttypid,a.atttypmod)::text tipo,
         case when a.attnotnull then 'nao' else 'sim' end nulo
  from pg_attribute a
  where a.attrelid='public.crm_demand_origins'::regclass and a.attnum>0 and not a.attisdropped
),
cat_check as (
  select 'catálogo' as secao, e.nome as verificacao, e.tipo||' / nulo='||e.nulo as esperado,
         coalesce(r.tipo||' / nulo='||r.nulo,'(ausente)') as obtido
  from cat_col e left join cat_reais r on r.nome=e.nome
  union all
  select 'catálogo','nenhuma coluna a mais','(nenhuma)',
         coalesce((select string_agg(nome,', ' order by nome) from cat_reais
                   where nome not in (select nome from cat_col)),'(nenhuma)')
  union all
  select 'catálogo','match_key é único (identidade estável, D-011)','true',
         coalesce((select indisunique::text from pg_index i join pg_class c on c.oid=i.indexrelid
                   where c.relname='crm_demand_origins_match_key_unique'),'(ausente)')
),
seed as (
  select 'seed' as secao, 'as três origens, com a flag correta' as verificacao,
         'EMPRESA_CLIENTE=true, MELHORIA_REDE_POS_VENDAS=false, MELHORIA_REDE_VENDA_NOVA=false' as esperado,
         coalesce((select string_agg(match_key||'='||requires_client_company::text, ', ' order by match_key)
                   from public.crm_demand_origins),'(vazio)') as obtido
  union all
  select 'seed','exatamente uma origem exige empresa','1',
         (select count(*)::text from public.crm_demand_origins where requires_client_company)
),
vin_col (nome, tipo, nulo) as (
  values ('id','uuid','nao'),('merchant_company_id','uuid','nao'),
         ('origin_id','uuid','nao'),('client_company_id','uuid','sim'),
         ('requested_at','date','sim'),('responsible_seller_id','uuid','sim'),
         ('team_id','uuid','sim'),('notes','text','sim'),
         ('created_at','timestamp with time zone','nao'),
         ('updated_at','timestamp with time zone','nao')
),
vin_reais as (
  select a.attname::text nome, format_type(a.atttypid,a.atttypmod)::text tipo,
         case when a.attnotnull then 'nao' else 'sim' end nulo
  from pg_attribute a
  where a.attrelid='public.crm_accreditation_demands'::regclass and a.attnum>0 and not a.attisdropped
),
vin_check as (
  select 'vínculo' as secao, e.nome as verificacao, e.tipo||' / nulo='||e.nulo as esperado,
         coalesce(r.tipo||' / nulo='||r.nulo,'(ausente)') as obtido
  from vin_col e left join vin_reais r on r.nome=e.nome
  union all
  select 'vínculo','nenhuma coluna a mais','(nenhuma)',
         coalesce((select string_agg(nome,', ' order by nome) from vin_reais
                   where nome not in (select nome from vin_col)),'(nenhuma)')
  union all
  -- Previsão de faturamento e comissão pertencem ao COMÉRCIO: a comissão é paga
  -- uma vez por comércio, mesmo com várias empresas demandando (D-042).
  select 'vínculo','SEM previsão de faturamento nem comissão no vínculo','(nenhuma)',
         coalesce((select string_agg(nome,', ') from vin_reais
                   where nome ~* 'faturamento|revenue|comissao|commission'),'(nenhuma)')
  union all
  -- NÃO é único por comércio: N:N é o desenho (D-041).
  select 'vínculo','merchant_company_id NÃO é único — o N:N é o desenho','sem único',
         case when exists (select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
                           where i.indrelid='public.crm_accreditation_demands'::regclass
                             and i.indisunique and c.relname like '%merchant%')
              then 'ÚNICO — o N:N caiu' else 'sem único' end
),
idx as (
  select 'índice' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_indexes where schemaname='public' and indexname=e.nome),'(ausente)') as obtido
  from (values ('crm_demands_merchant_idx'),('crm_demands_client_idx'),
               ('crm_demands_origin_idx'),('companies_is_merchant_idx'),
               ('companies_is_client_company_idx'),('crm_demand_origins_match_key_unique')) as e(nome)
),
fn as (
  select 'função' as secao, 'enforce_demand_origin_shape existe' as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_proc where proname='enforce_demand_origin_shape'
                   and pronamespace='public'::regnamespace),'(ausente)') as obtido
  union all
  -- Validação NÃO atravessa RLS: security definer aqui ampliaria superfície
  -- sem ganho. A assinatura de D-023 vale para trilha, não para validação.
  select 'função','enforce_demand_origin_shape NÃO é security definer','false',
         coalesce((select prosecdef::text from pg_proc where proname='enforce_demand_origin_shape'
                   and pronamespace='public'::regnamespace),'(ausente)')
  union all
  select 'função','search_path fixo mesmo sem security definer','search_path=public',
         coalesce((select array_to_string(proconfig,',') from pg_proc
                   where proname='enforce_demand_origin_shape'
                     and pronamespace='public'::regnamespace),'(nenhum)')
),
trg as (
  select 'trigger' as secao, e.nome as verificacao, e.esperado as esperado,
         coalesce((select p.proname::text from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                   where t.tgname=e.nome and not t.tgisinternal),'(ausente)') as obtido
  from (values ('crm_demands_enforce_origin_shape','enforce_demand_origin_shape'),
               ('crm_demands_set_updated_at','set_updated_at'),
               ('crm_demand_origins_set_updated_at','set_updated_at'),
               ('crm_demand_origins_enforce_inactivation','enforce_inactivation_is_manager_or_admin')
       ) as e(nome, esperado)
  union all
  -- BEFORE, não AFTER: recusar depois da escrita seria recusar tarde demais.
  select 'trigger','o gatilho de forma é BEFORE INSERT OR UPDATE','BEFORE INSERT OR UPDATE',
         coalesce((select case when t.tgtype & 2 = 2 then 'BEFORE ' else 'AFTER ' end ||
                          case when t.tgtype & 4 = 4 and t.tgtype & 16 = 16 then 'INSERT OR UPDATE'
                               when t.tgtype & 4 = 4 then 'INSERT' else 'UPDATE' end
                   from pg_trigger t where t.tgname='crm_demands_enforce_origin_shape'
                     and not t.tgisinternal),'(ausente)')
),
rls as (
  select 'RLS' as secao, 'row level security ligada em '||e.tabela as verificacao, 'true' as esperado,
         (select relrowsecurity::text from pg_class where relname=e.tabela
            and relnamespace='public'::regnamespace) as obtido
  from (values ('crm_demand_origins'),('crm_accreditation_demands')) as e(tabela)
),
pol as (
  select 'policy' as secao, 'vínculo: três policies, nenhuma de DELETE' as verificacao,
         'crm_demands_insert/a, crm_demands_select/r, crm_demands_update/w' as esperado,
         coalesce((select string_agg(polname||'/'||polcmd::text,', ' order by polname)
                   from pg_policy where polrelid='public.crm_accreditation_demands'::regclass),'(nenhuma)') as obtido
  union all
  select 'policy','catálogo: três policies, nenhuma de DELETE',
         'crm_demand_origins_insert/a, crm_demand_origins_select/r, crm_demand_origins_update/w',
         coalesce((select string_agg(polname||'/'||polcmd::text,', ' order by polname)
                   from pg_policy where polrelid='public.crm_demand_origins'::regclass),'(nenhuma)')
),
-- ===========================================================================
-- O RECORTE — pelo comércio, transitivo pelo relacionamento (D-041 dec. 5).
-- As TRÊS policies, pelo mesmo motivo da 0013: SELECT recortado com UPDATE
-- aberto esconde a operação depois de feita.
-- ===========================================================================
recorte as (
  select 'recorte' as secao, 'as três policies do vínculo chamam scoped_seller_ids' as verificacao,
         '3' as esperado,
         (select count(*)::text from pg_policy
          where polrelid='public.crm_accreditation_demands'::regclass
            and (coalesce(pg_get_expr(polqual,polrelid),'') ilike '%scoped_seller_ids%'
              or coalesce(pg_get_expr(polwithcheck,polrelid),'') ilike '%scoped_seller_ids%')) as obtido
  union all
  select 'recorte','o recorte é transitivo, via crm_company_relationships','3',
         (select count(*)::text from pg_policy
          where polrelid='public.crm_accreditation_demands'::regclass
            and (coalesce(pg_get_expr(polqual,polrelid),'') ilike '%crm_company_relationships%'
              or coalesce(pg_get_expr(polwithcheck,polrelid),'') ilike '%crm_company_relationships%'))
  union all
  select 'recorte','ramo de gestão para comércio sem relacionamento','3',
         (select count(*)::text from pg_policy
          where polrelid='public.crm_accreditation_demands'::regclass
            and (coalesce(pg_get_expr(polqual,polrelid),'') ilike '%has_role%'
              or coalesce(pg_get_expr(polwithcheck,polrelid),'') ilike '%has_role%'))
),
etapa as (
  select 'etapa 5b' as secao, 'crm_contacts ainda NÃO existe (é da 0015)' as verificacao,
         'ausente' as esperado,
         case when to_regclass('public.crm_contacts') is null then 'ausente' else 'PRESENTE' end as obtido
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from marcadores union all select * from cat_check union all select * from seed
  union all select * from vin_check union all select * from idx union all select * from fn
  union all select * from trg union all select * from rls union all select * from pol
  union all select * from recorte union all select * from etapa
) todas
order by case secao when 'coluna' then 1 when 'catálogo' then 2 when 'seed' then 3
                    when 'vínculo' then 4 when 'índice' then 5 when 'função' then 6
                    when 'trigger' then 7 when 'RLS' then 8 when 'policy' then 9
                    when 'recorte' then 10 else 11 end, verificacao;
