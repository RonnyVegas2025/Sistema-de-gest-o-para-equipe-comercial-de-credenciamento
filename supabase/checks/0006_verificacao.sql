-- Verificação da migration 0006 — somente leitura, não altera nada.
-- Fecha a etapa 6: confere sellers E o conjunto das quatro entidades.
-- Toda linha deve sair com status OK.

with
col_esperadas (nome, tipo, nulo, padrao) as (
  values
    ('id',         'uuid',                     'nao', 'gen_random_uuid()'),
    ('full_name',  'text',                     'nao', '(nenhum)'),
    ('email',      'text',                     'sim', '(nenhum)'),
    ('phone',      'text',                     'sim', '(nenhum)'),
    ('mobile',     'text',                     'sim', '(nenhum)'),
    ('team_id',    'uuid',                     'sim', '(nenhum)'),
    ('profile_id', 'uuid',                     'sim', '(nenhum)'),
    ('status',     'entity_status',            'nao', '''ativo''::entity_status'),
    ('joined_at',  'date',                     'sim', '(nenhum)'),
    ('left_at',    'date',                     'sim', '(nenhum)'),
    ('created_at', 'timestamp with time zone', 'nao', 'now()'),
    ('updated_at', 'timestamp with time zone', 'nao', 'now()'),
    ('created_by', 'uuid',                     'sim', 'auth.uid()'),
    ('updated_by', 'uuid',                     'sim', '(nenhum)')
),
col_reais as (
  select a.attname::text as nome, format_type(a.atttypid,null)::text as tipo,
         case when a.attnotnull then 'nao' else 'sim' end as nulo,
         coalesce(pg_get_expr(d.adbin,d.adrelid),'(nenhum)') as padrao
  from pg_attribute a
  left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.sellers'::regclass and a.attnum>0 and not a.attisdropped
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
sem_manager as (
  select 'coluna' as secao, 'sellers NÃO tem manager_id' as verificacao, 'ausente' as esperado,
         case when exists (select 1 from pg_attribute where attrelid='public.sellers'::regclass
                             and attname='manager_id' and not attisdropped)
              then 'PRESENTE — espelho do que a equipe já diz' else 'ausente' end as obtido
),
fk_check as (
  select 'chave' as secao, 'team_id referencia teams' as verificacao,
         'FOREIGN KEY (team_id) REFERENCES teams(id)' as esperado,
         coalesce((select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid='public.sellers'::regclass
                     and c.conname='sellers_team_id_fkey'),'(ausente)') as obtido
  union all
  select 'chave','team_id e profile_id são nuláveis','sim, sim',
         coalesce((select string_agg(case when a.attnotnull then 'nao' else 'sim' end,', ' order by a.attname)
                   from pg_attribute a where a.attrelid='public.sellers'::regclass
                     and a.attname in ('profile_id','team_id') and not a.attisdropped),'(ausente)')
),
idx_esperados (nome) as (
  values ('sellers_status_idx'),('sellers_team_idx'),('sellers_profile_idx')
),
idx_check as (
  select 'índice' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_indexes i where i.schemaname='public'
                   and i.tablename='sellers' and i.indexname=e.nome),'(ausente)') as obtido
  from idx_esperados e
),
trg_check as (
  select 'trigger' as secao, 'sellers_set_updated_at' as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_trigger where tgname='sellers_set_updated_at'
                   and tgrelid='public.sellers'::regclass and not tgisinternal),'(ausente)') as obtido
  union all
  select 'trigger','sellers usa a função de ADMIN','enforce_inactivation_is_admin',
         coalesce((select p.proname::text from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                   where t.tgrelid='public.sellers'::regclass
                     and t.tgname='sellers_enforce_inactivation'),'(ausente)')
),
rls_check as (
  select 'RLS' as secao, 'row level security ligada em sellers' as verificacao, 'true' as esperado,
         (select relrowsecurity::text from pg_class where oid='public.sellers'::regclass) as obtido
),
pol_check as (
  select 'policy' as secao, 'três policies: select, insert, update' as verificacao,
         'sellers_insert/a, sellers_select/r, sellers_update/w' as esperado,
         coalesce((select string_agg(polname||'/'||polcmd::text,', ' order by polname)
                   from pg_policy where polrelid='public.sellers'::regclass),'(nenhuma)') as obtido
  union all
  select 'policy','nenhuma policy de DELETE','(nenhuma)',
         coalesce((select string_agg(polname,', ') from pg_policy
                   where polrelid='public.sellers'::regclass and polcmd='d'),'(nenhuma)')
),
-- ===== fechamento da etapa 6: o conjunto das quatro entidades =====
fecha_rls as (
  select 'etapa 6' as secao, 'as quatro entidades com RLS ligada' as verificacao,
         'directors, managers, sellers, teams' as esperado,
         coalesce((select string_agg(relname::text, ', ' order by relname) from pg_class
                   where relname in ('directors','managers','sellers','teams')
                     and relnamespace='public'::regnamespace and relrowsecurity),'(nenhuma)') as obtido
),
fecha_delete as (
  select 'etapa 6' as secao, 'nenhuma policy de DELETE em nenhuma delas' as verificacao,
         '(nenhuma)' as esperado,
         coalesce((select string_agg(c.relname||'.'||p.polname,', ') from pg_policy p
                   join pg_class c on c.oid=p.polrelid
                   where c.relname in ('directors','managers','sellers','teams')
                     and p.polcmd='d'),'(nenhuma)') as obtido
),
fecha_trg as (
  select 'etapa 6' as secao, 'as quatro têm trigger de inativação de ADMIN' as verificacao,
         '4' as esperado,
         (select count(*)::text from pg_trigger t
          join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
          where c.relname in ('directors','managers','sellers','teams')
            and p.proname='enforce_inactivation_is_admin' and not t.tgisinternal) as obtido
),
fecha_updated as (
  select 'etapa 6' as secao, 'as quatro têm trigger de updated_at' as verificacao, '4' as esperado,
         (select count(*)::text from pg_trigger t
          join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
          where c.relname in ('directors','managers','sellers','teams')
            and p.proname='set_updated_at' and not t.tgisinternal) as obtido
),
fecha_source as (
  select 'etapa 6' as secao, 'source_ref ainda NÃO existe (é da 0007)' as verificacao,
         '(nenhuma)' as esperado,
         coalesce((select string_agg(c.relname::text,', ') from pg_attribute a
                   join pg_class c on c.oid=a.attrelid
                   where c.relname in ('directors','managers','sellers','teams')
                     and a.attname='source_ref' and not a.attisdropped),'(nenhuma)') as obtido
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from col_check union all select * from col_extra union all select * from sem_manager
  union all select * from fk_check union all select * from idx_check
  union all select * from trg_check union all select * from rls_check
  union all select * from pol_check union all select * from fecha_rls
  union all select * from fecha_delete union all select * from fecha_trg
  union all select * from fecha_updated union all select * from fecha_source
) todas
order by case secao when 'coluna' then 1 when 'chave' then 2 when 'índice' then 3
                    when 'trigger' then 4 when 'RLS' then 5 when 'policy' then 6
                    else 7 end, verificacao;
