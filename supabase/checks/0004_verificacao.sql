-- Verificação da migration 0004 — somente leitura, não altera nada.
-- Toda linha deve sair com status OK.

with
col_esperadas (nome, tipo, nulo, padrao) as (
  values
    ('id',          'uuid',                     'nao', 'gen_random_uuid()'),
    ('full_name',   'text',                     'nao', '(nenhum)'),
    ('email',       'text',                     'sim', '(nenhum)'),
    ('profile_id',  'uuid',                     'sim', '(nenhum)'),
    ('status',      'entity_status',            'nao', '''ativo''::entity_status'),
    ('active_from', 'date',                     'sim', '(nenhum)'),
    ('active_to',   'date',                     'sim', '(nenhum)'),
    ('created_at',  'timestamp with time zone', 'nao', 'now()'),
    ('updated_at',  'timestamp with time zone', 'nao', 'now()'),
    ('created_by',  'uuid',                     'sim', 'auth.uid()'),
    ('updated_by',  'uuid',                     'sim', '(nenhum)')
),
col_reais as (
  select a.attname::text as nome, format_type(a.atttypid,null)::text as tipo,
         case when a.attnotnull then 'nao' else 'sim' end as nulo,
         coalesce(pg_get_expr(d.adbin,d.adrelid),'(nenhum)') as padrao
  from pg_attribute a
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.directors'::regclass and a.attnum>0 and not a.attisdropped
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
-- D-004: profile_id NULÁVEL — a pessoa da operação pode não ter conta.
nulavel as (
  select 'chave' as secao, 'profile_id é nulável (D-004)' as verificacao, 'sim' as esperado,
         coalesce((select case when a.attnotnull then 'nao' else 'sim' end
                   from pg_attribute a where a.attrelid='public.directors'::regclass
                     and a.attname='profile_id' and not a.attisdropped),'(ausente)') as obtido
),
fk_check as (
  select 'chave' as secao, 'profile_id referencia profiles' as verificacao,
         'FOREIGN KEY (profile_id) REFERENCES profiles(id)' as esperado,
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid='public.directors'::regclass and c.contype='f'
                     and c.conname='directors_profile_id_fkey'),'(ausente)') as obtido
),
idx_esperados (nome) as (values ('directors_status_idx'),('directors_profile_idx')),
idx_check as (
  select 'índice' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_indexes i where i.schemaname='public'
                   and i.tablename='directors' and i.indexname=e.nome),'(ausente)') as obtido
  from idx_esperados e
),
trg_esperados (nome) as (values ('directors_set_updated_at'),('directors_enforce_inactivation')),
trg_check as (
  select 'trigger' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_trigger t where t.tgname=e.nome
                   and t.tgrelid='public.directors'::regclass and not t.tgisinternal),'(ausente)') as obtido
  from trg_esperados e
),
trg_qual as (
  select 'trigger' as secao, 'directors usa a função de ADMIN' as verificacao,
         'enforce_inactivation_is_admin' as esperado,
         coalesce((select p.proname::text from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                   where t.tgrelid='public.directors'::regclass
                     and t.tgname='directors_enforce_inactivation'),'(ausente)') as obtido
),
rls_check as (
  select 'RLS' as secao, 'row level security ligada em directors' as verificacao, 'true' as esperado,
         (select relrowsecurity::text from pg_class where oid='public.directors'::regclass) as obtido
),
pol_check as (
  select 'policy' as secao, 'três policies: select, insert, update' as verificacao,
         'directors_insert/a, directors_select/r, directors_update/w' as esperado,
         coalesce((select string_agg(polname||'/'||polcmd::text, ', ' order by polname)
                   from pg_policy where polrelid='public.directors'::regclass),'(nenhuma)') as obtido
  union all
  select 'policy','nenhuma policy de DELETE','(nenhuma)',
         coalesce((select string_agg(polname,', ') from pg_policy
                   where polrelid='public.directors'::regclass and polcmd='d'),'(nenhuma)')
  union all
  select 'policy','escrita restrita a gestor e administrador','has_role(VARIADIC ARRAY[''administrador''::app_role, ''gestor_adm''::app_role])',
         coalesce((select pg_get_expr(polwithcheck,polrelid) from pg_policy
                   where polrelid='public.directors'::regclass and polname='directors_insert'),'(ausente)')
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from col_check union all select * from col_extra
  union all select * from nulavel union all select * from fk_check
  union all select * from idx_check union all select * from trg_check
  union all select * from trg_qual union all select * from rls_check
  union all select * from pol_check
) todas
order by case secao when 'coluna' then 1 when 'chave' then 2 when 'índice' then 3
                    when 'trigger' then 4 when 'RLS' then 5 else 6 end, verificacao;
