-- Verificação da migration 0005 — somente leitura, não altera nada.
-- Toda linha deve sair com status OK.

with
col_esperadas (nome, tipo, nulo, padrao) as (
  values
    ('id',          'uuid',                     'nao', 'gen_random_uuid()'),
    ('full_name',   'text',                     'nao', '(nenhum)'),
    ('email',       'text',                     'sim', '(nenhum)'),
    ('role_title',  'text',                     'sim', '(nenhum)'),
    ('mobile',      'text',                     'sim', '(nenhum)'),
    ('phone',       'text',                     'sim', '(nenhum)'),
    ('director_id', 'uuid',                     'sim', '(nenhum)'),
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
  where a.attrelid='public.managers'::regclass and a.attnum>0 and not a.attisdropped
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
-- D-017: a coluna vestigial do sistema de origem NÃO é replicada.
sem_team_id as (
  select 'coluna' as secao, 'managers NÃO tem team_id (D-017)' as verificacao,
         'ausente' as esperado,
         case when exists (select 1 from pg_attribute
                           where attrelid='public.managers'::regclass
                             and attname='team_id' and not attisdropped)
              then 'PRESENTE — vestigial replicada' else 'ausente' end as obtido
),
-- O fechamento da FK circular é o coração desta migration.
fk_circular as (
  select 'chave' as secao, 'FK circular teams -> managers fechada' as verificacao,
         'FOREIGN KEY (current_manager_id) REFERENCES managers(id)' as esperado,
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid='public.teams'::regclass
                     and c.conname='teams_current_manager_id_fkey'),'(ausente)') as obtido
  union all
  select 'chave', 'a constraint circular não foi duplicada', '1',
         (select count(*)::text from pg_constraint
          where conname='teams_current_manager_id_fkey' and conrelid='public.teams'::regclass)
  union all
  select 'chave', 'director_id referencia directors',
         'FOREIGN KEY (director_id) REFERENCES directors(id)',
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid='public.managers'::regclass
                     and c.conname='managers_director_id_fkey'),'(ausente)')
  union all
  select 'chave', 'director_id e profile_id são nuláveis (D-004)', 'sim, sim',
         coalesce((select string_agg(case when a.attnotnull then 'nao' else 'sim' end, ', '
                                     order by a.attname)
                   from pg_attribute a where a.attrelid='public.managers'::regclass
                     and a.attname in ('director_id','profile_id') and not a.attisdropped),'(ausente)')
),
idx_esperados (nome) as (
  values ('managers_status_idx'),('managers_director_idx'),('managers_profile_idx')
),
idx_check as (
  select 'índice' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_indexes i where i.schemaname='public'
                   and i.tablename='managers' and i.indexname=e.nome),'(ausente)') as obtido
  from idx_esperados e
),
trg_esperados (nome) as (values ('managers_set_updated_at'),('managers_enforce_inactivation')),
trg_check as (
  select 'trigger' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_trigger t where t.tgname=e.nome
                   and t.tgrelid='public.managers'::regclass and not t.tgisinternal),'(ausente)') as obtido
  from trg_esperados e
),
trg_qual as (
  select 'trigger' as secao, 'managers usa a função de ADMIN' as verificacao,
         'enforce_inactivation_is_admin' as esperado,
         coalesce((select p.proname::text from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                   where t.tgrelid='public.managers'::regclass
                     and t.tgname='managers_enforce_inactivation'),'(ausente)') as obtido
),
rls_check as (
  select 'RLS' as secao, 'row level security ligada em managers' as verificacao, 'true' as esperado,
         (select relrowsecurity::text from pg_class where oid='public.managers'::regclass) as obtido
),
pol_check as (
  select 'policy' as secao, 'três policies: select, insert, update' as verificacao,
         'managers_insert/a, managers_select/r, managers_update/w' as esperado,
         coalesce((select string_agg(polname||'/'||polcmd::text, ', ' order by polname)
                   from pg_policy where polrelid='public.managers'::regclass),'(nenhuma)') as obtido
  union all
  select 'policy','nenhuma policy de DELETE','(nenhuma)',
         coalesce((select string_agg(polname,', ') from pg_policy
                   where polrelid='public.managers'::regclass and polcmd='d'),'(nenhuma)')
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from col_check union all select * from col_extra union all select * from sem_team_id
  union all select * from fk_circular union all select * from idx_check
  union all select * from trg_check union all select * from trg_qual
  union all select * from rls_check union all select * from pol_check
) todas
order by case secao when 'coluna' then 1 when 'chave' then 2 when 'índice' then 3
                    when 'trigger' then 4 when 'RLS' then 5 else 6 end, verificacao;
