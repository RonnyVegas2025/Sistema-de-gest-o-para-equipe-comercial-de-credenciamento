-- Seed da estrutura comercial para o gate de cinco usuários — Sprint 1.
--
-- IDEMPOTENTE: pode ser reexecutado. Não cria usuários; ELES PRECISAM EXISTIR
-- antes, criados pelo painel de Auth ou pela Edge Function.
--
-- PARA POR ERRO se algum dos cinco faltar, em vez de montar uma estrutura pela
-- metade — que é o modo silencioso de o gate dar um número errado e ninguém
-- saber por quê.
--
-- Os cinco e-mails abaixo são os esperados. Se você usou outros, troque-os aqui
-- (apenas aqui — o resto do arquivo os referencia por e-mail).

do $$
declare
  id_admin      uuid;
  id_consultor  uuid;
  id_gestor     uuid;
  id_diretor    uuid;
  id_duplo      uuid;
  faltando      text := '';
begin
  select id into id_admin     from public.profiles where email = 'admin@vegascard.com.br';
  select id into id_consultor from public.profiles where email = 'consultor@vegascard.com.br';
  select id into id_gestor    from public.profiles where email = 'gestor@vegascard.com.br';
  select id into id_diretor   from public.profiles where email = 'diretor@vegascard.com.br';
  select id into id_duplo     from public.profiles where email = 'duplo@vegascard.com.br';

  if id_admin     is null then faltando := faltando || ' admin@vegascard.com.br';     end if;
  if id_consultor is null then faltando := faltando || ' consultor@vegascard.com.br'; end if;
  if id_gestor    is null then faltando := faltando || ' gestor@vegascard.com.br';    end if;
  if id_diretor   is null then faltando := faltando || ' diretor@vegascard.com.br';   end if;
  if id_duplo     is null then faltando := faltando || ' duplo@vegascard.com.br';     end if;

  if faltando <> '' then
    raise exception 'Usuários ausentes:%. Crie-os antes (painel de Auth ou Edge Function) e rode de novo.', faltando;
  end if;

  -- ---------------------------------------------------------------------
  -- Papéis. Diretor e duplo são `gestor_adm`: não existe papel `diretor`
  -- (D-005) — papel diz o que faz, hierarquia diz sobre o quê.
  -- ---------------------------------------------------------------------
  update public.profiles set role = 'administrador' where id = id_admin;
  update public.profiles set role = 'comercial'     where id = id_consultor;
  update public.profiles set role = 'gestor_adm'    where id in (id_gestor, id_diretor, id_duplo);

  -- ---------------------------------------------------------------------
  -- Diretorias. A segunda existe para provar o que o diretor NÃO alcança.
  -- ---------------------------------------------------------------------
  insert into public.directors (id, full_name, profile_id) values
    ('d1000000-0000-4000-8000-000000000001', 'Diretoria do Gate', id_diretor),
    ('d2000000-0000-4000-8000-000000000002', 'Diretoria de Fora', null)
  on conflict (id) do update set profile_id = excluded.profile_id;

  -- ---------------------------------------------------------------------
  -- Gestores. O DUPLO é gestor aqui e vira consultor mais abaixo — é ele que
  -- prova a união de escopos (D-005). O "Gestor de Fora" fica na outra
  -- diretoria, sem conta de acesso.
  -- ---------------------------------------------------------------------
  insert into public.managers (id, full_name, profile_id, director_id) values
    ('11100000-0000-4000-8000-000000000001', 'Gestor do Gate', id_gestor,
     'd1000000-0000-4000-8000-000000000001'),
    ('22200000-0000-4000-8000-000000000002', 'Gestor Duplo',   id_duplo,
     'd1000000-0000-4000-8000-000000000001'),
    ('33300000-0000-4000-8000-000000000003', 'Gestor de Fora', null,
     'd2000000-0000-4000-8000-000000000002')
  on conflict (id) do update
    set profile_id = excluded.profile_id, director_id = excluded.director_id;

  -- ---------------------------------------------------------------------
  -- Equipes. Uma por gestor, mais uma sem gestor — que ninguém deve alcançar
  -- por hierarquia.
  -- ---------------------------------------------------------------------
  insert into public.teams (id, name, current_manager_id) values
    ('11110000-0000-4000-8000-000000000001', 'Equipe do Gestor', '11100000-0000-4000-8000-000000000001'),
    ('22220000-0000-4000-8000-000000000002', 'Equipe do Duplo',  '22200000-0000-4000-8000-000000000002'),
    ('33330000-0000-4000-8000-000000000003', 'Equipe de Fora',   '33300000-0000-4000-8000-000000000003'),
    ('44440000-0000-4000-8000-000000000004', 'Equipe Sem Gestor', null)
  on conflict (id) do update set current_manager_id = excluded.current_manager_id;

  -- ---------------------------------------------------------------------
  -- Consultores.
  --
  -- O DUPLO entra aqui de propósito numa equipe que ele NÃO gerencia — a
  -- "Equipe de Fora". Se ele fosse consultor da própria equipe, o conjunto de
  -- gestor já o conteria, e a união seria indistinguível de "primeiro papel
  -- encontrado". Estando fora, a união é a única forma de ele ver a si mesmo.
  -- ---------------------------------------------------------------------
  insert into public.sellers (id, full_name, profile_id, team_id) values
    ('55550000-0000-4000-8000-000000000001', 'Consultor do Gate', id_consultor,
     '11110000-0000-4000-8000-000000000001'),
    ('55550000-0000-4000-8000-000000000002', 'Consultor Colega',  null,
     '11110000-0000-4000-8000-000000000001'),
    ('55550000-0000-4000-8000-000000000003', 'Consultor do Duplo', null,
     '22220000-0000-4000-8000-000000000002'),
    ('55550000-0000-4000-8000-000000000004', 'Consultor de Fora',  null,
     '33330000-0000-4000-8000-000000000003'),
    ('55550000-0000-4000-8000-000000000005', 'Gestor Duplo',       id_duplo,
     '33330000-0000-4000-8000-000000000003')
  on conflict (id) do update
    set profile_id = excluded.profile_id, team_id = excluded.team_id;

  raise notice 'Seed aplicado. 2 diretorias, 3 gestores, 4 equipes, 5 consultores.';
end
$$;

-- Conferência imediata do que foi montado.
select 'perfis'      as o_que, count(*) as quantos from public.profiles
union all select 'diretorias',  count(*) from public.directors
union all select 'gestores',    count(*) from public.managers
union all select 'equipes',     count(*) from public.teams
union all select 'consultores', count(*) from public.sellers;

select p.email, p.role,
       d.full_name as diretor_de,
       m.full_name as gestor_de,
       s.full_name as consultor_de
from public.profiles p
left join public.directors d on d.profile_id = p.id
left join public.managers  m on m.profile_id = p.id
left join public.sellers   s on s.profile_id = p.id
order by p.email;
