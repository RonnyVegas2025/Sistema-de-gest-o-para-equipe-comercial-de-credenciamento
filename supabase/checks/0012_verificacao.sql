-- Verificação da migration 0012 — somente leitura, não altera nada.
-- Abre a Sprint 2: confere companies, sua trilha e o que ainda NÃO deve existir.
-- Toda linha deve sair com status OK.

with
col_esperadas (nome, tipo, nulo, padrao) as (
  values
    ('id',                      'uuid',                     'nao', 'gen_random_uuid()'),
    ('legal_name',              'text',                     'nao', '(nenhum)'),
    ('trade_name',              'text',                     'sim', '(nenhum)'),
    ('cnpj',                    'text',                     'sim', '(nenhum)'),
    ('legacy_customer_code',    'text',                     'sim', '(nenhum)'),
    ('parent_company_id',       'uuid',                     'sim', '(nenhum)'),
    ('relationship_start_date', 'date',                     'sim', '(nenhum)'),
    ('status',                  'entity_status',            'nao', '''ativo''::entity_status'),
    ('situacao_cadastral',      'text',                     'sim', '(nenhum)'),
    ('cnae_principal',          'text',                     'sim', '(nenhum)'),
    ('atividade',               'text',                     'sim', '(nenhum)'),
    ('cep',                     'text',                     'sim', '(nenhum)'),
    ('logradouro',              'text',                     'sim', '(nenhum)'),
    ('numero',                  'text',                     'sim', '(nenhum)'),
    ('complemento',             'text',                     'sim', '(nenhum)'),
    ('bairro',                  'text',                     'sim', '(nenhum)'),
    ('municipio',               'text',                     'sim', '(nenhum)'),
    ('uf',                      'text',                     'sim', '(nenhum)'),
    ('telefone',                'text',                     'sim', '(nenhum)'),
    ('cnpj_lookup_at',          'timestamp with time zone', 'sim', '(nenhum)'),
    ('cnpj_lookup_source',      'text',                     'sim', '(nenhum)'),
    ('latitude',                'numeric(10,7)',            'sim', '(nenhum)'),
    ('longitude',               'numeric(10,7)',            'sim', '(nenhum)'),
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
  where a.attrelid = 'public.companies'::regclass and a.attnum > 0 and not a.attisdropped
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
-- D-006: identidade não tem dono. Se um dia aparecer uma coluna de responsável
-- aqui, o recorte terá sido movido para o lugar errado.
sem_responsavel as (
  select 'coluna' as secao, 'companies NÃO tem coluna de responsável (D-006)' as verificacao,
         '(nenhuma)' as esperado,
         coalesce((select string_agg(attname::text, ', ' order by attname)
                   from pg_attribute
                   where attrelid = 'public.companies'::regclass and not attisdropped
                     and attname in ('responsible_seller_id','seller_id','owner_id','manager_id')),
                  '(nenhuma)') as obtido
),
-- D-004: o CRM é fonte de verdade de companies. A ausência é decisão.
sem_source_ref as (
  select 'coluna' as secao, 'companies NÃO tem source_ref (D-004)' as verificacao,
         'ausente' as esperado,
         case when exists (select 1 from pg_attribute
                           where attrelid = 'public.companies'::regclass
                             and attname = 'source_ref' and not attisdropped)
              then 'PRESENTE — sugere origem externa que não existe' else 'ausente' end as obtido
),
chk_check as (
  select 'chave' as secao, 'CNPJ canônico: 14 dígitos (D-039)' as verificacao,
         'CHECK (((cnpj IS NULL) OR (cnpj ~ ''^[0-9]{14}$''::text)))' as esperado,
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid = 'public.companies'::regclass
                     and c.conname = 'companies_cnpj_canonico'),'(ausente)') as obtido
  union all
  select 'chave','parent_company_id sem ação de delete (D-034)',
         'FOREIGN KEY (parent_company_id) REFERENCES companies(id)',
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid = 'public.companies'::regclass
                     and c.conname = 'companies_parent_company_id_fkey'),'(ausente)')
  union all
  select 'chave','inactivated_by referencia profiles',
         'FOREIGN KEY (inactivated_by) REFERENCES profiles(id)',
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid = 'public.companies'::regclass
                     and c.conname = 'companies_inactivated_by_fkey'),'(ausente)')
),
idx_esperados (nome) as (
  values ('companies_cnpj_active_unique'),('companies_status_idx'),('companies_municipio_uf_idx')
),
idx_check as (
  select 'índice' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_indexes i where i.schemaname='public'
                   and i.tablename='companies' and i.indexname = e.nome),'(ausente)') as obtido
  from idx_esperados e
),
-- O predicado é o que permite inativar e recadastrar o mesmo CNPJ. Sem ele o
-- índice barra o recadastro; com ele errado, deixa de barrar o duplicado ativo.
idx_parcial as (
  select 'índice' as secao, 'unicidade de CNPJ vale só entre ATIVOS' as verificacao,
         'CREATE UNIQUE INDEX companies_cnpj_active_unique ON public.companies USING btree (cnpj) WHERE ((status = ''ativo''::entity_status) AND (cnpj IS NOT NULL))' as esperado,
         coalesce((select indexdef from pg_indexes where schemaname='public'
                   and indexname='companies_cnpj_active_unique'),'(ausente)') as obtido
),
trg_esperados (nome, funcao) as (
  values ('companies_set_updated_at',        'set_updated_at'),
         ('companies_enforce_inactivation',  'enforce_inactivation_is_admin'),
         ('companies_stamp_status',          'stamp_status_transition'),
         ('companies_enforce_reactivation',  'enforce_reactivation_is_admin'),
         ('companies_record_status_history', 'write_record_status_company')
),
trg_check as (
  select 'trigger' as secao, e.nome as verificacao, e.funcao as esperado,
         coalesce((select p.proname::text from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                   where t.tgrelid = 'public.companies'::regclass and t.tgname = e.nome
                     and not t.tgisinternal),'(ausente)') as obtido
  from trg_esperados e
),
-- `is distinct from`, nunca `<>`: com nulo de um dos lados, `<>` devolve nulo e
-- a condição não dispara — a trilha deixaria de gravar em silêncio.
trg_when as (
  select 'trigger' as secao, 'os três gatilhos de status usam is distinct from' as verificacao,
         '3' as esperado,
         (select count(*)::text from pg_trigger t
          where t.tgrelid = 'public.companies'::regclass and not t.tgisinternal
            and pg_get_triggerdef(t.oid) ilike '%IS DISTINCT FROM%') as obtido
),
fn_check as (
  select 'função' as secao, 'write_record_status_company é security definer' as verificacao,
         'true' as esperado,
         coalesce((select prosecdef::text from pg_proc
                   where proname='write_record_status_company'
                     and pronamespace='public'::regnamespace),'(ausente)') as obtido
  union all
  select 'função','write_record_status_company com search_path fixo','search_path=public',
         coalesce((select array_to_string(proconfig,',') from pg_proc
                   where proname='write_record_status_company'
                     and pronamespace='public'::regnamespace),'(nenhum)')
  union all
  -- Os DOIS revokes. Revogar só de authenticated é inócuo: o grant implícito de
  -- PUBLIC sustenta o privilégio e nada dá sinal (RLS_PERMISSOES §5.6).
  select 'função','execute revogado de PUBLIC e de authenticated','sem execute, sem execute',
         coalesce((select
             case when has_function_privilege('public','public.write_record_status_company()','execute')
                  then 'com execute' else 'sem execute' end || ', ' ||
             case when has_function_privilege('authenticated','public.write_record_status_company()','execute')
                  then 'com execute' else 'sem execute' end),'(ausente)')
  union all
  select 'função','o scope company já existia no CHECK da 0008','presente',
         case when (select pg_get_constraintdef(oid) from pg_constraint
                    where conrelid='public.crm_record_status_history'::regclass
                      and contype='c' limit 1) ilike '%company%'
              then 'presente' else 'AUSENTE' end
),
rls_check as (
  select 'RLS' as secao, 'row level security ligada em companies' as verificacao,
         'true' as esperado,
         (select relrowsecurity::text from pg_class where oid='public.companies'::regclass) as obtido
),
pol_check as (
  select 'policy' as secao, 'três policies: select, insert, update' as verificacao,
         'companies_insert/a, companies_select/r, companies_update/w' as esperado,
         coalesce((select string_agg(polname||'/'||polcmd::text, ', ' order by polname)
                   from pg_policy where polrelid='public.companies'::regclass),'(nenhuma)') as obtido
  union all
  select 'policy','nenhuma policy de DELETE','(nenhuma)',
         coalesce((select string_agg(polname,', ') from pg_policy
                   where polrelid='public.companies'::regclass and polcmd='d'),'(nenhuma)')
  union all
  select 'policy','escrita para os quatro papéis operacionais',
         'administrador, gestor_adm, analista_adm, comercial',
         coalesce((select case when pg_get_expr(polwithcheck, polrelid) ilike '%administrador%'
                              and pg_get_expr(polwithcheck, polrelid) ilike '%gestor_adm%'
                              and pg_get_expr(polwithcheck, polrelid) ilike '%analista_adm%'
                              and pg_get_expr(polwithcheck, polrelid) ilike '%comercial%'
                          then 'administrador, gestor_adm, analista_adm, comercial'
                          else 'papéis divergentes: '||pg_get_expr(polwithcheck, polrelid) end
                   from pg_policy where polrelid='public.companies'::regclass
                     and polname='companies_insert'),'(ausente)')
),
-- ===========================================================================
-- A AUSÊNCIA DE RECORTE, REGISTRADA COMO RESULTADO ESPERADO
--
-- A regra de aceite da Sprint 2 exige recorte em toda tabela `crm_*`. Esta
-- linha existe para que a exceção de companies seja LIDA como decisão, e não
-- descoberta como omissão por quem abrir o repositório daqui a seis meses.
--
-- Ela também é uma asserção de verdade: se um dia companies GANHAR recorte, a
-- linha reprova e obriga a revisitar D-006 e §5.2 em vez de deixar acontecer.
-- ===========================================================================
recorte_ausente as (
  select 'recorte' as secao,
         'companies SEM recorte — deliberado (D-006, §5.2, D-024)' as verificacao,
         'sem scoped_seller_ids' as esperado,
         case when exists (
                select 1 from pg_policy
                 where polrelid = 'public.companies'::regclass
                   and (coalesce(pg_get_expr(polqual, polrelid),'') ilike '%scoped_seller_ids%'
                     or coalesce(pg_get_expr(polwithcheck, polrelid),'') ilike '%scoped_seller_ids%'))
              then 'COM scoped_seller_ids — revisitar D-006 antes de manter'
              else 'sem scoped_seller_ids' end as obtido
),
-- ===== asserções de ausência da etapa (D-038) =====
etapa_relacionamento as (
  select 'etapa 3' as secao, 'crm_company_relationships ainda NÃO existe (é da 0013)' as verificacao,
         'ausente' as esperado,
         case when to_regclass('public.crm_company_relationships') is null
              then 'ausente' else 'PRESENTE' end as obtido
),
etapa_contatos as (
  select 'etapa 3' as secao, 'crm_contacts ainda NÃO existe (é da 0014)' as verificacao,
         'ausente' as esperado,
         case when to_regclass('public.crm_contacts') is null
              then 'ausente' else 'PRESENTE' end as obtido
),
etapa_enums as (
  select 'etapa 3' as secao, 'os enums de relacionamento ainda NÃO existem' as verificacao,
         '(nenhum)' as esperado,
         coalesce((select string_agg(typname::text, ', ' order by typname) from pg_type
                   where typname in ('crm_relationship_type','crm_opportunity_origin')),'(nenhum)') as obtido
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from col_check union all select * from col_extra
  union all select * from sem_responsavel union all select * from sem_source_ref
  union all select * from chk_check union all select * from idx_check
  union all select * from idx_parcial union all select * from trg_check
  union all select * from trg_when union all select * from fn_check
  union all select * from rls_check union all select * from pol_check
  union all select * from recorte_ausente
  union all select * from etapa_relacionamento union all select * from etapa_contatos
  union all select * from etapa_enums
) todas
order by case secao when 'coluna' then 1 when 'chave' then 2 when 'índice' then 3
                    when 'trigger' then 4 when 'função' then 5 when 'RLS' then 6
                    when 'policy' then 7 when 'recorte' then 8 else 9 end, verificacao;
