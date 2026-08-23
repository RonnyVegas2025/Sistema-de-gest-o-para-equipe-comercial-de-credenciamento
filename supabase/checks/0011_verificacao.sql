-- Verificação da migration 0011 — somente leitura, não altera nada.
-- Toda linha deve sair com status OK.

with
existe as (
  select 'view' as secao, 'user_directory existe' as verificacao, 'sim' as esperado,
         case when exists (select 1 from pg_class where relname='user_directory'
                             and relnamespace='public'::regnamespace and relkind='v')
              then 'sim' else 'nao' end as obtido
),
-- A SUPERFÍCIE DE EXPOSIÇÃO. Coluna nova aqui alarga a leitura sem alterar
-- policy alguma, e nenhuma revisão de RLS acusaria.
colunas as (
  select 'view' as secao, 'expõe SOMENTE id e full_name' as verificacao,
         'id, full_name' as esperado,
         coalesce((select string_agg(column_name, ', ' order by ordinal_position)
                   from information_schema.columns
                   where table_schema='public' and table_name='user_directory'),'(ausente)') as obtido
),
-- security_invoker = true faria a view respeitar a RLS de profiles, o gestor
-- veria só a própria linha, e o vínculo voltaria a não funcionar.
invoker as (
  select 'view' as secao, 'security_invoker NÃO habilitado' as verificacao,
         'definer (correto para esta view)' as esperado,
         coalesce((select case when array_to_string(c.reloptions, ',') like '%security_invoker=true%'
                          then 'INVOKER — o gestor voltaria a ver só a própria linha'
                          else 'definer (correto para esta view)' end
                   from pg_class c where c.relname='user_directory'
                     and c.relnamespace='public'::regnamespace),'(ausente)') as obtido
),
-- A autorização vive no WHERE, porque GRANT não distingue os papéis do CRM.
predicado as (
  select 'view' as secao, 'o WHERE restringe a gestor e administrador' as verificacao,
         'sim' as esperado,
         case when pg_get_viewdef('public.user_directory'::regclass) like '%has_role%'
               and pg_get_viewdef('public.user_directory'::regclass) like '%administrador%'
               and pg_get_viewdef('public.user_directory'::regclass) like '%gestor_adm%'
              then 'sim' else 'PREDICADO DE PAPEL AUSENTE — qualquer autenticado leria' end as obtido
  union all
  select 'view','o WHERE restringe a perfis ativos','sim',
         case when pg_get_viewdef('public.user_directory'::regclass) like '%is_active%'
              then 'sim' else 'usuário desativado apareceria no select de vínculo' end
),
-- Privilégios
grants as (
  select 'privilégio' as secao, 'anon NÃO tem select' as verificacao, 'negado' as esperado,
         case when has_table_privilege('anon','public.user_directory','SELECT')
              then 'CONCEDIDO' else 'negado' end as obtido
  union all
  select 'privilégio','authenticated tem select','concedido',
         case when has_table_privilege('authenticated','public.user_directory','SELECT')
              then 'concedido' else 'NEGADO — o select de vínculo não carregaria' end
),
-- Regressão: a view não pode ter alterado a RLS de profiles.
regressao as (
  select 'regressão' as secao, 'profiles_select segue sem gestor_adm' as verificacao,
         'sim' as esperado,
         coalesce((select case when pg_get_expr(polqual,polrelid) like '%is_admin%'
                            and pg_get_expr(polqual,polrelid) not like '%gestor_adm%'
                          then 'sim' else 'a policy foi alargada' end
                   from pg_policy where polrelid='public.profiles'::regclass
                     and polname='profiles_select'),'(ausente)') as obtido
  union all
  select 'regressão','profiles segue com 2 policies e RLS ligada','2 / true',
         (select count(*)::text from pg_policy where polrelid='public.profiles'::regclass)
         || ' / ' ||
         (select relrowsecurity::text from pg_class where oid='public.profiles'::regclass)
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from existe union all select * from colunas union all select * from invoker
  union all select * from predicado union all select * from grants
  union all select * from regressao
) todas
order by case secao when 'view' then 1 when 'privilégio' then 2 else 3 end, verificacao;
