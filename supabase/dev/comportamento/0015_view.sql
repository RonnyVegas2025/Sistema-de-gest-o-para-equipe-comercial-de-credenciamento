-- Comportamento da view `crm_merchant_origin_status` (0015) — o recorte
-- EXERCITADO, e o contador da página conferido contra a lista.
--
-- ===========================================================================
-- EXCLUSIVO DO CLUSTER LOCAL. NÃO VAI PARA O PAINEL.
--
-- Mesmo motivo de `0014_rls.sql`: precisa de hierarquia comercial fabricada, e
-- perfil exige linha em `auth.users`. O schema de autenticação de um projeto
-- real não é lugar de fixture.
--
-- Único caminho de execução: `supabase/dev/reconstruir.sh --checks`.
-- ===========================================================================
--
-- POR QUE ELE EXISTE
--
-- `0015_verificacao.sql` confere que a view existe, que `security_invoker` está
-- ligado, quais colunas ela tem e que a definição referencia as três relações.
-- Tudo atributo e texto. **Não confere que ela recorta.**
--
-- E aqui o modo de falhar é o pior possível: sem `security_invoker`, a view roda
-- como DONA e devolve a base inteira a qualquer consultor. Nada na tela
-- denunciaria — a tela mostra o que a view devolver, e uma lista maior parece
-- uma base maior, não um furo.
--
-- Foi exatamente a lacuna que a etapa 5c-0 corrigiu para as policies. Criar uma
-- view dizendo que ela recorta, sem nunca exercitá-la, repetiria em miniatura o
-- que acabamos de consertar.
--
-- O CASO 4 NÃO É DECORATIVO
--
-- Ele confere a ARITMÉTICA do contador: `sem origem` = total − com origem,
-- calculado sobre a MESMA relação que a lista usa. É a invariante que a página
-- inteira depende — contador e lista saindo do mesmo conjunto —, e é a única
-- coisa que impede o indicador de virar número plausível e errado.

do $$
declare
  p_a     constant uuid := 'ee000000-0000-4000-8000-0000000000a1';  -- consultor eq1
  p_adm   constant uuid := 'ee000000-0000-4000-8000-0000000000e1';  -- administrador
  t1      constant uuid := 'ee000000-0000-4000-8000-000000000101';
  t2      constant uuid := 'ee000000-0000-4000-8000-000000000102';
  s_a     constant uuid := 'ee000000-0000-4000-8000-000000000301';
  s_b     constant uuid := 'ee000000-0000-4000-8000-000000000302';
  c_com   constant uuid := 'ee000000-0000-4000-8000-000000000401';  -- dele, COM origem
  c_sem   constant uuid := 'ee000000-0000-4000-8000-000000000402';  -- dele, SEM origem
  c_out   constant uuid := 'ee000000-0000-4000-8000-000000000403';  -- de outra equipe
  c_orf   constant uuid := 'ee000000-0000-4000-8000-000000000404';  -- sem relacionamento
  c_cli   constant uuid := 'ee000000-0000-4000-8000-000000000405';  -- empresa demandante
  r_com   constant uuid := 'ee000000-0000-4000-8000-000000000501';
  r_sem   constant uuid := 'ee000000-0000-4000-8000-000000000502';
  r_out   constant uuid := 'ee000000-0000-4000-8000-000000000503';
  r_cli   constant uuid := 'ee000000-0000-4000-8000-000000000504';
  id_ec   uuid;
  n       int;
  n2      int;
  n3      int;
begin
  if coalesce(current_setting('crm.cluster_local', true), 'nao') <> 'sim' then
    raise exception
      'Script exclusivo do cluster local (D-043). Ele fabrica perfis em auth.users. Rode por supabase/dev/reconstruir.sh --checks.'
      using errcode = '42501';
  end if;

  create temp table if not exists resultado_view (
    ordem int, ator text, caso text, esperado text, obtido text, status text
  );
  delete from resultado_view;

  insert into auth.users (id, email) values (p_a,'v.a@local'), (p_adm,'v.adm@local')
    on conflict (id) do nothing;
  insert into public.profiles (id, full_name, email, role) values
    (p_a,  '[view] Consultor A',  'v.a@local',   'comercial'),
    (p_adm,'[view] Administrador','v.adm@local', 'administrador')
    on conflict (id) do update set role = excluded.role, is_active = true;
  insert into public.teams (id, name) values (t1,'[view] Equipe 1'), (t2,'[view] Equipe 2')
    on conflict (id) do nothing;
  insert into public.sellers (id, full_name, team_id, profile_id) values
    (s_a,'[view] Consultor A', t1, p_a),
    (s_b,'[view] Consultor B', t2, null)
    on conflict (id) do update set team_id = excluded.team_id, profile_id = excluded.profile_id;

  insert into public.companies (id, legal_name, cnpj, is_merchant) values
    (c_com,'[view] Comércio com origem','66666666000101', true),
    (c_sem,'[view] Comércio sem origem','66666666000102', true),
    (c_out,'[view] Comércio de outra equipe','66666666000103', true),
    (c_orf,'[view] Comércio órfão','66666666000104', true)
    on conflict (id) do nothing;
  insert into public.companies (id, legal_name, cnpj, is_client_company) values
    (c_cli,'[view] Empresa cliente','66666666000105', true)
    on conflict (id) do nothing;

  -- A empresa cliente TAMBÉM ganha relacionamento, e é de propósito: ela é
  -- entidade comercial legítima, com responsável, mas NÃO é comércio
  -- credenciado. Sem esta linha, o filtro `is_merchant` da view não é
  -- exercitável — todas as fixtures seriam comércio e a remoção do filtro não
  -- mudaria nada. Foi a mutação M2 que revelou a falta.
  insert into public.crm_company_relationships (id, company_id, responsible_seller_id) values
    (r_com, c_com, s_a), (r_sem, c_sem, s_a), (r_out, c_out, s_b), (r_cli, c_cli, s_a)
    on conflict (id) do update set responsible_seller_id = excluded.responsible_seller_id;

  select id into id_ec from public.crm_demand_origins where match_key = 'EMPRESA_CLIENTE';
  insert into public.crm_accreditation_demands (merchant_company_id, origin_id, client_company_id)
  values (c_com, id_ec, c_cli), (c_out, id_ec, c_cli), (c_orf, id_ec, c_cli)
  on conflict do nothing;

  -- ── 1 · a view recorta ──────────────────────────────────────────────────
  -- Sem `security_invoker` a view roda como dona e devolve as quatro linhas.
  perform set_config('request.jwt.claim.sub', p_a::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_merchant_origin_status
   where company_id in (c_com, c_sem, c_out, c_orf);
  execute 'reset role';
  insert into resultado_view values (1, 'consultor A', 'vê só os comércios do escopo dele',
    '2 de 4', n || ' de 4',
    case when n = 2 then 'OK' else 'FALHA — a view atravessa a RLS' end);

  -- ── 2 · tem_origem lê sob a policy da demanda ───────────────────────────
  execute 'set local role authenticated';
  select count(*) into n  from public.crm_merchant_origin_status
   where company_id = c_com and tem_origem;
  select count(*) into n2 from public.crm_merchant_origin_status
   where company_id = c_sem and not tem_origem;
  execute 'reset role';
  insert into resultado_view values (2, 'consultor A', 'tem_origem: verdadeiro no com, falso no sem',
    '1 · 1', n || ' · ' || n2,
    case when n = 1 and n2 = 1 then 'OK' else 'FALHA' end);

  -- ── 3 · o comércio órfão não entra para o consultor ─────────────────────
  -- Ele TEM origem, mas nem a linha nem a demanda são visíveis a quem não é
  -- gestão. Se aparecesse aqui com `tem_origem` falso, o contador da página o
  -- marcaria como exceção — número plausível e errado.
  execute 'set local role authenticated';
  select count(*) into n from public.crm_merchant_origin_status where company_id = c_orf;
  execute 'reset role';
  insert into resultado_view values (3, 'consultor A', 'comércio sem relacionamento fora da lista',
    '0', n::text,
    case when n = 0 then 'OK' else 'FALHA — entraria no contador como exceção' end);

  -- ── 3b · empresa cliente com relacionamento NÃO é comércio ─────────────
  -- Ela tem responsável e é visível no escopo — o que a mantém fora da lista é
  -- só o `is_merchant` da view. Sem este caso, remover aquele filtro não
  -- reprovaria nada no comportamento.
  execute 'set local role authenticated';
  select count(*) into n from public.crm_merchant_origin_status where company_id = c_cli;
  execute 'reset role';
  insert into resultado_view values (4, 'consultor A', 'empresa cliente fora da lista de comércios',
    '0', n::text,
    case when n = 0 then 'OK' else 'FALHA — o filtro is_merchant caiu' end);

  -- ── 4 · A ARITMÉTICA DO CONTADOR ───────────────────────────────────────
  -- total, com origem e sem origem sobre a MESMA relação. Se as três não
  -- fecharem, lista e contador discordam — que é o defeito que a view existe
  -- para impedir.
  execute 'set local role authenticated';
  select count(*) into n  from public.crm_merchant_origin_status;
  select count(*) into n2 from public.crm_merchant_origin_status where tem_origem;
  select count(*) into n3 from public.crm_merchant_origin_status where not tem_origem;
  execute 'reset role';
  insert into resultado_view values (5, 'consultor A', 'total = com origem + sem origem',
    '2 = 1 + 1', n || ' = ' || n2 || ' + ' || n3,
    case when n = 2 and n2 = 1 and n3 = 1 and n = n2 + n3 then 'OK' else 'FALHA' end);

  -- ── 5 · a gestão enxerga tudo, inclusive o órfão ────────────────────────
  perform set_config('request.jwt.claim.sub', p_adm::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.crm_merchant_origin_status
   where company_id in (c_com, c_sem, c_out, c_orf);
  execute 'reset role';
  insert into resultado_view values (6, 'administrador', 'vê os três com relacionamento',
    '3 de 4', n || ' de 4',
    case when n = 3 then 'OK' else 'FALHA' end);

  -- ── 6 · a view é somente leitura ────────────────────────────────────────
  -- View com join não é atualizável no Postgres, e é bom que não seja: escrita
  -- passa pelas tabelas, onde as policies e as triggers estão.
  perform set_config('request.jwt.claim.sub', p_a::text, true);
  execute 'set local role authenticated';
  begin
    update public.crm_merchant_origin_status set legal_name = '[view] tentativa';
    n := 0;
  exception when others then n := 1;
  end;
  execute 'reset role';
  insert into resultado_view values (7, 'consultor A', 'UPDATE direto na view é recusado',
    'recusa', case when n = 1 then 'recusa' else 'ACEITOU' end,
    case when n = 1 then 'OK' else 'FALHA' end);

  -- ── limpeza ─────────────────────────────────────────────────────────────
  delete from public.crm_accreditation_demands
   where merchant_company_id in (c_com, c_sem, c_out, c_orf);
  delete from public.crm_company_relationships where id in (r_com, r_sem, r_out, r_cli);
  delete from public.companies where id in (c_com, c_sem, c_out, c_orf, c_cli);
  delete from public.sellers  where id in (s_a, s_b);
  delete from public.teams    where id in (t1, t2);
  delete from public.profiles where id in (p_a, p_adm);
  delete from auth.users      where id in (p_a, p_adm);
end
$$;

select ordem, ator, caso, esperado, obtido, status from resultado_view order by ordem;
