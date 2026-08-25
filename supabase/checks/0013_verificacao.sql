-- Verificação da migration 0013 — somente leitura, não altera nada.
-- Fecha D-018: o recorte deixa de ser função provada e vira barreira real.
-- Toda linha deve sair com status OK.

with
col_esperadas (nome, tipo, nulo, padrao) as (
  values
    ('id',                      'uuid',                     'nao', 'gen_random_uuid()'),
    ('company_id',              'uuid',                     'nao', '(nenhum)'),
    ('relationship_type',       'crm_relationship_type',    'nao', '''prospect''::crm_relationship_type'),
    ('origin',                  'crm_opportunity_origin',   'nao', '''novo_prospect''::crm_opportunity_origin'),
    ('responsible_seller_id',   'uuid',                     'sim', '(nenhum)'),
    ('team_id',                 'uuid',                     'sim', '(nenhum)'),
    ('relationship_started_at', 'date',                     'sim', '(nenhum)'),
    ('ended_at',                'timestamp with time zone', 'sim', '(nenhum)'),
    ('ended_by',                'uuid',                     'sim', '(nenhum)'),
    ('end_reason',              'text',                     'sim', '(nenhum)'),
    ('status',                  'entity_status',            'nao', '''ativo''::entity_status'),
    ('inactivated_at',          'timestamp with time zone', 'sim', '(nenhum)'),
    ('inactivated_by',          'uuid',                     'sim', '(nenhum)'),
    ('inactivation_reason',     'text',                     'sim', '(nenhum)'),
    ('reactivation_reason',     'text',                     'sim', '(nenhum)'),
    ('created_at',              'timestamp with time zone', 'nao', 'now()'),
    ('updated_at',              'timestamp with time zone', 'nao', 'now()')
),
col_reais as (
  select a.attname::text as nome, format_type(a.atttypid, a.atttypmod)::text as tipo,
         case when a.attnotnull then 'nao' else 'sim' end as nulo,
         coalesce(pg_get_expr(d.adbin, d.adrelid), '(nenhum)') as padrao
  from pg_attribute a
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = 'public.crm_company_relationships'::regclass
    and a.attnum > 0 and not a.attisdropped
),
col_check as (
  select 'coluna' as secao, e.nome as verificacao,
         e.tipo||' / aceita nulo='||e.nulo||' / default='||e.padrao as esperado,
         coalesce(r.tipo||' / aceita nulo='||r.nulo||' / default='||r.padrao,'(coluna ausente)') as obtido
  from col_esperadas e left join col_reais r on r.nome = e.nome
),
col_extra as (
  select 'coluna','nenhuma coluna a mais nesta etapa','(nenhuma)',
         coalesce(string_agg(r.nome, ', ' order by r.nome),'(nenhuma)')
  from col_reais r where r.nome not in (select nome from col_esperadas)
),
-- Duplicar a carteira aqui criaria segunda fonte de verdade contra
-- crm_portfolio_companies, divergindo sem erro.
sem_portfolio as (
  select 'coluna' as secao, 'SEM portfolio_id (segunda fonte de verdade)' as verificacao,
         'ausente' as esperado,
         case when exists (select 1 from pg_attribute
                           where attrelid='public.crm_company_relationships'::regclass
                             and attname='portfolio_id' and not attisdropped)
              then 'PRESENTE' else 'ausente' end as obtido
),
enum_check as (
  select 'tipo' as secao, 'crm_relationship_type' as verificacao,
         'base_vegas, prospect' as esperado,
         coalesce((select string_agg(enumlabel::text, ', ' order by enumlabel)
                   from pg_enum e join pg_type t on t.oid=e.enumtypid
                   where t.typname='crm_relationship_type'),'(ausente)') as obtido
  union all
  select 'tipo','crm_opportunity_origin',
         'base_vegas, importacao, indicacao, novo_prospect, outro',
         coalesce((select string_agg(enumlabel::text, ', ' order by enumlabel)
                   from pg_enum e join pg_type t on t.oid=e.enumtypid
                   where t.typname='crm_opportunity_origin'),'(ausente)')
),
fk_check as (
  select 'chave' as secao, 'company_id referencia companies' as verificacao,
         'FOREIGN KEY (company_id) REFERENCES companies(id)' as esperado,
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid='public.crm_company_relationships'::regclass
                     and c.conname='crm_company_relationships_company_id_fkey'),'(ausente)') as obtido
  union all
  select 'chave','responsible_seller_id referencia sellers',
         'FOREIGN KEY (responsible_seller_id) REFERENCES sellers(id)',
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid='public.crm_company_relationships'::regclass
                     and c.conname='crm_company_relationships_responsible_seller_id_fkey'),'(ausente)')
),
idx_esperados (nome) as (
  values ('crm_company_rel_company_unique'),('crm_company_rel_seller_idx'),
         ('crm_company_rel_team_idx'),('crm_company_rel_type_idx')
),
idx_check as (
  select 'índice' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_indexes i where i.schemaname='public'
                   and i.tablename='crm_company_relationships' and i.indexname=e.nome),'(ausente)') as obtido
  from idx_esperados e
),
-- Sem o único em company_id, o 1:1 de D-014 seria convenção, não garantia.
idx_unico as (
  select 'índice' as secao, 'company_id é ÚNICO — o 1:1 de D-014' as verificacao,
         'true' as esperado,
         coalesce((select indisunique::text from pg_index i
                   join pg_class c on c.oid=i.indexrelid
                   where c.relname='crm_company_rel_company_unique'),'(ausente)') as obtido
),
trg_esperados (nome, funcao) as (
  values ('crm_company_rel_set_updated_at',        'set_updated_at'),
         ('crm_company_rel_enforce_inactivation',  'enforce_inactivation_is_admin'),
         ('crm_company_rel_stamp_status',          'stamp_status_transition'),
         ('crm_company_rel_enforce_reactivation',  'enforce_reactivation_is_admin'),
         ('crm_company_rel_record_status_history', 'write_record_status_relationship')
),
trg_check as (
  select 'trigger' as secao, e.nome as verificacao, e.funcao as esperado,
         coalesce((select p.proname::text from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                   where t.tgrelid='public.crm_company_relationships'::regclass
                     and t.tgname=e.nome and not t.tgisinternal),'(ausente)') as obtido
  from trg_esperados e
),
trg_when as (
  select 'trigger' as secao, 'os três gatilhos de status usam is distinct from' as verificacao,
         '3' as esperado,
         (select count(*)::text from pg_trigger t
          where t.tgrelid='public.crm_company_relationships'::regclass and not t.tgisinternal
            and pg_get_triggerdef(t.oid) ilike '%IS DISTINCT FROM%') as obtido
),
fn_check as (
  select 'função' as secao, 'write_record_status_relationship é security definer' as verificacao,
         'true' as esperado,
         coalesce((select prosecdef::text from pg_proc
                   where proname='write_record_status_relationship'
                     and pronamespace='public'::regnamespace),'(ausente)') as obtido
  union all
  select 'função','write_record_status_relationship com search_path fixo','search_path=public',
         coalesce((select array_to_string(proconfig,',') from pg_proc
                   where proname='write_record_status_relationship'
                     and pronamespace='public'::regnamespace),'(nenhum)')
  union all
  select 'função','execute revogado de PUBLIC e de authenticated','sem execute, sem execute',
         coalesce((select
             case when has_function_privilege('public','public.write_record_status_relationship()','execute')
                  then 'com execute' else 'sem execute' end || ', ' ||
             case when has_function_privilege('authenticated','public.write_record_status_relationship()','execute')
                  then 'com execute' else 'sem execute' end),'(ausente)')
),
rls_check as (
  select 'RLS' as secao, 'row level security ligada' as verificacao, 'true' as esperado,
         (select relrowsecurity::text from pg_class
          where oid='public.crm_company_relationships'::regclass) as obtido
),
pol_check as (
  select 'policy' as secao, 'três policies: select, insert, update' as verificacao,
         'crm_company_rel_insert/a, crm_company_rel_select/r, crm_company_rel_update/w' as esperado,
         coalesce((select string_agg(polname||'/'||polcmd::text, ', ' order by polname)
                   from pg_policy where polrelid='public.crm_company_relationships'::regclass),'(nenhuma)') as obtido
  union all
  select 'policy','nenhuma policy de DELETE','(nenhuma)',
         coalesce((select string_agg(polname,', ') from pg_policy
                   where polrelid='public.crm_company_relationships'::regclass and polcmd='d'),'(nenhuma)')
),
-- ===========================================================================
-- O RECORTE — a checagem que fecha D-018.
--
-- As TRÊS policies precisam do predicado. Uma policy de UPDATE sem recorte
-- deixaria o consultor reatribuir para si um relacionamento fora do escopo, e o
-- SELECT recortado esconderia a operação depois de feita.
-- ===========================================================================
recorte as (
  select 'recorte' as secao, 'as três policies chamam scoped_seller_ids' as verificacao,
         '3' as esperado,
         (select count(*)::text from pg_policy
          where polrelid='public.crm_company_relationships'::regclass
            and (coalesce(pg_get_expr(polqual,polrelid),'') ilike '%scoped_seller_ids%'
              or coalesce(pg_get_expr(polwithcheck,polrelid),'') ilike '%scoped_seller_ids%')) as obtido
  union all
  select 'recorte','o predicado incide sobre responsible_seller_id','3',
         (select count(*)::text from pg_policy
          where polrelid='public.crm_company_relationships'::regclass
            and (coalesce(pg_get_expr(polqual,polrelid),'') ilike '%responsible_seller_id%'
              or coalesce(pg_get_expr(polwithcheck,polrelid),'') ilike '%responsible_seller_id%'))
  union all
  -- Sem este ramo, relacionamento importado e ainda não distribuído sumiria de
  -- todo mundo — inclusive de quem precisa distribuí-lo (§5.3).
  select 'recorte','ramo de gestão para responsável nulo','3',
         (select count(*)::text from pg_policy
          where polrelid='public.crm_company_relationships'::regclass
            and (coalesce(pg_get_expr(polqual,polrelid),'') ilike '%has_role%'
              or coalesce(pg_get_expr(polwithcheck,polrelid),'') ilike '%has_role%'))
),
-- ===== asserções de ausência da etapa (D-038) =====
etapa_contatos as (
  select 'etapa 5' as secao, 'crm_contacts ainda NÃO existe (é da 0015)' as verificacao,
         'ausente' as esperado,
         case when to_regclass('public.crm_contacts') is null then 'ausente' else 'PRESENTE' end as obtido
),
etapa_demandas as (
  select 'etapa 5' as secao, 'o vínculo de demanda ainda NÃO existe (é da 0014)' as verificacao,
         'ausente' as esperado,
         case when to_regclass('public.crm_accreditation_demands') is null
              then 'ausente' else 'PRESENTE' end as obtido
),
etapa_marcadores as (
  select 'etapa 5' as secao, 'companies ainda SEM is_merchant/is_client_company (0014)' as verificacao,
         '(nenhuma)' as esperado,
         coalesce((select string_agg(attname::text,', ' order by attname) from pg_attribute
                   where attrelid='public.companies'::regclass and not attisdropped
                     and attname in ('is_merchant','is_client_company')),'(nenhuma)') as obtido
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from col_check union all select * from col_extra union all select * from sem_portfolio
  union all select * from enum_check union all select * from fk_check
  union all select * from idx_check union all select * from idx_unico
  union all select * from trg_check union all select * from trg_when
  union all select * from fn_check union all select * from rls_check
  union all select * from pol_check union all select * from recorte
  union all select * from etapa_contatos union all select * from etapa_demandas
  union all select * from etapa_marcadores
) todas
order by case secao when 'coluna' then 1 when 'tipo' then 2 when 'chave' then 3
                    when 'índice' then 4 when 'trigger' then 5 when 'função' then 6
                    when 'RLS' then 7 when 'policy' then 8 when 'recorte' then 9
                    else 10 end, verificacao;
