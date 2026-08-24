-- Espelho das policies de public.profiles.
--
-- NÃO é aplicado por si só. As policies vão ao banco pela migration que as cria
-- (0001_profiles.sql); este arquivo existe para o estado das policies ser
-- legível por domínio, sem abrir o painel nem reler migrations. A sincronia
-- entre os dois é manual.
--
-- Fonte: RLS_PERMISSOES.md §5.1.

alter table public.profiles enable row level security;

-- SELECT — a própria linha; administrador lê todas.
--
-- Sem `gestor_adm`, de propósito. A matriz §3 dá `usuarios.read` só ao
-- administrador, e a policy do sistema de origem inclui o gestor — divergência
-- que a origem registra e não reconciliou. Aqui a policy segue a matriz.
--
-- CONSEQUÊNCIA CONHECIDA, a resolver antes da 0005/0006: o formulário de gestor
-- e de vendedor permite vincular a pessoa a um usuário existente (`profile_id`),
-- e quem escreve ali é `gestor_adm` além do administrador. Com esta policy, o
-- gestor não enxerga a lista de usuários para escolher. As saídas são uma view
-- restrita expondo só id e nome para vínculo, ou alargar esta policy. Decidir
-- antes de construir a tela, não durante.
create policy profiles_select on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_admin()
  );

-- UPDATE — a própria linha ou administrador.
--
-- A policy diz QUAIS LINHAS; o trigger prevent_profile_tampering diz QUAIS
-- COLUNAS: ninguém altera o próprio role ou is_active, administrador incluído,
-- e e-mail só administrador altera.
create policy profiles_update on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- INSERT — nenhuma policy. profiles nasce pelo trigger handle_new_user.
-- DELETE — nenhuma policy. Saída de circulação é is_active = false.
--
-- Atenção ao comportamento real: sem policy, a RLS FILTRA em vez de levantar
-- erro. Um DELETE devolve `DELETE 0` e um UPDATE de linha alheia devolve
-- `UPDATE 0`, ambos sem exceção. A aplicação não pode depender de erro para
-- saber que a operação foi negada — tem de conferir a contagem de linhas
-- afetadas. Só o trigger levanta exceção.
