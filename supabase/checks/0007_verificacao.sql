-- Verificação da migration 0007 — somente leitura, não altera nada.
-- Toda linha deve sair com status OK.

with
tabelas (nome) as (values ('directors'),('managers'),('teams'),('sellers')),
col_check as (
  select 'coluna' as secao,
         t.nome || '.source_ref' as verificacao,
         'text / aceita nulo=sim' as esperado,
         coalesce((select format_type(a.atttypid,null)::text
                          || ' / aceita nulo=' || case when a.attnotnull then 'nao' else 'sim' end
                   from pg_attribute a
                   where a.attrelid = ('public.'||t.nome)::regclass
                     and a.attname='source_ref' and not a.attisdropped),
                  '(coluna ausente)') as obtido
  from tabelas t
),
-- O índice precisa ser ÚNICO e PARCIAL. Único sem ser parcial funcionaria hoje
-- (o Postgres trata nulos como distintos), mas não declara a intenção e indexa
-- linhas que nunca serão consultadas por essa chave.
idx_check as (
  select 'índice' as secao,
         t.nome || '_source_ref_unique' as verificacao,
         'UNIQUE, parcial sobre não nulos' as esperado,
         coalesce((select case
                     when i.indisunique and pg_get_expr(i.indpred, i.indrelid) is not null
                       then 'UNIQUE, parcial sobre não nulos'
                     when i.indisunique then 'UNIQUE mas NÃO parcial'
                     else 'NÃO é único' end
                   from pg_index i join pg_class c on c.oid=i.indexrelid
                   where c.relname = t.nome || '_source_ref_unique'
                     and c.relnamespace='public'::regnamespace),
                  '(índice ausente)') as obtido
  from tabelas t
),
idx_pred as (
  select 'índice' as secao,
         t.nome || ' — condição do índice parcial' as verificacao,
         '(source_ref IS NOT NULL)' as esperado,
         coalesce((select pg_get_expr(i.indpred, i.indrelid)
                   from pg_index i join pg_class c on c.oid=i.indexrelid
                   where c.relname = t.nome || '_source_ref_unique'
                     and c.relnamespace='public'::regnamespace),
                  '(sem condição)') as obtido
  from tabelas t
),
-- A 0007 não pode ter mexido no que as anteriores estabeleceram.
regressao as (
  select 'regressão' as secao, 'as quatro seguem com RLS ligada' as verificacao,
         'directors, managers, sellers, teams' as esperado,
         coalesce((select string_agg(relname::text,', ' order by relname) from pg_class
                   where relname in ('directors','managers','sellers','teams')
                     and relnamespace='public'::regnamespace and relrowsecurity),'(nenhuma)') as obtido
  union all
  select 'regressão','nenhuma policy de DELETE apareceu','(nenhuma)',
         coalesce((select string_agg(c.relname||'.'||p.polname,', ') from pg_policy p
                   join pg_class c on c.oid=p.polrelid
                   where c.relname in ('directors','managers','sellers','teams')
                     and p.polcmd='d'),'(nenhuma)')
  union all
  select 'regressão','a FK circular teams -> managers segue única','1',
         (select count(*)::text from pg_constraint
          where conname='teams_current_manager_id_fkey' and conrelid='public.teams'::regclass)
  union all
  select 'regressão','sellers segue sem manager_id','ausente',
         case when exists (select 1 from pg_attribute where attrelid='public.sellers'::regclass
                             and attname='manager_id' and not attisdropped)
              then 'PRESENTE' else 'ausente' end
  union all
  select 'regressão','managers segue sem team_id','ausente',
         case when exists (select 1 from pg_attribute where attrelid='public.managers'::regclass
                             and attname='team_id' and not attisdropped)
              then 'PRESENTE' else 'ausente' end
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from col_check union all select * from idx_check
  union all select * from idx_pred union all select * from regressao
) todas
order by case secao when 'coluna' then 1 when 'índice' then 2 else 3 end, verificacao;
