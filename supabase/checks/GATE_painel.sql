-- GATE DE CINCO USUÁRIOS — versão para o SQL Editor do painel.
--
-- Diferença para 0009_gate_cinco_usuarios.sql: aquele usa \set e vários
-- begin/rollback, o que só funciona no psql — o editor do painel mostra apenas
-- o resultado da última instrução. Este arquivo é UMA colagem só e devolve UMA
-- tabela com todos os casos, já comparados com o esperado.
--
-- SOMENTE LEITURA. Não cria, não altera e não apaga nada de verdade: a única
-- escrita é uma tabela TEMPORÁRIA, que morre junto com a conexão.
--
-- PRÉ-REQUISITO: supabase/seed/gate_estrutura.sql já aplicado com sucesso.
--
-- Os valores esperados abaixo são os da estrutura montada por aquele seed.
-- Se algum vier diferente, ou a estrutura não é a do seed, ou a resolução de
-- escopo está errada — as duas hipóteses precisam ser investigadas, nenhuma
-- delas se ignora.

drop table if exists pg_temp.gate_resultado;

create temp table gate_resultado (
  ordem    int,
  caso     text,
  esperado int,
  obtido   int,
  status   text,
  quem     text
);

do $$
declare
  c      record;
  uid    uuid;
  n      int;
  nomes  text;
begin
  for c in
    select * from (values
      (1, 'consultor',           'consultor@vegascard.com.br', 1),
      (2, 'gestor',              'gestor@vegascard.com.br',    2),
      (3, 'diretor',             'diretor@vegascard.com.br',   3),
      (4, 'administrador',       'admin@vegascard.com.br',     5),
      (5, 'vínculo duplo',       'duplo@vegascard.com.br',     2)
    ) as t(ordem, caso, email, esperado)
    order by 1
  loop
    select p.id into uid from public.profiles p where p.email = c.email;

    if uid is null then
      insert into gate_resultado
        values (c.ordem, c.caso, c.esperado, null, 'USUÁRIO AUSENTE', c.email);
      continue;
    end if;

    -- `true` = local à transação: o claim não vaza para fora deste bloco.
    perform set_config('request.jwt.claim.sub', uid::text, true);

    select count(*), string_agg(s.full_name, ', ' order by s.full_name)
      into n, nomes
      from public.sellers s
     where s.id in (select public.scoped_seller_ids());

    insert into gate_resultado values (
      c.ordem, c.caso, c.esperado, n,
      case when n = c.esperado then 'OK' else 'FALHA' end,
      nomes
    );
  end loop;

  -- ---------------------------------------------------------------------
  -- 6. SEM VÍNCULO. Um uuid que não é de ninguém. Tem de devolver conjunto
  --    vazio SEM levantar erro: zero por falta de vínculo é indistinguível
  --    de zero por falta de dados, e é a aplicação que separa os dois.
  -- ---------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub',
                     '00000000-0000-0000-0000-000000000000', true);
  select count(*) into n from public.scoped_seller_ids();
  insert into gate_resultado values (
    6, 'sem vínculo', 0, n,
    case when n = 0 then 'OK' else 'FALHA' end,
    'nenhum — e sem erro'
  );

  -- ---------------------------------------------------------------------
  -- 7. O QUE NÃO SE VÊ. O gate só vale se também provar a exclusão: um
  --    escopo que devolve tudo passa nos casos 1 a 5 por acidente.
  -- ---------------------------------------------------------------------
  select p.id into uid from public.profiles p
   where p.email = 'gestor@vegascard.com.br';
  if uid is not null then
    perform set_config('request.jwt.claim.sub', uid::text, true);
    select count(*), string_agg(s.full_name, ', ' order by s.full_name)
      into n, nomes
      from public.sellers s
     where s.status = 'ativo'
       and s.id not in (select public.scoped_seller_ids());
    insert into gate_resultado values (
      7, 'fora do alcance do gestor', 3, n,
      case when n = 3 then 'OK' else 'FALHA' end, nomes
    );
  end if;

  -- ---------------------------------------------------------------------
  -- 8. A UNIÃO, CONFERIDA À MÃO.
  --
  --    Este é o caso que uma implementação errada reprova. Com "primeiro
  --    papel encontrado", os casos 1 a 4 devolvem exatamente os mesmos
  --    números; só o duplo cai, porque o ramo de gestor casa primeiro e o de
  --    consultor nunca roda (D-005). Aqui os dois conjuntos são somados fora
  --    da função e comparados com o que ela devolveu.
  -- ---------------------------------------------------------------------
  select p.id into uid from public.profiles p
   where p.email = 'duplo@vegascard.com.br';
  if uid is not null then
    perform set_config('request.jwt.claim.sub', uid::text, true);

    select count(distinct x.id) into n from (
      select s.id from public.sellers s
       where s.status = 'ativo' and s.id = public.current_seller_id()
      union
      select s.id from public.sellers s
        join public.teams t on t.id = s.team_id
       where s.status = 'ativo' and t.status = 'ativo'
         and t.current_manager_id = public.current_manager_id()
    ) x;

    insert into gate_resultado
    select 8, 'união conferida à mão', n,
           (select count(*) from public.scoped_seller_ids()),
           case when n = (select count(*) from public.scoped_seller_ids())
                then 'OK' else 'FALHA' end,
           'esperado = soma feita fora da função';
  end if;
end
$$;

select ordem, caso, esperado, obtido, status, quem
from gate_resultado
order by ordem;
