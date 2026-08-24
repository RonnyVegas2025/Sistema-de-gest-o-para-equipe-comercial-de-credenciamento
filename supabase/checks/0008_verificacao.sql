-- Verificação da migration 0008 — somente leitura, não altera nada.
-- Toda linha deve sair com status OK.

with
tabelas (nome, escopo) as (
  values ('directors','director'),('managers','manager'),('teams','team'),('sellers','seller')
),
-- ----- trilha: forma da tabela -----
hist_col (nome, tipo, nulo) as (
  values
    ('id','uuid','nao'), ('scope','text','nao'), ('target_id','uuid','nao'),
    ('previous_status','entity_status','nao'), ('new_status','entity_status','nao'),
    ('reason','text','sim'), ('changed_by','uuid','sim'),
    ('changed_at','timestamp with time zone','nao')
),
hist_check as (
  select 'trilha' as secao, 'coluna ' || e.nome as verificacao,
         e.tipo || ' / aceita nulo=' || e.nulo as esperado,
         coalesce((select format_type(a.atttypid,null)::text
                          || ' / aceita nulo=' || case when a.attnotnull then 'nao' else 'sim' end
                   from pg_attribute a
                   where a.attrelid='public.crm_record_status_history'::regclass
                     and a.attname=e.nome and not a.attisdropped),'(ausente)') as obtido
  from hist_col e
),
hist_check2 as (
  select 'trilha' as secao, 'scope restrito por CHECK' as verificacao, 'sim' as esperado,
         case when exists (select 1 from pg_constraint
                           where conrelid='public.crm_record_status_history'::regclass
                             and contype='c' and pg_get_constraintdef(oid) like '%scope%')
              then 'sim' else 'nao' end as obtido
  union all
  select 'trilha','índice por (scope, target_id, changed_at desc)','existe',
         coalesce((select 'existe' from pg_indexes where schemaname='public'
                   and indexname='crm_record_status_hist_target_idx'),'(ausente)')
  union all
  select 'trilha','RLS ligada','true',
         (select relrowsecurity::text from pg_class
          where oid='public.crm_record_status_history'::regclass)
  union all
  -- force RLS faria a própria função de trilha perder o acesso
  select 'trilha','force RLS NÃO habilitada','false',
         (select relforcerowsecurity::text from pg_class
          where oid='public.crm_record_status_history'::regclass)
  union all
  select 'trilha','NENHUMA policy de INSERT, UPDATE ou DELETE','(nenhuma)',
         coalesce((select string_agg(polname||'/'||polcmd::text,', ') from pg_policy
                   where polrelid='public.crm_record_status_history'::regclass
                     and polcmd in ('a','w','d')),'(nenhuma)')
  union all
  select 'trilha','SELECT restrito aos escopos desta sprint','sim',
         case when exists (select 1 from pg_policy
                           where polrelid='public.crm_record_status_history'::regclass
                             and polname='crm_record_status_history_select'
                             and pg_get_expr(polqual,polrelid) like '%director%'
                             and pg_get_expr(polqual,polrelid) like '%seller%')
              then 'sim' else 'nao' end
),
-- ----- colunas de inativação nas quatro entidades -----
inat_check as (
  select 'inativação' as secao,
         t.nome || ': as três colunas' as verificacao,
         'inactivated_at, inactivated_by, inactivation_reason' as esperado,
         coalesce((select string_agg(a.attname::text, ', ' order by a.attname)
                   from pg_attribute a
                   where a.attrelid=('public.'||t.nome)::regclass and not a.attisdropped
                     and a.attname in ('inactivated_at','inactivated_by','inactivation_reason')),
                  '(nenhuma)') as obtido
  from tabelas t
),
-- ----- UMA função de trilha POR ENTIDADE, com a assinatura obrigatória -----
fn_check as (
  select 'função' as secao,
         'write_record_status_' || t.escopo || ': security definer + search_path fixo' as verificacao,
         'sim' as esperado,
         coalesce((select case when p.prosecdef
                            and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=public%'
                          then 'sim' else 'nao' end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname='write_record_status_'||t.escopo),'(ausente)') as obtido
  from tabelas t
),
-- ESTE É O TESTE QUE A FALTA NÃO QUEBRA NADA VISÍVEL.
-- `revoke execute` esquecido não produz sintoma: a trilha continua funcionando.
-- Só abre a porta para forjar histórico chamando a função direto pela API.
revoke_check as (
  select 'função' as secao,
         'write_record_status_' || t.escopo || ': execute REVOGADO de authenticated' as verificacao,
         'revogado' as esperado,
         coalesce((select case when has_function_privilege('authenticated',
                                   p.oid, 'EXECUTE')
                          then 'CONCEDIDO — histórico forjável pela API'
                          else 'revogado' end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname='write_record_status_'||t.escopo),'(ausente)') as obtido
  from tabelas t
  union all
  select 'função',
         'write_record_status_' || t.escopo || ': execute REVOGADO de public',
         'revogado',
         coalesce((select case when has_function_privilege('public', p.oid, 'EXECUTE')
                          then 'CONCEDIDO — histórico forjável pela API' else 'revogado' end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname='write_record_status_'||t.escopo),'(ausente)')
  from tabelas t
),
-- ----- funções compartilhadas de validação -----
val_check as (
  select 'função' as secao, 'stamp_status_transition existe, SEM security definer' as verificacao,
         'sim' as esperado,
         coalesce((select case when not p.prosecdef then 'sim' else 'É DEFINER — privilégio desnecessário' end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname='stamp_status_transition'),'(ausente)') as obtido
  union all
  select 'função','enforce_reactivation_is_admin existe com search_path fixo','sim',
         coalesce((select case when coalesce(array_to_string(p.proconfig,','),'') like '%search_path=public%'
                          then 'sim' else 'search_path NAO fixo' end
                   from pg_proc p where p.pronamespace='public'::regnamespace
                     and p.proname='enforce_reactivation_is_admin'),'(ausente)')
),
-- ----- triggers: existência e o filtro no WHEN -----
trg_check as (
  select 'trigger' as secao,
         t.nome || ': os três triggers de status' as verificacao,
         '3' as esperado,
         (select count(*)::text from pg_trigger tg
          where tg.tgrelid=('public.'||t.nome)::regclass and not tg.tgisinternal
            and tg.tgname in (t.nome||'_stamp_status', t.nome||'_enforce_reactivation',
                              t.nome||'_record_status_history'))::text as obtido
  from tabelas t
),
trg_when as (
  select 'trigger' as secao,
         t.nome || ': trilha filtrada por WHEN com is distinct from' as verificacao,
         'sim' as esperado,
         coalesce((select case when pg_get_triggerdef(tg.oid) like '%WHEN%'
                            and pg_get_triggerdef(tg.oid) like '%IS DISTINCT FROM%'
                          then 'sim' else 'sem WHEN ou usando <>' end
                   from pg_trigger tg
                   where tg.tgrelid=('public.'||t.nome)::regclass
                     and tg.tgname=t.nome||'_record_status_history'),'(ausente)') as obtido
  from tabelas t
)
select secao, verificacao, esperado, obtido,
       case when obtido = esperado then 'OK' else 'FALHA' end as status
from (
  select * from hist_check union all select * from hist_check2
  union all select * from inat_check union all select * from fn_check
  union all select * from revoke_check union all select * from val_check
  union all select * from trg_check union all select * from trg_when
) todas
order by case secao when 'trilha' then 1 when 'inativação' then 2
                    when 'função' then 3 else 4 end, verificacao;
