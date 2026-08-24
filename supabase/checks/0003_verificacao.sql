-- Verificação da migration 0003 — somente leitura, não altera nada.
-- Toda linha deve sair com status OK.

with
enum_check as (
  select 'enum' as secao, 'entity_status tem ativo e inativo' as verificacao,
         'ativo,inativo' as esperado,
         coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder)
                   from pg_type t join pg_enum e on e.enumtypid=t.oid
                   where t.typname='entity_status' and t.typnamespace='public'::regnamespace),
                  '(enum ausente)') as obtido
),
col_esperadas (nome, tipo, nulo, padrao) as (
  values
    ('id',                 'uuid',                     'nao', 'gen_random_uuid()'),
    ('name',               'text',                     'nao', '(nenhum)'),
    ('description',        'text',                     'sim', '(nenhum)'),
    ('current_manager_id', 'uuid',                     'sim', '(nenhum)'),
    ('conta_na_meta',      'boolean',                  'nao', 'true'),
    ('status',             'entity_status',            'nao', '''ativo''::entity_status'),
    ('valid_from',         'date',                     'sim', '(nenhum)'),
    ('valid_to',           'date',                     'sim', '(nenhum)'),
    ('created_at',         'timestamp with time zone', 'nao', 'now()'),
    ('updated_at',         'timestamp with time zone', 'nao', 'now()'),
    ('created_by',         'uuid',                     'sim', 'auth.uid()'),
    ('updated_by',         'uuid',                     'sim', '(nenhum)')
),
col_reais as (
  select a.attname::text as nome, format_type(a.atttypid,null)::text as tipo,
         case when a.attnotnull then 'nao' else 'sim' end as nulo,
         coalesce(pg_get_expr(d.adbin,d.adrelid),'(nenhum)') as padrao
  from pg_attribute a
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.teams'::regclass and a.attnum>0 and not a.attisdropped
),
col_check as (
  select 'coluna' as secao, e.nome as verificacao,
         e.tipo||' / aceita nulo='||e.nulo||' / default='||e.padrao as esperado,
         coalesce(r.tipo||' / aceita nulo='||r.nulo||' / default='||r.padrao,'(coluna ausente)') as obtido
  from col_esperadas e left join col_reais r on r.nome=e.nome
),
col_extra as (
  select 'coluna','nenhuma coluna a mais nesta etapa','(nenhuma)',
         coalesce(string_agg(r.nome,', ' order by r.nome),'(nenhuma)')
  from col_reais r where r.nome not in (select nome from col_esperadas)
),
-- current_manager_id NÃO pode ter FK ainda: managers só nasce na 0005.
fk_check as (
  select 'chave' as secao, 'current_manager_id ainda SEM FK (fecha na 0005)' as verificacao,
         '(nenhuma)' as esperado,
         coalesce((select string_agg(c.conname,', ') from pg_constraint c
                   where c.conrelid='public.teams'::regclass and c.contype='f'
                     and 'current_manager_id' = any (
                       select a.attname from pg_attribute a
                       where a.attrelid=c.conrelid and a.attnum = any(c.conkey))),
                  '(nenhuma)') as obtido
),
idx_esperados (nome) as (values ('teams_status_idx'),('teams_current_manager_idx')),
idx_check as (
  select 'índice' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_indexes i where i.schemaname='public'
                   and i.tablename='teams' and i.indexname=e.nome),'(ausente)') as obtido
  from idx_esperados e
),
fn_esperadas (nome) as (
  values ('enforce_inactivation_is_admin'),('enforce_inactivation_is_manager_or_admin')
),
fn_check as (
  select 'função' as secao, e.nome as verificacao, 'existe com search_path fixo' as esperado,
         coalesce((select case when coalesce(array_to_string(p.proconfig,','),'') like '%search_path=public%'
                               then 'existe com search_path fixo' else 'search_path NAO fixo' end
                   from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=e.nome),
                  '(função ausente)') as obtido
  from fn_esperadas e
),
-- As duas funções precisam usar `is distinct from`; com `<>` a barreira falha
-- em silêncio quando old.status é nulo.
fn_distinct as (
  select 'função' as secao, 'as duas usam is distinct from, não <>' as verificacao,
         'ambas' as esperado,
         case when pg_get_functiondef('public.enforce_inactivation_is_admin()'::regprocedure) like '%is distinct from%'
              and pg_get_functiondef('public.enforce_inactivation_is_manager_or_admin()'::regprocedure) like '%is distinct from%'
              then 'ambas' else 'alguma usa <>' end as obtido
),
trg_esperados (nome) as (values ('teams_set_updated_at'),('teams_enforce_inactivation')),
trg_check as (
  select 'trigger' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_trigger t where t.tgname=e.nome
                   and t.tgrelid='public.teams'::regclass and not t.tgisinternal),'(ausente)') as obtido
  from trg_esperados e
),
trg_qual as (
  select 'trigger' as secao, 'teams usa a função de ADMIN, não a de gestor' as verificacao,
         'enforce_inactivation_is_admin' as esperado,
         coalesce((select p.proname::text from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                   where t.tgrelid='public.teams'::regclass and t.tgname='teams_enforce_inactivation'),
                  '(ausente)') as obtido
),
rls_check as (
  select 'RLS' as secao, 'row level security ligada em teams' as verificacao, 'true' as esperado,
         (select relrowsecurity::text from pg_class where oid='public.teams'::regclass) as obtido
),
pol_check as (
  select 'policy' as secao, 'três policies: select, insert, update' as verificacao,
         'teams_insert/a, teams_select/r, teams_update/w' as esperado,
         coalesce((select string_agg(polname||'/'||polcmd::text, ', ' order by polname)
                   from pg_policy where polrelid='public.teams'::regclass),'(nenhuma)') as obtido
  union all
  select 'policy','nenhuma policy de DELETE','(nenhuma)',
         coalesce((select string_agg(polname,', ') from pg_policy
                   where polrelid='public.teams'::regclass and polcmd='d'),'(nenhuma)')
  union all
  select 'policy','leitura exige perfil, não apenas JWT','(auth_role() IS NOT NULL)',
         coalesce((select pg_get_expr(polqual,polrelid) from pg_policy
                   where polrelid='public.teams'::regclass and polname='teams_select'),'(ausente)')
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from enum_check union all select * from col_check union all select * from col_extra
  union all select * from fk_check union all select * from idx_check
  union all select * from fn_check union all select * from fn_distinct
  union all select * from trg_check union all select * from trg_qual
  union all select * from rls_check union all select * from pol_check
) todas
order by case secao when 'enum' then 1 when 'coluna' then 2 when 'chave' then 3
                    when 'índice' then 4 when 'função' then 5 when 'trigger' then 6
                    when 'RLS' then 7 else 8 end, verificacao;
