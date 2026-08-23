-- Verificação da migration 0009 — somente leitura, não altera nada.
-- Estrutural: confere as funções e os índices que elas exigem.
-- O comportamento é conferido pelo gate de cinco usuários, em arquivo separado.
-- Toda linha deve sair com status OK.

with
fn_esperadas (nome, retorno) as (
  values
    ('current_seller_id','uuid'), ('current_manager_id','uuid'),
    ('current_director_id','uuid'), ('scoped_seller_ids','SETOF uuid')
),
fn_check as (
  select 'função' as secao, e.nome as verificacao,
         'stable + security definer + search_path fixo, retorna ' || e.retorno as esperado,
         coalesce((select case
                     when p.provolatile = 's' and p.prosecdef
                          and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=public%'
                          and pg_get_function_result(p.oid) = e.retorno
                     then 'stable + security definer + search_path fixo, retorna ' || e.retorno
                     when p.provolatile <> 's' then 'NÃO é stable — reavaliada por linha'
                     when not p.prosecdef then 'NÃO é security definer — recursão de RLS'
                     when coalesce(array_to_string(p.proconfig,','),'') not like '%search_path=public%'
                          then 'search_path NÃO fixo'
                     else 'retorna ' || pg_get_function_result(p.oid) end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname=e.nome),'(função ausente)') as obtido
  from fn_esperadas e
),
-- As três de identidade PRECISAM continuar executáveis: as policies as chamam
-- no contexto do usuário. Revogá-las por engano, imitando as de trilha, faria
-- toda policy com recorte falhar.
fn_exec as (
  select 'função' as secao, e.nome || ': execute mantido para authenticated' as verificacao,
         'mantido' as esperado,
         coalesce((select case when has_function_privilege('authenticated', p.oid, 'EXECUTE')
                          then 'mantido' else 'REVOGADO — policies com recorte falhariam' end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname=e.nome),'(ausente)') as obtido
  from fn_esperadas e
),
-- D-005: união, nunca "primeiro papel encontrado". Prova estática — a fonte
-- combina os ramos por UNION e não decide por CASE.
uniao as (
  select 'D-005' as secao, 'scoped_seller_ids combina por UNION' as verificacao,
         'sim' as esperado,
         case when pg_get_functiondef('public.scoped_seller_ids()'::regprocedure) ilike '%union%'
              then 'sim' else 'NÃO usa union' end as obtido
  union all
  select 'D-005','scoped_seller_ids NÃO decide por CASE (primeiro papel)','sim',
         case when pg_get_functiondef('public.scoped_seller_ids()'::regprocedure) ilike '%case%'
              then 'USA CASE — vínculo duplo receberia menos' else 'sim' end
  union all
  select 'D-005','o caminho do gestor passa por teams.current_manager_id','sim',
         case when pg_get_functiondef('public.scoped_seller_ids()'::regprocedure) like '%current_manager_id%'
              and pg_get_functiondef('public.scoped_seller_ids()'::regprocedure) not like '%managers.team_id%'
              then 'sim' else 'usa managers.team_id, que não existe (D-017)' end
  union all
  select 'D-005','os quatro ramos estão presentes','4',
         ((length(pg_get_functiondef('public.scoped_seller_ids()'::regprocedure))
           - length(replace(lower(pg_get_functiondef('public.scoped_seller_ids()'::regprocedure)),
                            'from public.sellers','')))
          / length('from public.sellers'))::text
),
-- §4.3: sem estes índices, cada avaliação de policy vira varredura.
idx_esperados (tabela, nome) as (
  values
    ('sellers','sellers_team_idx'), ('sellers','sellers_profile_idx'),
    ('teams','teams_current_manager_idx'),
    ('managers','managers_director_idx'), ('managers','managers_profile_idx'),
    ('directors','directors_profile_idx')
),
idx_check as (
  select 'índice' as secao, e.nome as verificacao, 'existe' as esperado,
         coalesce((select 'existe' from pg_indexes i where i.schemaname='public'
                   and i.tablename=e.tabela and i.indexname=e.nome),'(ausente)') as obtido
  from idx_esperados e
),
-- Regressão: a 0009 não pode ter mexido no que as anteriores estabeleceram.
regressao as (
  select 'regressão' as secao, 'trilha segue sem policy de INSERT/UPDATE/DELETE' as verificacao,
         '(nenhuma)' as esperado,
         coalesce((select string_agg(polname,', ') from pg_policy
                   where polrelid='public.crm_record_status_history'::regclass
                     and polcmd in ('a','w','d')),'(nenhuma)') as obtido
  union all
  select 'regressão','as quatro funções de trilha seguem com execute revogado','4',
         (select count(*)::text from pg_proc p where p.pronamespace='public'::regnamespace
          and p.proname like 'write_record_status_%'
          and not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  union all
  select 'regressão','as quatro entidades seguem com RLS ligada','directors, managers, sellers, teams',
         coalesce((select string_agg(relname::text,', ' order by relname) from pg_class
                   where relname in ('directors','managers','sellers','teams')
                     and relnamespace='public'::regnamespace and relrowsecurity),'(nenhuma)')
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from fn_check union all select * from fn_exec union all select * from uniao
  union all select * from idx_check union all select * from regressao
) todas
order by case secao when 'função' then 1 when 'D-005' then 2
                    when 'índice' then 3 else 4 end, verificacao;
