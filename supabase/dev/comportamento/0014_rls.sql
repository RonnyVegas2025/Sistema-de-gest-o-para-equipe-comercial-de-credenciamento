-- Bateria de RLS §6.1 — o recorte EXERCITADO, não apenas declarado.
--
-- ===========================================================================
-- EXCLUSIVO DO CLUSTER LOCAL. NÃO VAI PARA O PAINEL.
--
-- Motivo diferente do de `0010_status.sql` e `0013_trilha.sql`, que não podem
-- sair daqui por causa da trilha. Este precisa de outra coisa: **uma hierarquia
-- comercial inteira e falsa** — dois consultores em equipes distintas, um
-- gestor, um diretor, um usuário de vínculo duplo e um administrador. Perfis
-- exigem linhas em `auth.users`, e o schema de autenticação de um projeto real
-- não é lugar de fixture.
--
-- Reusar os cinco usuários do seed também não serve: o caso de vínculo duplo
-- exigiria alterar vínculos reais, que é mais invasivo que fabricar os falsos.
--
-- Consequência para o plano: a §8 da SPRINT-2 previa esta bateria "contra o
-- banco real, pelo SQL Editor". Isso precisa ser revisto — o que roda no painel
-- é a verificação estrutural; o exercício da policy roda aqui.
--
-- Único caminho de execução: `supabase/dev/reconstruir.sh --checks`.
-- ===========================================================================
--
-- POR QUE ELA EXISTE
--
-- Os `*_verificacao.sql` leem o `polqual` no catálogo: provam que a policy
-- EXISTE e que CHAMA `scoped_seller_ids()`. Não provam que ela RECORTA.
--
-- E até 26/08/2026 nada mais provava, porque nada nunca rodou sob um papel
-- sujeito à RLS: `psql` conecta como `postgres`, o SQL Editor do painel também
-- é dono, e o dono não é filtrado por policy. O gate de cinco usuários da
-- Sprint 1 mediu a FUNÇÃO de escopo, não a policy (D-018).
--
-- É a mesma lacuna da 0014, um nível acima: lá a estrutura não alcançava o
-- corpo da função; aqui o catálogo não alcança o efeito da policy.
--
-- POR QUE CADA CASO MEDE SOB `set local role authenticated`
--
-- Sem trocar de papel, tudo passa: o dono lê tudo, e um script que só contasse
-- linhas concluiria que o recorte funciona. Mediria o próprio privilégio.
--
-- A troca de papel só é possível porque `02_harness_grants.sql` reproduz os
-- grants do Supabase. Sem eles o caso reprova com `permission denied` — recusa
-- pelo motivo errado, indistinguível de proteção.

do $$
declare
  -- perfis
  p_a     constant uuid := 'dd000000-0000-4000-8000-0000000000a1';  -- consultor equipe 1
  p_b     constant uuid := 'dd000000-0000-4000-8000-0000000000b1';  -- consultor equipe 2
  p_g     constant uuid := 'dd000000-0000-4000-8000-0000000000c1';  -- gestor da equipe 1
  p_dup   constant uuid := 'dd000000-0000-4000-8000-0000000000d1';  -- vínculo duplo
  p_adm   constant uuid := 'dd000000-0000-4000-8000-0000000000e1';  -- administrador
  -- estrutura
  t1      constant uuid := 'dd000000-0000-4000-8000-000000000101';
  t2      constant uuid := 'dd000000-0000-4000-8000-000000000102';
  t3      constant uuid := 'dd000000-0000-4000-8000-000000000103';
  m1      constant uuid := 'dd000000-0000-4000-8000-000000000201';
  m2      constant uuid := 'dd000000-0000-4000-8000-000000000202';
  s_a     constant uuid := 'dd000000-0000-4000-8000-000000000301';
  s_b     constant uuid := 'dd000000-0000-4000-8000-000000000302';
  s_dup   constant uuid := 'dd000000-0000-4000-8000-000000000303';
  s_t3    constant uuid := 'dd000000-0000-4000-8000-000000000304';
  -- empresas e vínculos
  c_a     constant uuid := 'dd000000-0000-4000-8000-000000000401';
  c_b     constant uuid := 'dd000000-0000-4000-8000-000000000402';
  c_orf   constant uuid := 'dd000000-0000-4000-8000-000000000403';  -- sem relacionamento
  c_cli   constant uuid := 'dd000000-0000-4000-8000-000000000404';  -- empresa demandante
  r_a     constant uuid := 'dd000000-0000-4000-8000-000000000501';
  r_b     constant uuid := 'dd000000-0000-4000-8000-000000000502';
  r_nulo  constant uuid := 'dd000000-0000-4000-8000-000000000503';  -- responsável nulo
  id_ec   uuid;
  n       int;
  n2      int;
  msg     text;
begin
  if coalesce(current_setting('crm.cluster_local', true), 'nao') <> 'sim' then
    raise exception
      'Script exclusivo do cluster local (D-043). Ele fabrica perfis em auth.users, e o schema de autenticação de um projeto real não é lugar de fixture. Rode por supabase/dev/reconstruir.sh --checks.'
      using errcode = '42501';
  end if;

  create temp table if not exists resultado_rls (
    ordem int, ator text, caso text, esperado text, obtido text, status text
  );
  delete from resultado_rls;

  -- ── fixtures ─────────────────────────────────────────────────────────────
  -- Papel de PERFIL é 'comercial' para gestor e vínculo duplo: `gestor_adm` é
  -- papel administrativo, e o ramo `has_role('administrador','gestor_adm')` das
  -- policies engoliria o recorte, fazendo o caso passar sem medir nada. Gestor
  -- de EQUIPE é hierarquia, não papel (D-005).
  insert into auth.users (id, email) values
    (p_a,'rls.a@local'), (p_b,'rls.b@local'), (p_g,'rls.g@local'),
    (p_dup,'rls.dup@local'), (p_adm,'rls.adm@local')
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, email, role) values
    (p_a,  '[rls] Consultor A',   'rls.a@local',   'comercial'),
    (p_b,  '[rls] Consultor B',   'rls.b@local',   'comercial'),
    (p_g,  '[rls] Gestor eq1',    'rls.g@local',   'comercial'),
    (p_dup,'[rls] Vínculo duplo', 'rls.dup@local', 'comercial'),
    (p_adm,'[rls] Administrador', 'rls.adm@local', 'administrador')
  on conflict (id) do update set role = excluded.role, is_active = true;

  insert into public.teams (id, name) values
    (t1,'[rls] Equipe 1'), (t2,'[rls] Equipe 2'), (t3,'[rls] Equipe 3')
  on conflict (id) do nothing;

  insert into public.managers (id, full_name, profile_id) values
    (m1,'[rls] Gestor eq1', p_g), (m2,'[rls] Gestor eq3', p_dup)
  on conflict (id) do update set profile_id = excluded.profile_id;

  update public.teams set current_manager_id = m1 where id = t1;
  update public.teams set current_manager_id = m2 where id = t3;

  insert into public.sellers (id, full_name, team_id, profile_id) values
    (s_a,  '[rls] Consultor A',   t1, p_a),
    (s_b,  '[rls] Consultor B',   t2, p_b),
    (s_dup,'[rls] Vínculo duplo', t2, p_dup),
    (s_t3, '[rls] Consultor eq3', t3, null)
  on conflict (id) do update set team_id = excluded.team_id,
                                 profile_id = excluded.profile_id;

  insert into public.companies (id, legal_name, cnpj, is_merchant) values
    (c_a,  '[rls] Comércio A',     '77777777000101', true),
    (c_b,  '[rls] Comércio B',     '77777777000102', true),
    (c_orf,'[rls] Comércio órfão', '77777777000103', true)
  on conflict (id) do nothing;
  insert into public.companies (id, legal_name, cnpj, is_client_company) values
    (c_cli,'[rls] Empresa cliente','77777777000104', true)
  on conflict (id) do nothing;

  insert into public.crm_company_relationships (id, company_id, responsible_seller_id) values
    (r_a,   c_a, s_a),
    (r_b,   c_b, s_b),
    (r_nulo, c_orf, null)
  on conflict (id) do update set responsible_seller_id = excluded.responsible_seller_id;

  select id into id_ec from public.crm_demand_origins where match_key = 'EMPRESA_CLIENTE';
  insert into public.crm_accreditation_demands (merchant_company_id, origin_id, client_company_id)
  values (c_a, id_ec, c_cli), (c_b, id_ec, c_cli), (c_orf, id_ec, c_cli)
  on conflict do nothing;

  -- ── 1 · consultor A lê o relacionamento dele ─────────────────────────────
  perform set_config('request.jwt.claim.sub', p_a::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_company_relationships where id = r_a;
  execute 'reset role';
  insert into resultado_rls values (1, 'consultor A', 'lê o próprio relacionamento',
    '1', n::text, case when n = 1 then 'OK' else 'FALHA' end);

  -- ── 2 · e NÃO lê o de outra equipe ───────────────────────────────────────
  execute 'set local role authenticated';
  select count(*) into n from public.crm_company_relationships where id = r_b;
  execute 'reset role';
  insert into resultado_rls values (2, 'consultor A', 'lê relacionamento de outra equipe',
    '0', n::text, case when n = 0 then 'OK' else 'FALHA — o recorte não recorta' end);

  -- ── 3 · relacionamento de responsável nulo é invisível ao consultor ──────
  execute 'set local role authenticated';
  select count(*) into n from public.crm_company_relationships where id = r_nulo;
  execute 'reset role';
  insert into resultado_rls values (3, 'consultor A', 'lê relacionamento sem responsável',
    '0', n::text, case when n = 0 then 'OK' else 'FALHA' end);

  -- ── 4 · ESCRITA: reatribuir para si tudo o que existir ──────────────────
  -- O modo de falhar que não deixa rastro: com SELECT recortado e UPDATE
  -- aberto, a operação acontece e o próprio SELECT a esconde depois.
  --
  -- SEM `where`, E ISSO NÃO É DETALHE DE ESTILO. Medido em 26/08/2026: com
  -- `where id = <linha invisível>`, a policy de SELECT filtra a linha antes de
  -- a de UPDATE ser consultada, e o resultado é 0 linhas COM OU SEM recorte no
  -- UPDATE — o caso passaria pela barreira do vizinho e nunca mediria a que se
  -- quer medir. A primeira versão deste script tinha exatamente esse defeito, e
  -- foi a mutação M2 que o revelou: ela não reprovava nada.
  --
  --   UPDATE ... where id = <invisível>   0 linhas com recorte, 0 sem
  --   UPDATE ... sem where                0 linhas com recorte, 1 SEM
  --
  -- E a forma sem `where` não é artificial: é o que um consultor escreveria
  -- para reatribuir tudo para si de uma vez, e ela alcança linhas que ele nem
  -- consegue enxergar.
  --
  -- E o que se mede é o EFEITO, não o `row_count`. A linha do próprio consultor
  -- é alcançada de forma legítima — `row_count = 1` é o certo, e esperar 0 aqui
  -- reprovaria a policy correta. O que denuncia a escrita aberta é quantas
  -- linhas TERMINAM apontando para ele: uma (a dele) ou três (as três que
  -- existem, duas das quais ele não enxerga).
  execute 'set local role authenticated';
  update public.crm_company_relationships set responsible_seller_id = s_a;
  execute 'reset role';
  select count(*) into n from public.crm_company_relationships
   where id in (r_a, r_b, r_nulo) and responsible_seller_id = s_a;
  insert into resultado_rls values (4, 'consultor A', 'reatribui para si TUDO (update sem where)',
    '1 — só a dele', n || ' de 3',
    case when n = 1 then 'OK' else 'FALHA — escrita aberta com leitura recortada' end);
  -- devolve o estado das fixtures para os casos seguintes
  update public.crm_company_relationships set responsible_seller_id = s_b   where id = r_b;
  update public.crm_company_relationships set responsible_seller_id = null  where id = r_nulo;

  -- ── 5 · Empurrar a própria linha para fora do escopo ────────────────────
  -- Direção oposta da 4. A linha É visível e É editável; o que tem de ser
  -- recusado é o estado NOVO — senão o consultor entrega um registro a outra
  -- equipe e perde o acesso ao que acabou de fazer, sem sinal de erro.
  --
  -- QUAL BARREIRA RECUSA AQUI: a policy de SELECT, não o `with check` do
  -- UPDATE. Medido em 26/08/2026, isolando as duas:
  --
  --   policies íntegras                       recusa 42501
  --   `with check (true)` no UPDATE           recusa 42501  ← ainda recusa
  --   `with check (true)` E SELECT amplo      ACEITA
  --
  -- O Postgres exige que a linha ATUALIZADA continue visível sob a policy de
  -- SELECT. Como nesta tabela SELECT e UPDATE têm o mesmo predicado, o
  -- `with check` é redundante — e **este caso não consegue detectar a ausência
  -- dele**. Está escrito para que ninguém o leia como prova do que ele não
  -- prova.
  --
  -- Onde isso deixa de ser redundância: tabela com SELECT AMPLO e escrita
  -- recortada — `companies` é o exemplo vivo (§5.2). Lá o `with check` é a
  -- única barreira, e some sem que nada na leitura denuncie.
  execute 'set local role authenticated';
  begin
    update public.crm_company_relationships set responsible_seller_id = s_b where id = r_a;
    msg := 'aceitou';
  exception when others then msg := sqlstate;
  end;
  execute 'reset role';
  insert into resultado_rls values (5, 'consultor A', 'move o próprio registro para outra equipe',
    '42501', msg,
    case when msg = '42501' then 'OK' else 'FALHA — with check ausente' end);

  -- ── 6 · DELETE: sem policy, a RLS filtra e não levanta ───────────────────
  execute 'set local role authenticated';
  delete from public.crm_company_relationships where id = r_a;
  get diagnostics n = row_count;
  execute 'reset role';
  insert into resultado_rls values (6, 'consultor A', 'DELETE do próprio relacionamento',
    '0 linhas, sem erro', n || ' linha(s)',
    case when n = 0 then 'OK' else 'FALHA — DELETE alcançou linha' end);

  -- ── 7 · gestor lê a equipe que gerencia, e só ela ────────────────────────
  perform set_config('request.jwt.claim.sub', p_g::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_company_relationships where id in (r_a, r_b, r_nulo);
  execute 'reset role';
  insert into resultado_rls values (7, 'gestor eq1', 'lê os relacionamentos da equipe 1',
    '1 (só o de A)', n::text, case when n = 1 then 'OK' else 'FALHA' end);

  -- ── 8 · VÍNCULO DUPLO: união, nunca o primeiro papel encontrado ──────────
  -- Consultor da equipe 2 E gestor da equipe 3. Uma implementação em `case`
  -- devolveria só um dos dois conjuntos — e este é o ÚNICO caso que cai.
  perform set_config('request.jwt.claim.sub', p_dup::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.scoped_seller_ids() where scoped_seller_ids in (s_dup, s_t3);
  execute 'reset role';
  insert into resultado_rls values (8, 'vínculo duplo', 'escopo é a UNIÃO dos dois vínculos',
    '2 (o próprio + a equipe 3)', n::text,
    case when n = 2 then 'OK' else 'FALHA — primeiro papel encontrado' end);

  -- ── 9 · gestão lê o relacionamento sem responsável ──────────────────────
  perform set_config('request.jwt.claim.sub', p_adm::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_company_relationships where id = r_nulo;
  execute 'reset role';
  insert into resultado_rls values (9, 'administrador', 'lê relacionamento sem responsável',
    '1', n::text, case when n = 1 then 'OK' else 'FALHA — ninguém distribuiria' end);

  -- ── 10 · DEMANDA: recorte transitivo pelo comércio (0014) ────────────────
  perform set_config('request.jwt.claim.sub', p_a::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_accreditation_demands
   where merchant_company_id in (c_a, c_b);
  execute 'reset role';
  insert into resultado_rls values (10, 'consultor A', 'lê demandas: a do comércio dele, não a de B',
    '1', n::text, case when n = 1 then 'OK' else 'FALHA' end);

  -- ── 11 · O CASO QUE DESENHA A PÁGINA "NOVOS COMÉRCIOS" ──────────────────
  -- O comércio órfão é visível (leitura ampla de `companies`, §5.2) e a demanda
  -- dele NÃO é. Na tela, isso é idêntico a um comércio sem origem cadastrada.
  -- Um contador ingênuo o marcaria como exceção — e superestimaria, que é a
  -- direção que ninguém desconfia num indicador de pendência.
  execute 'set local role authenticated';
  select count(*) into n from public.companies where id = c_orf;
  execute 'reset role';
  execute 'set local role authenticated';
  select count(*) into n2 from public.crm_accreditation_demands where merchant_company_id = c_orf;
  execute 'reset role';
  insert into resultado_rls values (11, 'consultor A',
    'comércio órfão: empresa visível, demanda invisível',
    'empresa 1 · demanda 0', n || ' · ' || n2,
    case when n = 1 and n2 = 0 then 'OK' else 'FALHA' end);

  -- ── limpeza ─────────────────────────────────────────────────────────────
  delete from public.crm_accreditation_demands
   where merchant_company_id in (c_a, c_b, c_orf);
  delete from public.crm_company_relationships where id in (r_a, r_b, r_nulo);
  delete from public.companies where id in (c_a, c_b, c_orf, c_cli);
  update public.teams set current_manager_id = null where id in (t1, t2, t3);
  delete from public.sellers  where id in (s_a, s_b, s_dup, s_t3);
  delete from public.managers where id in (m1, m2);
  delete from public.teams    where id in (t1, t2, t3);
  delete from public.profiles where id in (p_a, p_b, p_g, p_dup, p_adm);
  delete from auth.users      where id in (p_a, p_b, p_g, p_dup, p_adm);
end
$$;

select ordem, ator, caso, esperado, obtido, status from resultado_rls order by ordem;
