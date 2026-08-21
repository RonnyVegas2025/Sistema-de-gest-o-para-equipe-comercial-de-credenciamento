-- Verificação da migration 0001 — somente leitura, não altera nada.
--
-- Cole no SQL Editor DEPOIS de aplicar 0001_profiles.sql e devolva a saída
-- inteira. "Aplicou" não é o mesmo que "aplicou certo": este script lê o estado
-- real do catálogo e compara com o que MODELO_DADOS.md §2.1 e RLS_PERMISSOES.md
-- §5.1 exigem.
--
-- Toda linha deve sair com status OK. Qualquer FALHA é motivo para parar e
-- corrigir por migration nova — a 0001 aplicada não se edita (D-021).

with
-- ----- 1. enum -----
enum_check as (
  select
    'enum' as secao,
    'app_role tem os 6 papéis, na ordem' as verificacao,
    'administrador,gestor_adm,analista_adm,comercial,financeiro,auditoria' as esperado,
    coalesce(string_agg(e.enumlabel, ',' order by e.enumsortorder), '(enum ausente)') as obtido
  from pg_type t
  left join pg_enum e on e.enumtypid = t.oid
  where t.typname = 'app_role'
    and t.typnamespace = 'public'::regnamespace
),
-- ----- 2. colunas -----
col_esperadas (nome, tipo, nulo, padrao) as (
  values
    ('id',         'uuid',        'nao', ''),
    ('full_name',  'text',        'nao', ''),
    ('email',      'text',        'nao', ''),
    ('role',       'app_role',    'nao', '''auditoria''::app_role'),
    ('is_active',  'boolean',     'nao', 'true'),
    ('created_at', 'timestamp with time zone', 'nao', 'now()'),
    ('updated_at', 'timestamp with time zone', 'nao', 'now()')
),
col_reais as (
  select
    a.attname::text as nome,
    format_type(a.atttypid, null)::text as tipo,
    case when a.attnotnull then 'nao' else 'sim' end as nulo,
    coalesce(pg_get_expr(d.adbin, d.adrelid), '') as padrao
  from pg_attribute a
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = 'public.profiles'::regclass
    and a.attnum > 0 and not a.attisdropped
),
col_check as (
  select
    'coluna' as secao,
    e.nome as verificacao,
    e.tipo || ' / aceita nulo=' || e.nulo || ' / default=' || coalesce(nullif(e.padrao,''),'(nenhum)') as esperado,
    coalesce(r.tipo || ' / aceita nulo=' || r.nulo || ' / default=' || coalesce(nullif(r.padrao,''),'(nenhum)'), '(coluna ausente)') as obtido
  from col_esperadas e
  left join col_reais r on r.nome = e.nome
),
col_extra as (
  select 'coluna' as secao,
         'nenhuma coluna a mais que o modelo' as verificacao,
         '(nenhuma)' as esperado,
         coalesce(string_agg(r.nome, ', ' order by r.nome), '(nenhuma)') as obtido
  from col_reais r
  where r.nome not in (select nome from col_esperadas)
),
-- ----- 3. chaves -----
key_check as (
  select 'chave' as secao,
         c.conname::text as verificacao,
         case c.contype when 'p' then 'PRIMARY KEY (id)'
                        else 'FOREIGN KEY -> auth.users(id) ON DELETE CASCADE' end as esperado,
         pg_get_constraintdef(c.oid) as obtido
  from pg_constraint c
  where c.conrelid = 'public.profiles'::regclass and c.contype in ('p','f')
),
-- ----- 4. índices -----
idx_esperados (nome) as (values ('profiles_role_idx'), ('profiles_active_idx')),
idx_check as (
  select 'índice' as secao,
         e.nome as verificacao,
         'existe' as esperado,
         coalesce((select 'existe' from pg_indexes i
                   where i.schemaname='public' and i.tablename='profiles' and i.indexname=e.nome),
                  '(ausente)') as obtido
  from idx_esperados e
),
-- ----- 5. funções: existência, security definer e search_path -----
fn_esperadas (nome, definer, search_path) as (
  values
    ('auth_role',                  true,  true),
    ('is_admin',                   true,  true),
    ('has_role',                   true,  true),
    ('set_updated_at',             false, true),
    ('handle_new_user',            true,  true),
    ('prevent_profile_tampering',  false, true)
),
fn_reais as (
  select p.proname::text as nome,
         p.prosecdef as definer,
         coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=public%' as search_path
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in (select nome from fn_esperadas)
),
fn_check as (
  select 'função' as secao,
         e.nome as verificacao,
         'security definer=' || e.definer || ' / search_path fixo=' || e.search_path as esperado,
         coalesce('security definer=' || r.definer || ' / search_path fixo=' || r.search_path, '(função ausente)') as obtido
  from fn_esperadas e
  left join fn_reais r on r.nome = e.nome
),
-- ----- 6. triggers -----
trg_esperados (nome, tabela) as (
  values
    ('profiles_set_updated_at',            'public.profiles'),
    ('profiles_prevent_profile_tampering', 'public.profiles'),
    ('on_auth_user_created',               'auth.users')
),
trg_check as (
  select 'trigger' as secao,
         e.nome || ' em ' || e.tabela as verificacao,
         'existe' as esperado,
         coalesce((select 'existe' from pg_trigger t
                   where t.tgname = e.nome and t.tgrelid = e.tabela::regclass and not t.tgisinternal),
                  '(ausente)') as obtido
  from trg_esperados e
),
-- ----- 7. RLS -----
rls_check as (
  select 'RLS' as secao,
         'row level security ligada em profiles' as verificacao,
         'true' as esperado,
         (select relrowsecurity::text from pg_class where oid='public.profiles'::regclass) as obtido
),
-- ----- 8. policies -----
pol_check as (
  select 'policy' as secao,
         'profiles_select — leitura' as verificacao,
         'própria linha OU is_admin(); SEM gestor_adm' as esperado,
         coalesce((select pg_get_expr(pol.polqual, pol.polrelid) from pg_policy pol
                   where pol.polrelid='public.profiles'::regclass and pol.polname='profiles_select'),
                  '(policy ausente)') as obtido
  union all
  select 'policy',
         'profiles_update — escrita',
         'própria linha OU is_admin(), com with check igual',
         coalesce((select pg_get_expr(pol.polqual, pol.polrelid) || ' | with check: ' ||
                          coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'(nenhum)')
                   from pg_policy pol
                   where pol.polrelid='public.profiles'::regclass and pol.polname='profiles_update'),
                  '(policy ausente)')
  union all
  select 'policy',
         'nenhuma policy de INSERT ou DELETE',
         '(nenhuma)',
         coalesce((select string_agg(pol.polname || '/' || pol.polcmd::text, ', ')
                   from pg_policy pol
                   where pol.polrelid='public.profiles'::regclass and pol.polcmd in ('a','d')),
                  '(nenhuma)')
  union all
  select 'policy',
         'total de policies em profiles',
         '2',
         (select count(*)::text from pg_policy where polrelid='public.profiles'::regclass)
)
select
  secao,
  verificacao,
  esperado,
  obtido,
  case
    when secao = 'coluna'  and verificacao = 'nenhuma coluna a mais que o modelo'
         then case when obtido = '(nenhuma)' then 'OK' else 'FALHA' end
    when secao = 'coluna'  then case when obtido = esperado then 'OK' else 'FALHA' end
    when secao = 'enum'    then case when obtido = esperado then 'OK' else 'FALHA' end
    when secao = 'índice'  then case when obtido = 'existe' then 'OK' else 'FALHA' end
    when secao = 'função'  then case when obtido = esperado then 'OK' else 'FALHA' end
    when secao = 'trigger' then case when obtido = 'existe' then 'OK' else 'FALHA' end
    when secao = 'RLS'     then case when obtido = 'true'   then 'OK' else 'FALHA' end
    when secao = 'chave'   then case when obtido like 'PRIMARY KEY%' or obtido like '%ON DELETE CASCADE%' then 'OK' else 'FALHA' end
    when secao = 'policy'  and verificacao = 'nenhuma policy de INSERT ou DELETE'
         then case when obtido = '(nenhuma)' then 'OK' else 'FALHA' end
    when secao = 'policy'  and verificacao = 'total de policies em profiles'
         then case when obtido = '2' then 'OK' else 'FALHA' end
    when secao = 'policy'  and verificacao like 'profiles_select%'
         then case when obtido like '%is_admin%' and obtido not like '%gestor_adm%' then 'OK' else 'FALHA' end
    when secao = 'policy'  and verificacao like 'profiles_update%'
         then case when obtido like '%is_admin%' and obtido like '%with check%' then 'OK' else 'FALHA' end
    else 'REVISAR'
  end as status
from (
  select * from enum_check
  union all select * from col_check
  union all select * from col_extra
  union all select * from key_check
  union all select * from idx_check
  union all select * from fn_check
  union all select * from trg_check
  union all select * from rls_check
  union all select * from pol_check
) todas
order by
  case secao when 'enum' then 1 when 'coluna' then 2 when 'chave' then 3
             when 'índice' then 4 when 'função' then 5 when 'trigger' then 6
             when 'RLS' then 7 else 8 end,
  verificacao;
