-- Verificação da migration 0010 — somente leitura, não altera nada.
-- Toda linha deve sair com status OK.

with
tabelas (nome, escopo) as (
  values ('directors','director'),('managers','manager'),('teams','team'),('sellers','seller')
),
col_check as (
  select 'coluna' as secao, t.nome || '.reactivation_reason' as verificacao,
         'text / aceita nulo=sim' as esperado,
         coalesce((select format_type(a.atttypid,null)::text
                          || ' / aceita nulo=' || case when a.attnotnull then 'nao' else 'sim' end
                   from pg_attribute a where a.attrelid=('public.'||t.nome)::regclass
                     and a.attname='reactivation_reason' and not a.attisdropped),'(ausente)') as obtido
  from tabelas t
),
com_check as (
  select 'comentário' as secao, t.nome || ': as duas colunas explicam a própria pergunta' as verificacao,
         'sim' as esperado,
         coalesce((select case when
                     col_description(('public.'||t.nome)::regclass,
                       (select attnum from pg_attribute where attrelid=('public.'||t.nome)::regclass
                          and attname='inactivation_reason')) like '%está inativo%'
                     and col_description(('public.'||t.nome)::regclass,
                       (select attnum from pg_attribute where attrelid=('public.'||t.nome)::regclass
                          and attname='reactivation_reason')) like '%voltou à circulação%'
                   then 'sim' else 'comentário ausente ou divergente' end),'(ausente)') as obtido
  from tabelas t
),
-- O ponto da migration: cada direção lê a coluna certa.
fn_stamp as (
  select 'função' as secao, 'stamp exige inactivation_reason ao INATIVAR' as verificacao,
         'sim' as esperado,
         case when pg_get_functiondef('public.stamp_status_transition()'::regprocedure)
                   like '%btrim(new.inactivation_reason)%' then 'sim' else 'nao' end as obtido
  union all
  select 'função','stamp exige reactivation_reason ao REATIVAR','sim',
         case when pg_get_functiondef('public.stamp_status_transition()'::regprocedure)
                   like '%btrim(new.reactivation_reason)%' then 'sim' else 'nao' end
  union all
  select 'função','stamp LIMPA reactivation_reason ao inativar de novo','sim',
         case when pg_get_functiondef('public.stamp_status_transition()'::regprocedure)
                   like '%new.reactivation_reason := null%' then 'sim' else 'nao' end
  union all
  -- inactivation_reason NÃO pode ser limpo na reativação: ele continua
  -- respondendo por que o registro esteve inativo.
  select 'função','stamp NÃO limpa inactivation_reason na reativação','sim',
         case when pg_get_functiondef('public.stamp_status_transition()'::regprocedure)
                   like '%new.inactivation_reason := null%'
              then 'LIMPA — perderia o histórico do estado' else 'sim' end
  union all
  select 'função','stamp segue SEM security definer','sim',
         (select case when not prosecdef then 'sim' else 'virou definer' end
          from pg_proc where pronamespace='public'::regnamespace and proname='stamp_status_transition')
),
fn_trilha as (
  select 'trilha' as secao,
         'write_record_status_' || t.escopo || ' grava o motivo da direção certa' as verificacao,
         'sim' as esperado,
         coalesce((select case when pg_get_functiondef(p.oid) like '%new.inactivation_reason%'
                            and pg_get_functiondef(p.oid) like '%new.reactivation_reason%'
                          then 'sim' else 'usa só uma das colunas' end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname='write_record_status_'||t.escopo),'(ausente)') as obtido
  from tabelas t
),
-- Regressão: a assinatura de segurança das quatro não pode ter se perdido no
-- create or replace. `execute` precisa estar revogado de public E authenticated
-- — revogar só de um é inócuo (RLS_PERMISSOES §5.6).
regressao as (
  select 'regressão' as secao,
         'write_record_status_' || t.escopo || ': definer + search_path + execute revogado' as verificacao,
         'sim' as esperado,
         coalesce((select case when p.prosecdef
                            and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=public%'
                            and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
                          then 'sim'
                          when has_function_privilege('authenticated', p.oid, 'EXECUTE')
                          then 'EXECUTE CONCEDIDO — histórico forjável'
                          else 'definer ou search_path perdido' end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname='write_record_status_'||t.escopo),'(ausente)') as obtido
  from tabelas t
  union all
  select 'regressão','trilha segue sem policy de INSERT/UPDATE/DELETE','(nenhuma)',
         coalesce((select string_agg(polname,', ') from pg_policy
                   where polrelid='public.crm_record_status_history'::regclass
                     and polcmd in ('a','w','d')),'(nenhuma)')
  union all
  select 'regressão','os três triggers de status seguem nas quatro tabelas','12',
         (select count(*)::text from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
          where c.relname in ('directors','managers','teams','sellers') and not tg.tgisinternal
            and (tg.tgname like '%_stamp_status' or tg.tgname like '%_enforce_reactivation'
                 or tg.tgname like '%_record_status_history'))
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from col_check union all select * from com_check
  union all select * from fn_stamp union all select * from fn_trilha
  union all select * from regressao
) todas
order by case secao when 'coluna' then 1 when 'comentário' then 2 when 'função' then 3
                    when 'trilha' then 4 else 5 end, verificacao;
