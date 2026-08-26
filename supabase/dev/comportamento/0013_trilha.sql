-- Comportamento das SEIS funções de trilha (D-023).
--
--   write_record_status_director()      0008, corpo substituído pela 0010
--   write_record_status_manager()       0008, corpo substituído pela 0010
--   write_record_status_team()          0008, corpo substituído pela 0010
--   write_record_status_seller()        0008, corpo substituído pela 0010
--   write_record_status_company()       0012
--   write_record_status_relationship()  0013
--
-- Roda no ponto da 0013 porque é onde as seis existem. Antes disso, `company` e
-- `relationship` ainda não têm tabela.
--
-- ===========================================================================
-- EXCLUSIVO DO CLUSTER LOCAL. NÃO VAI PARA O PAINEL.
--
-- Mora em `supabase/dev/`, e não em `supabase/checks/`, porque `checks/` é o
-- diretório do que se cola no SQL Editor. A distinção precisa estar na
-- localização, não num aviso no cabeçalho: aviso é lido por quem já está
-- prestando atenção.
--
-- O motivo: este script escreve em `crm_record_status_history` e apaga o que
-- escreveu. Que o dono do banco sempre pôde fazer isso, e que a remoção aqui
-- seja cirúrgica, é verdade e não é o ponto. A regra de D-023 existe para
-- produzir um hábito, e o hábito é o que protege quando ninguém está prestando
-- atenção.
--
-- No momento em que existir no repositório um script que apaga trilha e que foi
-- feito para rodar no painel, ele vai ser rodado no painel — não por quem o
-- escreveu, que sabe o que ele faz, mas por alguém daqui a um ano, depurando
-- outra coisa, que o executa porque é assim que se verifica trilha neste
-- projeto. Aí a remoção deixa de ser cirúrgica.
--
-- A trilha é o único artefato do sistema irrecuperável por natureza. Foi o
-- argumento para antecipar estas funções na fila; vale igualmente aqui (D-043).
--
-- Único caminho de execução: `supabase/dev/reconstruir.sh --checks`.
-- ===========================================================================
--

-- ===========================================================================
-- POR QUE ELE EXISTE — e por que este é o defeito irrecuperável da família
--
-- Uma trilha que não grava é INDISTINGUÍVEL de uma entidade que nunca mudou de
-- status. Não há o que descobrir depois: a informação não existe, e a ausência
-- tem exatamente a mesma aparência do caso normal. Todo outro defeito desta
-- família deixa rastro — a linha errada está lá, e alguém pode encontrá-la.
-- Este apaga a própria evidência de si mesmo.
--
-- E é barato de introduzir por acidente. As seis funções têm a mesma forma e
-- foram escritas por cópia. Basta uma trocar o `scope` fixo pelo do vizinho, ou
-- perder o `reason` numa reescrita, para que a trilha continue gravando e
-- continue mentindo — sem nenhum sinal, nem no banco nem na tela.
--
-- ===========================================================================
-- O QUE A VERIFICAÇÃO ESTRUTURAL JÁ COBRE, e onde ela para
--
-- `0008_verificacao.sql` confere que as funções são `security definer`, com
-- `search_path` fixo, com execute revogado de public E authenticated, e que a
-- trigger é AFTER com `WHEN ... IS DISTINCT FROM`. O WHEN está na DEFINIÇÃO da
-- trigger, não no corpo — para ele, o catálogo basta.
--
-- Ela também casa texto no corpo. Medido: um corpo que mantenha todos os
-- trechos procurados dentro de um `if false then` passa na busca e não grava
-- nada. É a mutação que este script existe para pegar.
--
-- ===========================================================================
-- O QUE CADA CASO AFIRMA
--
--   exatamente 1 linha   pega "não gravou" e "gravou duas vezes"
--   scope correto        pega cópia com o `scope` do vizinho
--   reason preenchido    pega corpo esvaziado — o modo silencioso
--   changed_by correto   pega perda do auth.uid()
--   ativo -> inativo     pega old/new trocados
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- BARREIRA DE EXECUÇÃO — não é comentário, é recusa
--
-- `crm.cluster_local` só existe porque `reconstruir.sh` a define no banco que
-- ele mesmo cria. Não há como reproduzi-la colando no SQL Editor sem decidir
-- fazê-lo de propósito — que é exatamente o ponto: se um dia for necessário
-- medir comportamento de trilha contra o banco real, isso vira decisão tomada
-- na hora, com o risco na mesa, e não herdada de um arquivo que já estava lá.
--
-- A checagem fica DENTRO do bloco que trabalha, como primeira instrução, e não
-- num `do $$` separado antes dele. Medido: com a barreira num bloco à parte, o
-- `psql` sem ON_ERROR_STOP imprime o erro e SEGUE para o bloco seguinte — o
-- script recusou e escreveu na trilha assim mesmo. Barreira que depende do
-- cliente abortar não é barreira.
-- ---------------------------------------------------------------------------
do $$
declare
  id_admin  uuid;
  id_dir    constant uuid := 'bb000000-0000-4000-8000-000000000001';
  id_ges    constant uuid := 'bb000000-0000-4000-8000-000000000002';
  id_tim    constant uuid := 'bb000000-0000-4000-8000-000000000003';
  id_con    constant uuid := 'bb000000-0000-4000-8000-000000000004';
  id_emp    constant uuid := 'bb000000-0000-4000-8000-000000000005';
  id_rel    constant uuid := 'bb000000-0000-4000-8000-000000000006';
  alvo      record;
  linhas    int;
  t         record;
  motivo    text;
  achado    record;
begin
  -- Barreira: ver o bloco de comentário acima. Primeira instrução, antes de
  -- qualquer escrita.
  if coalesce(current_setting('crm.cluster_local', true), 'nao') <> 'sim' then
    raise exception
      'Script exclusivo do cluster local (D-043). Ele escreve e apaga linhas de crm_record_status_history, e a trilha é o único artefato irrecuperável do sistema. Rode por supabase/dev/reconstruir.sh --checks.'
      using errcode = '42501';
  end if;

  create temp table if not exists resultado_trilha (
    ordem int, funcao text, esperado text, obtido text, status text
  );
  delete from resultado_trilha;

  select id into id_admin
    from public.profiles where role = 'administrador' and is_active order by created_at limit 1;

  if id_admin is null then
    insert into resultado_trilha values (0, 'pré-requisito',
      'um perfil administrador ativo', 'nenhum', 'FALHA');
    return;
  end if;

  -- O contexto é declarado, não herdado: `changed_by` vem de `auth.uid()`, e
  -- sem JWT ele seria nulo — o caso passaria sem medir de quem foi a ação.
  perform set_config('request.jwt.claim.sub', id_admin::text, true);

  -- fixtures ---------------------------------------------------------------
  insert into public.directors (id, full_name) values (id_dir, '[teste] Diretora')
    on conflict (id) do update set status = 'ativo', inactivation_reason = null;
  insert into public.managers (id, full_name) values (id_ges, '[teste] Gestor')
    on conflict (id) do update set status = 'ativo', inactivation_reason = null;
  insert into public.teams (id, name) values (id_tim, '[teste] Time')
    on conflict (id) do update set status = 'ativo', inactivation_reason = null;
  insert into public.sellers (id, full_name) values (id_con, '[teste] Consultor')
    on conflict (id) do update set status = 'ativo', inactivation_reason = null;
  insert into public.companies (id, legal_name, cnpj)
    values (id_emp, '[teste] Empresa da trilha', '88888888000101')
    on conflict (id) do update set status = 'ativo', inactivation_reason = null;
  insert into public.crm_company_relationships (id, company_id)
    values (id_rel, id_emp)
    on conflict (id) do update set status = 'ativo', inactivation_reason = null;

  -- limpa trilha de execução anterior, para que a contagem de 1 linha seja
  -- afirmação sobre ESTA execução e não sobre o acumulado.
  delete from public.crm_record_status_history
   where target_id in (id_dir, id_ges, id_tim, id_con, id_emp, id_rel);

  -- os seis casos ----------------------------------------------------------
  for t in
    select * from (values
      (1, 'director',     'directors',                  id_dir),
      (2, 'manager',      'managers',                   id_ges),
      (3, 'team',         'teams',                      id_tim),
      (4, 'seller',       'sellers',                    id_con),
      (5, 'company',      'companies',                  id_emp),
      (6, 'relationship', 'crm_company_relationships',  id_rel)
    ) as x(ordem, escopo, tabela, alvo_id)
  loop
    motivo := '[teste] motivo de ' || t.escopo;

    execute format(
      'update public.%I set status = ''inativo'', inactivation_reason = $1 where id = $2',
      t.tabela) using motivo, t.alvo_id;

    select count(*) into linhas
      from public.crm_record_status_history where target_id = t.alvo_id;

    select h.scope, h.reason, h.previous_status::text as ant, h.new_status::text as nov,
           h.changed_by
      into achado
      from public.crm_record_status_history h
     where h.target_id = t.alvo_id
     order by h.changed_at desc limit 1;

    insert into resultado_trilha values (
      t.ordem,
      'write_record_status_' || t.escopo || '()',
      '1 linha · ' || t.escopo || ' · ativo→inativo · motivo · autoria',
      case
        when linhas = 0 then 'NENHUMA LINHA — a trilha não gravou'
        when linhas > 1 then linhas || ' linhas — gravou mais de uma vez'
        when achado.scope is distinct from t.escopo
          then 'scope ' || coalesce(achado.scope, '(nulo)') || ' — escopo do vizinho'
        when coalesce(btrim(achado.reason), '') = ''
          then 'motivo ' || coalesce('«' || achado.reason || '»', '(nulo)') || ' — corpo esvaziado'
        when achado.reason is distinct from motivo
          then 'motivo «' || achado.reason || '» — não é o informado'
        when achado.ant is distinct from 'ativo' or achado.nov is distinct from 'inativo'
          then achado.ant || '→' || achado.nov || ' — old/new trocados'
        when achado.changed_by is distinct from id_admin
          then 'autoria ' || coalesce(achado.changed_by::text, '(nula)') || ' — perdeu auth.uid()'
        else '1 linha · ' || achado.scope || ' · ' || achado.ant || '→' || achado.nov
             || ' · motivo · autoria'
      end,
      case
        when linhas = 1
         and achado.scope = t.escopo
         and achado.reason = motivo
         and achado.ant = 'ativo' and achado.nov = 'inativo'
         and achado.changed_by = id_admin
        then 'OK' else 'FALHA'
      end);
  end loop;

  -- limpeza ----------------------------------------------------------------
  delete from public.crm_record_status_history
   where target_id in (id_dir, id_ges, id_tim, id_con, id_emp, id_rel);
  delete from public.crm_company_relationships where id = id_rel;
  delete from public.companies  where id = id_emp;
  delete from public.sellers    where id = id_con;
  delete from public.teams      where id = id_tim;
  delete from public.managers   where id = id_ges;
  delete from public.directors  where id = id_dir;
end
$$;

select ordem, funcao, esperado, obtido, status from resultado_trilha order by ordem;

-- ===========================================================================
-- POR QUE ESTE SCRIPT APAGA TRILHA — e por que isso o prende ao cluster local
--
-- Ele escreve em `crm_record_status_history` de propósito: é o que está sendo
-- medido. E como o que escreve pertence a entidades que não existem, ou o lixo
-- fica ou o script apaga. Não há terceira opção.
--
-- Como o cluster local é recriado do zero a cada `reconstruir.sh`, aqui a
-- limpeza é cortesia, não necessidade: nada sobrevive à próxima reconstrução.
-- É contra o banco real que ela seria necessária — e é exatamente por isso que
-- este script não vai para lá.
--
-- D-023 permanece íntegro em produção justamente porque nenhum script deste
-- tipo mora em `supabase/checks/`. A imutabilidade é sobre a aplicação, e o
-- repositório não oferece a ninguém um atalho pronto para contorná-la (D-043).
-- ===========================================================================
