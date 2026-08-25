-- Perfis de teste — SÓ do cluster local, NUNCA aplicado no projeto hospedado.
--
-- Os scripts de `supabase/checks/*_comportamento.sql` precisam de um
-- administrador e de um não-administrador ativos para simular o JWT de cada um.
-- No projeto hospedado eles já existem: vieram do seed da estrutura comercial
-- (SPRINT-1-GATE). Aqui não existe seed, e sem eles o teste passaria pelo ramo
-- de pré-requisito em vez de medir a barreira.
--
-- Por isso este arquivo é aplicado LAZY, imediatamente antes do primeiro script
-- de comportamento — e não junto do harness de auth. Inserir perfis cedo
-- alteraria a contagem que `0002_verificacao.sql` faz sobre a tabela, e uma
-- fixture que muda o resultado de uma verificação de schema deixa de ser
-- fixture.
--
-- Nenhuma migration depende destas linhas.

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'harness.admin@exemplo.local'),
       ('22222222-2222-4222-8222-222222222222', 'harness.comercial@exemplo.local')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, email, role, is_active)
values ('11111111-1111-4111-8111-111111111111',
        '[harness] Administradora', 'harness.admin@exemplo.local', 'administrador', true),
       ('22222222-2222-4222-8222-222222222222',
        '[harness] Comercial', 'harness.comercial@exemplo.local', 'comercial', true)
on conflict (id) do update set role = excluded.role, is_active = true;
