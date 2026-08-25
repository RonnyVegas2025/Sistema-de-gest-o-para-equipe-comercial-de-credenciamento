-- Comportamento do trigger da 0014 — D-042, decisões 3 e 4.
--
-- ATENÇÃO: este script ESCREVE. É diferente dos `*_verificacao.sql`, que são
-- somente leitura.
--
-- Ele cria três empresas de teste com UUID fixo, tenta seis inserções, registra
-- o que cada uma fez, e APAGA tudo que criou ao final. Reexecutável.
--
-- ===========================================================================
-- POR QUE ELE EXISTE, e por que a verificação estrutural não bastava
--
-- `0014_verificacao.sql` confere que o trigger EXISTE, que é `BEFORE INSERT OR
-- UPDATE` e que não é `security definer`. **Não confere o que ele faz.**
--
-- Medido: trocando o corpo do trigger por uma implicação simples — sem a
-- segunda direção da bicondicional —, a verificação segue com todas as linhas
-- OK e a linha proibida entra. O mesmo vale removendo a checagem de
-- `is_client_company`.
--
-- Estrutura e comportamento são coisas diferentes, e a mutação foi o que
-- revelou a diferença. Um script que só olha o catálogo do Postgres é cego para
-- o corpo da função.
-- ===========================================================================

do $$
declare
  id_ec   uuid;
  id_mr   uuid;
  ok      boolean;
begin
  -- Sem `on commit drop`: o bloco DO é a sua própria transação, e a tabela
  -- morreria antes do SELECT final. Ela vive na sessão e some com a conexão.
  create temp table if not exists resultado_0014 (
    ordem int, caso text, esperado text, obtido text, status text
  );
  delete from resultado_0014;

  select id into id_ec from public.crm_demand_origins where match_key = 'EMPRESA_CLIENTE';
  select id into id_mr from public.crm_demand_origins where match_key = 'MELHORIA_REDE_VENDA_NOVA';

  insert into public.companies (id, legal_name, cnpj, is_merchant)
  values ('cc000000-0000-4000-8000-00000000000a','[teste] Comércio A','99999999000101', true),
         ('cc000000-0000-4000-8000-00000000000b','[teste] Comércio B','99999999000102', true)
  on conflict (id) do nothing;
  insert into public.companies (id, legal_name, cnpj, is_client_company)
  values ('ee000000-0000-4000-8000-00000000000a','[teste] Empresa Cliente','99999999000103', true),
         ('ee000000-0000-4000-8000-00000000000b','[teste] Empresa Cliente 2','99999999000104', true)
  on conflict (id) do nothing;

  -- 1 -----------------------------------------------------------------
  begin
    insert into public.crm_accreditation_demands (merchant_company_id, origin_id, client_company_id)
    values ('cc000000-0000-4000-8000-00000000000a', id_ec, 'ee000000-0000-4000-8000-00000000000a');
    ok := true;
  exception when others then ok := false;
  end;
  insert into resultado_0014 values (1, 'empresa_cliente COM empresa', 'aceita',
    case when ok then 'aceita' else 'RECUSADA' end,
    case when ok then 'OK' else 'FALHA' end);

  -- 2 -----------------------------------------------------------------
  begin
    insert into public.crm_accreditation_demands (merchant_company_id, origin_id)
    values ('cc000000-0000-4000-8000-00000000000a', id_ec);
    ok := true;
  exception when others then ok := false;
  end;
  insert into resultado_0014 values (2, 'empresa_cliente SEM empresa', 'recusa',
    case when ok then 'ACEITOU' else 'recusa' end,
    case when ok then 'FALHA' else 'OK' end);

  -- 3 -----------------------------------------------------------------
  begin
    insert into public.crm_accreditation_demands (merchant_company_id, origin_id)
    values ('cc000000-0000-4000-8000-00000000000b', id_mr);
    ok := true;
  exception when others then ok := false;
  end;
  insert into resultado_0014 values (3, 'melhoria de rede SEM empresa', 'aceita',
    case when ok then 'aceita' else 'RECUSADA' end,
    case when ok then 'OK' else 'FALHA' end);

  -- 4 — A SEGUNDA DIREÇÃO DA BICONDICIONAL ----------------------------
  -- É a que uma implicação simples deixaria passar, e a que corrompe a
  -- contagem por origem: a linha fica ambígua e PARECE mais completa que as
  -- corretas.
  begin
    insert into public.crm_accreditation_demands (merchant_company_id, origin_id, client_company_id)
    values ('cc000000-0000-4000-8000-00000000000b', id_mr, 'ee000000-0000-4000-8000-00000000000a');
    ok := true;
  exception when others then ok := false;
  end;
  insert into resultado_0014 values (4, 'melhoria de rede COM empresa', 'recusa',
    case when ok then 'ACEITOU — a bicondicional caiu' else 'recusa' end,
    case when ok then 'FALHA' else 'OK' end);

  -- 5 — comércio como demandante de si mesmo --------------------------
  begin
    insert into public.crm_accreditation_demands (merchant_company_id, origin_id, client_company_id)
    values ('cc000000-0000-4000-8000-00000000000a', id_ec, 'cc000000-0000-4000-8000-00000000000b');
    ok := true;
  exception when others then ok := false;
  end;
  insert into resultado_0014 values (5, 'demandante sem is_client_company', 'recusa',
    case when ok then 'ACEITOU — comércio virou demandante' else 'recusa' end,
    case when ok then 'FALHA' else 'OK' end);

  -- 6 — o N:N ---------------------------------------------------------
  begin
    insert into public.crm_accreditation_demands (merchant_company_id, origin_id, client_company_id)
    values ('cc000000-0000-4000-8000-00000000000a', id_ec, 'ee000000-0000-4000-8000-00000000000b');
    ok := true;
  exception when others then ok := false;
  end;
  insert into resultado_0014 values (6, 'mesmo comércio, segunda demandante (N:N)', 'aceita',
    case when ok then 'aceita' else 'RECUSADA — o N:N caiu' end,
    case when ok then 'OK' else 'FALHA' end);

  -- limpeza ------------------------------------------------------------
  delete from public.crm_accreditation_demands
   where merchant_company_id in ('cc000000-0000-4000-8000-00000000000a',
                                 'cc000000-0000-4000-8000-00000000000b');
  delete from public.companies
   where id in ('cc000000-0000-4000-8000-00000000000a','cc000000-0000-4000-8000-00000000000b',
                'ee000000-0000-4000-8000-00000000000a','ee000000-0000-4000-8000-00000000000b');
end
$$;

select ordem, caso, esperado, obtido, status from resultado_0014 order by ordem;
