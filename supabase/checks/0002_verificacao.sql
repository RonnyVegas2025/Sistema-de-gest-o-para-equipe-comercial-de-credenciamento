-- Verificação da migration 0002 — somente leitura, não altera nada.
--
-- Cole no SQL Editor DEPOIS de aplicar 0002_profiles_must_change_password.sql.
-- Toda linha deve sair com status OK.

with
col_check as (
  select
    'coluna' as secao,
    'must_change_password' as verificacao,
    'boolean / aceita nulo=nao / default=true' as esperado,
    coalesce(
      (select format_type(a.atttypid, null)::text
              || ' / aceita nulo=' || case when a.attnotnull then 'nao' else 'sim' end
              || ' / default=' || coalesce(pg_get_expr(d.adbin, d.adrelid), '(nenhum)')
       from pg_attribute a
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = 'public.profiles'::regclass
         and a.attname = 'must_change_password'
         and not a.attisdropped),
      '(coluna ausente)') as obtido
),
total_col as (
  select 'coluna' as secao,
         'total de colunas em profiles' as verificacao,
         '8' as esperado,
         (select count(*)::text from pg_attribute
          where attrelid='public.profiles'::regclass and attnum > 0 and not attisdropped) as obtido
),
-- O que a tela /trocar-senha depende: o trigger barra role, is_active e email,
-- e NÃO barra esta coluna. Prova estática — a fonte do trigger não a menciona.
trg_check as (
  select 'trigger' as secao,
         'prevent_profile_tampering NÃO barra must_change_password' as verificacao,
         'não menciona a coluna' as esperado,
         case when pg_get_functiondef('public.prevent_profile_tampering()'::regprocedure)
                   like '%must_change_password%'
              then 'MENCIONA — a troca de senha seria bloqueada'
              else 'não menciona a coluna' end as obtido
),
trg_barra as (
  select 'trigger' as secao,
         'prevent_profile_tampering continua barrando role, is_active e email' as verificacao,
         'barra as três' as esperado,
         case when pg_get_functiondef('public.prevent_profile_tampering()'::regprocedure) like '%new.role%'
               and pg_get_functiondef('public.prevent_profile_tampering()'::regprocedure) like '%new.is_active%'
               and pg_get_functiondef('public.prevent_profile_tampering()'::regprocedure) like '%new.email%'
              then 'barra as três' else 'FALTA alguma' end as obtido
),
-- A 0002 não pode ter mexido no que a 0001 estabeleceu.
rls_check as (
  select 'RLS' as secao,
         'row level security segue ligada' as verificacao,
         'true' as esperado,
         (select relrowsecurity::text from pg_class where oid='public.profiles'::regclass) as obtido
),
pol_check as (
  select 'policy' as secao,
         'segue com 2 policies, nenhuma de INSERT ou DELETE' as verificacao,
         '2 / (nenhuma)' as esperado,
         (select count(*)::text from pg_policy where polrelid='public.profiles'::regclass)
         || ' / ' ||
         coalesce((select string_agg(polname || '/' || polcmd::text, ', ') from pg_policy
                   where polrelid='public.profiles'::regclass and polcmd in ('a','d')), '(nenhuma)') as obtido
),
-- Nenhum perfil pode ter ficado com o flag nulo.
dados as (
  select 'dados' as secao,
         'nenhum perfil com must_change_password nulo' as verificacao,
         '0' as esperado,
         (select count(*)::text from public.profiles where must_change_password is null) as obtido
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from col_check
  union all select * from total_col
  union all select * from trg_check
  union all select * from trg_barra
  union all select * from rls_check
  union all select * from pol_check
  union all select * from dados
) todas
order by
  case secao when 'coluna' then 1 when 'trigger' then 2 when 'RLS' then 3
             when 'policy' then 4 else 5 end,
  verificacao;
