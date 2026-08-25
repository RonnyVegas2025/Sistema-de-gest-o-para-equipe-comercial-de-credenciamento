-- Comportamento das barreiras de transição de status.
--
--   enforce_inactivation_is_admin()   0003 — quem pode inativar
--   enforce_reactivation_is_admin()   0008 — quem pode reativar (D-025)
--   stamp_status_transition()         0010 — motivo obrigatório nos dois sentidos
--
-- As três são BEFORE UPDATE sobre a MESMA transição da MESMA linha, e nenhuma
-- tinha verificação que alcançasse o corpo.
--
-- Fica de fora `enforce_inactivation_is_manager_or_admin()` (0003): existe, mas
-- nenhuma tabela a aplica ainda — as três que a usam nascem nas Sprints 3 e 4.
-- Não há como medir comportamento de trigger que não está pendurada em nada.
-- Quando a primeira delas nascer, o caso entra aqui.
--
-- ATENÇÃO: este script ESCREVE. É diferente dos `*_verificacao.sql`, que são
-- somente leitura. Cria um time de teste com UUID fixo, mede sete transições e
-- apaga o que criou — inclusive as linhas de trilha que as próprias transições
-- geraram (ver "sobre a trilha", ao final). Reexecutável.
--
-- ===========================================================================
-- POR QUE ELE EXISTE
--
-- `0003_verificacao.sql` e `0008_verificacao.sql` conferem que as triggers
-- existem, que são BEFORE, que têm WHEN com `is distinct from`, e que as
-- funções não são `security definer`. Também casam texto no corpo. Nada disso
-- alcança o que a função DECIDE.
--
-- Medido na 0014: um corpo que mantém todos os trechos procurados dentro de um
-- `if false then` passa na busca textual. Aqui a consequência é pior que na
-- 0014 — lá a linha proibida entra e fica visível na tabela; aqui a barreira
-- some em silêncio, e um registro inativado por quem não podia é
-- indistinguível de um inativado por quem podia.
--
-- ===========================================================================
-- POR QUE O SCRIPT DEFINE O JWT, e por que sem isso ele passaria por vacuidade
--
-- As três barreiras são escritas `auth.uid() is not null and ...`. No SQL
-- Editor não há JWT: `auth.uid()` é nulo, a condição é falsa e NENHUMA delas
-- dispara. Um script que apenas tentasse inativar veria tudo passar e concluiria
-- que está tudo certo — teria medido o console, não a regra.
--
-- Por isso cada caso declara de quem é o contexto, via `request.jwt.claim.sub`,
-- exatamente como `auth.uid()` resolve no Supabase. E por isso o caso 7 existe:
-- mede o console explicitamente, para que a porta fique escrita em vez de ser
-- descoberta por acidente — e para provar que os casos 1 a 6 mediram o contexto
-- que declararam, e não este.
--
-- ===========================================================================
-- POR QUE O SCRIPT COMPARA A MENSAGEM, e não apenas o SQLSTATE
--
-- Regra do CLAUDE.md: quando um teste de recusa passar, confirmar por QUAL
-- recusa ele passou. Aqui duas barreiras diferentes recusam com o MESMO
-- errcode — 42501 para "não pode inativar" e para "não pode reativar" —, e as
-- duas checagens de motivo recusam com o mesmo 23514. Comparar só o código
-- deixaria um caso passar pela barreira do vizinho.
--
-- Isto já cobrou preço: a primeira versão deste script supunha que inativar não
-- era privilégio de administrador. Ele reprovou, e o que estava errado era a
-- suposição, não o banco.
-- ===========================================================================

do $$
declare
  id_time  constant uuid := 'aa000000-0000-4000-8000-000000000001';
  id_admin uuid;
  id_outro uuid;
  estado   text;
  recado   text;
begin
  create temp table if not exists resultado_status (
    ordem int, contexto text, caso text, esperado text, obtido text, status text
  );
  delete from resultado_status;

  select id into id_admin
    from public.profiles where role = 'administrador' and is_active order by created_at limit 1;
  select id into id_outro
    from public.profiles where role <> 'administrador' and is_active order by created_at limit 1;

  if id_admin is null or id_outro is null then
    insert into resultado_status values (0, '—',
      'pré-requisito: um perfil administrador e um não-administrador ativos',
      'ambos existem',
      case when id_admin is null then 'sem administrador ativo' else 'sem não-administrador ativo' end,
      'FALHA');
    return;
  end if;

  insert into public.teams (id, name)
  values (id_time, '[teste] Time das barreiras de status')
  on conflict (id) do update set status = 'ativo', inactivation_reason = null,
                                 reactivation_reason = null, inactivated_at = null,
                                 inactivated_by = null;

  -- 1 — A BARREIRA DE INATIVAÇÃO -----------------------------------------
  -- Com motivo preenchido, para que a única razão possível de recusa seja o
  -- papel. Se vier 23514, o caso passou pela recusa errada e não mediu nada.
  perform set_config('request.jwt.claim.sub', id_outro::text, true);
  begin
    update public.teams
       set status = 'inativo', inactivation_reason = '[teste] inativação indevida'
     where id = id_time;
    estado := '00000'; recado := '';
  exception when others then
    estado := sqlstate; get stacked diagnostics recado = message_text;
  end;
  insert into resultado_status values (1, 'não-administrador',
    'inativar com motivo', '42501 · não pode inativar',
    estado || ' · ' || coalesce(nullif(recado, ''), 'ACEITOU'),
    case when estado = '42501' and recado = 'Apenas administrador pode inativar este registro.'
         then 'OK' else 'FALHA' end);

  -- 2 — administrador, inativação SEM motivo ------------------------------
  perform set_config('request.jwt.claim.sub', id_admin::text, true);
  begin
    update public.teams set status = 'inativo' where id = id_time;
    estado := '00000'; recado := '';
  exception when others then
    estado := sqlstate; get stacked diagnostics recado = message_text;
  end;
  insert into resultado_status values (2, 'administrador',
    'inativar sem motivo', '23514 · falta motivo',
    estado || ' · ' || coalesce(nullif(recado, ''), 'ACEITOU'),
    case when estado = '23514' and recado = 'Informe o motivo da inativação.'
         then 'OK' else 'FALHA' end);

  -- 3 — administrador, inativação COM motivo ------------------------------
  begin
    update public.teams
       set status = 'inativo', inactivation_reason = '[teste] cadastro duplicado'
     where id = id_time;
    estado := '00000'; recado := '';
  exception when others then
    estado := sqlstate; get stacked diagnostics recado = message_text;
  end;
  insert into resultado_status values (3, 'administrador',
    'inativar com motivo', '00000 · aceita',
    estado || coalesce(' · ' || nullif(recado, ''), ' · aceita'),
    case when estado = '00000' then 'OK' else 'FALHA' end);

  -- 4 — A BARREIRA DE REATIVAÇÃO (D-025) ----------------------------------
  -- Também com motivo, pelo mesmo motivo do caso 1. E a mensagem separa esta
  -- barreira da do caso 1, que responde com o MESMO errcode.
  perform set_config('request.jwt.claim.sub', id_outro::text, true);
  begin
    update public.teams
       set status = 'ativo', reactivation_reason = '[teste] reativação indevida'
     where id = id_time;
    estado := '00000'; recado := '';
  exception when others then
    estado := sqlstate; get stacked diagnostics recado = message_text;
  end;
  insert into resultado_status values (4, 'não-administrador',
    'reativar com motivo', '42501 · não pode reativar',
    estado || ' · ' || coalesce(nullif(recado, ''), 'ACEITOU, a barreira caiu'),
    case when estado = '42501' and recado = 'Apenas administrador pode reativar este registro.'
         then 'OK' else 'FALHA' end);

  -- 5 — administrador, reativação SEM motivo ------------------------------
  perform set_config('request.jwt.claim.sub', id_admin::text, true);
  begin
    update public.teams set status = 'ativo' where id = id_time;
    estado := '00000'; recado := '';
  exception when others then
    estado := sqlstate; get stacked diagnostics recado = message_text;
  end;
  insert into resultado_status values (5, 'administrador',
    'reativar sem motivo', '23514 · falta motivo',
    estado || ' · ' || coalesce(nullif(recado, ''), 'ACEITOU'),
    case when estado = '23514' and recado = 'Informe o motivo da reativação.'
         then 'OK' else 'FALHA' end);

  -- 6 — administrador, reativação COM motivo ------------------------------
  begin
    update public.teams
       set status = 'ativo', reactivation_reason = '[teste] erro de cadastro desfeito'
     where id = id_time;
    estado := '00000'; recado := '';
  exception when others then
    estado := sqlstate; get stacked diagnostics recado = message_text;
  end;
  insert into resultado_status values (6, 'administrador',
    'reativar com motivo', '00000 · aceita',
    estado || coalesce(' · ' || nullif(recado, ''), ' · aceita'),
    case when estado = '00000' then 'OK' else 'FALHA' end);

  -- 7 — O CONSOLE ---------------------------------------------------------
  -- Sem JWT nenhuma das duas barreiras se aplica, por construção. Não é
  -- defeito: é o que `auth.uid() is not null` diz, e está documentado na 0003.
  -- O motivo continua obrigatório, porque essa checagem não olha quem é.
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    update public.teams
       set status = 'inativo', inactivation_reason = '[teste] pelo console'
     where id = id_time;
    update public.teams
       set status = 'ativo', reactivation_reason = '[teste] pelo console'
     where id = id_time;
    estado := '00000'; recado := '';
  exception when others then
    estado := sqlstate; get stacked diagnostics recado = message_text;
  end;
  insert into resultado_status values (7, 'console (sem JWT)',
    'inativar e reativar sem administrador', '00000 · porta conhecida',
    estado || coalesce(' · ' || nullif(recado, ''), ' · aceita'),
    case when estado = '00000' then 'OK' else 'FALHA' end);

  -- limpeza ---------------------------------------------------------------
  delete from public.crm_record_status_history
   where scope = 'team' and target_id = id_time;
  delete from public.teams where id = id_time;
end
$$;

select ordem, contexto, caso, esperado, obtido, status
  from resultado_status order by ordem;

-- ===========================================================================
-- SOBRE A TRILHA
--
-- Não existe transição de status sem linha de trilha: é o que a 0008 garante.
-- Logo, medir esta família PRODUZ histórico de entidades que não existem, e a
-- escolha é entre deixar lixo permanente nos relatórios ou removê-lo.
--
-- A remoção acima é cirúrgica — `scope = 'team'` e o UUID fixo deste script,
-- que nunca corresponde a um time real — e só é possível porque o SQL Editor
-- roda como dono da tabela. A imutabilidade de D-023 é sobre a APLICAÇÃO: não
-- há policy de INSERT, UPDATE nem DELETE, e nenhum caminho do frontend alcança
-- o dono. Isso permanece verdadeiro.
--
-- Confira que não sobrou nada:
--   select * from public.crm_record_status_history
--    where target_id = 'aa000000-0000-4000-8000-000000000001';
--   select * from public.teams where name like '[teste]%';
-- Ambas devem vir vazias.
-- ===========================================================================
