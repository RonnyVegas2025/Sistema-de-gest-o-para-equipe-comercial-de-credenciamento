# RLS E PERMISSÕES — CRM Comercial de Credenciamento Vegas

> Proposta para aprovação. Nenhuma policy aplicada (D-021).
>
> **A RLS é a fronteira real de segurança.** Menu e guarda de rota são
> conveniência. Esconder um item de menu nunca é autorização.

---

# 1. Os dois eixos

```
PAPEL   → o que o usuário pode fazer   → matriz de capabilities (§3)
ESCOPO  → sobre quais registros        → estrutura comercial (§4)
```

Escopo **nunca** é inferido pelo papel (D-005). Um `gestor_adm` sem vínculo em
`managers` não enxerga estrutura alguma — e isso é correto.

Três camadas independentes, derivadas da mesma matriz:

1. **Menu** — o que aparece
2. **Rota** — guarda no Server Component, com redirect
3. **RLS** — a fronteira real

Sem a camada 2, quem digitar a URL chega na página. Sem a 3, quem chamar a API
direto lê tudo.

---

# 2. Papéis

| Papel | Uso no CRM |
| --- | --- |
| `administrador` | Acesso corporativo total, usuários, parâmetros, auditoria |
| `gestor_adm` | Gestão comercial: carteiras, distribuição, reatribuição, importações. **Diretores usam este papel**, com escopo maior por vínculo em `directors` |
| `analista_adm` | Apoio administrativo: cadastro de estabelecimentos e contatos, sem gestão de carteira |
| `comercial` | Consultor de campo: carteira própria, oportunidades, atividades, visitas, agenda |
| `financeiro` | Praticamente fora do CRM na V1 — não há dado financeiro; taxa negociada é condição comercial, não faturamento |
| `auditoria` | Consulta e exportação |

Conceder a `financeiro` por simetria seria abrir acesso sem necessidade
demonstrada. Melhor conceder depois, com caso concreto.

---

# 3. Matriz de capabilities

Espelho do lado TypeScript. Regra estrutural herdada e obrigatória:

```ts
canRead(role, module)
canWrite(role, module)
canInactivate(role, module)
```

Três funções nomeadas, **sem argumento com valor padrão**. Um parâmetro opcional
que muda semântica de segurança falha para o lado errado: esquecer o terceiro
argumento numa checagem de escrita passaria como leitura sem o TypeScript
reclamar.

A matriz é `Record<ModuleKey, Record<Capability, readonly AppRole[]>>` completo —
módulo novo não compila sem declarar as três capacidades. Lista vazia `[]` é
negação explícita, não omissão.

| Módulo | read | write | inactivate |
| --- | --- | --- | --- |
| `inicio` | todos | — | — |
| `minha_carteira` | admin · gestor · analista · comercial | comercial · gestor · admin | — |
| `oportunidades` | admin · gestor · analista · comercial · auditoria | comercial · analista · gestor · admin | admin |
| `agenda` | admin · gestor · analista · comercial | comercial · gestor · admin | — |
| `visitas` | admin · gestor · analista · comercial · auditoria | comercial · gestor · admin | — |
| `estabelecimentos` | todos | comercial · analista · gestor · admin | admin |
| `contatos` | admin · gestor · analista · comercial | comercial · analista · gestor · admin | comercial · analista · gestor · admin |
| `base_vegas` | admin · gestor · analista · comercial · auditoria | comercial · gestor · admin | — |
| `carteiras` | admin · gestor · analista · auditoria | gestor · admin | gestor · admin |
| `importacoes` | admin · gestor | gestor · admin | — |
| `produtos` | todos | gestor · admin | gestor · admin |
| `estrutura_comercial` | todos | gestor · admin | admin |
| `mapa` | admin · gestor · analista · comercial | — | — |
| `atividades` | admin · gestor · analista · comercial · auditoria | comercial · gestor · admin | — |
| `usuarios` | admin | admin | admin |
| `configuracoes` | admin · gestor · auditoria | admin | — |
| `auditoria` | admin · gestor · auditoria | — | — |

**Coluna `inactivate` × matriz de encerramento.** As duas precisam concordar, e a
§5.7 é a fonte. Quatro linhas merecem leitura atenta, porque contrariam o padrão
"inativar é sempre do administrador" herdado do sistema de origem:

- **`visitas` não tem inativação.** Visita é atividade, e atividade é histórico
  (D-022). Registro de visita errado se corrige por atividade nova, não some.
- **`contatos` é inativável pelo consultor** dentro do escopo. Contato que saiu
  da empresa é mudança natural, não erro de cadastro.
- **`carteiras` e `produtos` são inativáveis pelo gestor**, via
  `enforce_inactivation_is_manager_or_admin()`. Catálogo e carteira são
  instrumentos de gestão comercial, não cadastro mestre.

`crm_loss_reasons` é governada pelo módulo `produtos` — mesma natureza de
catálogo comercial, mesmas capabilities.

**Bloco DECLARADO-NÃO-VALIDADO.** Manter a convenção do sistema de origem:
separar no arquivo o que foi conferido contra a RLS aplicada do que ainda é
intenção. Não construir tela confiando em linha não validada — revisar contra a
policy da sprint e mover para o bloco validado ao fazê-lo.

**Sincronia TS × RLS é manual e é risco conhecido.** O mecanismo de detecção são
os testes de integração de §6, e eles fazem parte da definição de pronto (D-018).

---

# 4. Resolução de escopo

Peça que **não existe no sistema de origem** e é a construção central da Sprint 1.

## 4.1 Funções de identidade

Mesmo padrão validado de `auth_role()`: `stable`, `security definer`,
`set search_path = public`. O `security definer` não é descuido — evita recursão
de RLS ao consultar tabelas que também têm política.

```sql
current_seller_id()    → uuid    -- sellers.id do usuário, ou null
current_manager_id()   → uuid    -- managers.id do usuário, ou null
current_director_id()  → uuid    -- directors.id do usuário, ou null
```

Cada uma resolve por `profile_id = auth.uid()` e `status = 'ativo'`.

## 4.2 `scoped_seller_ids()`

Concentra a regra inteira. Retorna `setof uuid`.

```
administrador  → todos os sellers ativos
diretor        → sellers das equipes dos gestores da sua diretoria
                 directors → managers.director_id → teams.current_manager_id → sellers.team_id
gestor         → sellers das equipes que gerencia
                 managers → teams.current_manager_id → sellers.team_id
consultor      → apenas o próprio sellers.id
sem vínculo    → conjunto vazio
```

**União, nunca "primeiro papel encontrado"** (D-005). Uma pessoa pode ser diretor
e gestor, ou gestor e vendedor — as três funções de identidade podem retornar
valor simultaneamente para o mesmo `auth.uid()`, e a implementação soma os
conjuntos.

O caminho do gestor passa por `teams.current_manager_id`, **não** por
`managers.team_id` — coluna que não existe no CRM (D-017).

## 4.3 Índices que a função exige

Sem eles, cada avaliação de policy vira varredura:

```
sellers.team_id · sellers.profile_id
teams.current_manager_id
managers.director_id · managers.profile_id
directors.profile_id
crm_company_relationships.responsible_seller_id
```

## 4.4 Estado "sem vínculo"

Consultor sem linha em `sellers` com `profile_id` preenchido enxerga zero
registros — comportamento correto da RLS, mas indistinguível de "não há dados"
na tela. A interface precisa de estado dedicado: *"Seu usuário ainda não está
vinculado a um consultor. Procure o gestor."* Caso contrário, vira chamado de
suporte recorrente.

---

# 5. Políticas por tabela

## 5.1 Estrutura corporativa

`profiles` — administrador lê todos; qualquer um lê a própria linha. UPDATE:
próprio registro ou administrador, com `prevent_profile_tampering` restringindo
quais colunas mudam. Sem INSERT (nasce por trigger), sem DELETE.

`directors` · `managers` · `teams` · `sellers` — leitura ampla entre
autenticados; escrita por `administrador` e `gestor_adm`; inativação por
administrador via trigger.

> Leitura ampla aqui é deliberada: são nomes de colegas de trabalho, necessários
> para preencher selects de atribuição. O dado sensível não está aqui.

## 5.2 `companies` — exceção deliberada

```sql
create policy companies_select on companies
  for select using (public.auth_role() is not null);
```

Leitura ampla entre autenticados. **É intencional**, não repetição do DE-025: o
consultor não é dono do CNPJ (D-006), e a busca por CNPJ existente precisa
encontrar o estabelecimento mesmo fora do escopo — é o que evita cadastro
duplicado. O que o recorte protege é o **relacionamento**, não a **identidade**.

INSERT/UPDATE: `comercial`, `analista_adm`, `gestor_adm`, `administrador`.
Inativação: somente administrador, por trigger (D-022).

**Leitura ampla não é exibição ampla.** Ver §5.8.

## 5.3 Tabelas com recorte de escopo

Padrão aplicado a `crm_company_relationships`, `crm_opportunities`,
`crm_activities`, `crm_tasks`, `crm_portfolio_companies`:

```sql
using (
  responsible_seller_id in (select public.scoped_seller_ids())
)
```

Para tabelas cuja coluna de responsável é `seller_id`, o predicado é o mesmo
sobre essa coluna.

**Registros sem responsável** (`seller_id is null`) — carteira importada ainda
não distribuída — ficam visíveis a `gestor_adm` e `administrador`, não ao
consultor. Distribuir é ação de gestão.

## 5.4 `crm_contacts` — recorte por escopo (D-009)

Dado pessoal de terceiro. Diferente de `companies`, **não** tem leitura ampla:

```sql
using (
  exists (
    select 1 from crm_company_relationships r
    where r.company_id = crm_contacts.company_id
      and r.responsible_seller_id in (select public.scoped_seller_ids())
  )
  or public.has_role('administrador', 'gestor_adm')
)
```

Quem não tem o estabelecimento no alcance não lê seus contatos.

## 5.4-b Diretório de usuários para vínculo (D-032)

`profiles` não é lida pelo gestor (§5.1), mas os formulários de diretor, gestor e
vendedor precisam de uma lista de usuários para preencher `profile_id`. Uma
**view restrita** expõe apenas `id` e `full_name` dos perfis ativos.

**View sobre tabela com RLS é `security definer` na prática.** Ela roda com os
privilégios de quem a criou e **ignora a RLS da tabela base**; o `WHERE` da view
passa a ser a única barreira. O linter do Supabase aponta isso — é o mecanismo,
não defeito. Documentar no cabeçalho, não "corrigir".

Consequência operacional: acrescentar coluna à view alarga a leitura sem tocar em
policy nenhuma. Toda alteração nela é alteração de superfície de exposição.

## 5.5 Catálogos

`commercial_products` · `crm_loss_reasons` — leitura ampla; escrita
`gestor_adm` e `administrador`. Sem exclusão: produto ou motivo usado
historicamente permanece nos registros antigos.

## 5.6 Trilhas de histórico — imutáveis no banco (D-023)

`crm_opportunity_status_history` · `crm_assignment_history` ·
`crm_record_status_history`

```
SELECT   conforme o escopo do registro de origem
INSERT   nenhuma policy — negado por API
UPDATE   nenhuma policy — negado para todos
DELETE   nenhuma policy — negado para todos
```

Vale **inclusive para administrador via API normal**. Ausência de botão na
interface não é imutabilidade.

**Mecanismo, com as restrições que o tornam seguro.** A gravação acontece em
função de trigger `security definer`, propriedade do dono do banco — o único
caminho que atravessa a RLS. É o mesmo padrão da view `account_directory` do
sistema de origem, e o `security definer` é intencional, não atalho. Por isso:

```sql
security definer
set search_path = public                    -- fixo e mínimo
revoke execute on function ... from public, authenticated;
```

> ### `from public, authenticated` — os DOIS, e não é redundância
>
> **Revogar apenas de `authenticated` é inócuo.** O Postgres concede `EXECUTE` a
> `PUBLIC` por padrão ao criar uma função, e esse grant implícito sustenta o
> privilégio para todo mundo. Depois de `revoke execute ... from authenticated`,
> `has_function_privilege('authenticated', f, 'EXECUTE')` continua devolvendo
> **true**, e a função segue chamável pela API.
>
> Verificado em banco durante a Sprint 1:
>
> ```
> revoke só de authenticated  →  has_function_privilege = true   (não mudou nada)
> revoke de public TAMBÉM     →  has_function_privilege = false  (agora sim)
> ```
>
> É armadilha de repetição: a próxima função de trilha será escrita por alguém
> que revoga só de `authenticated` achando que basta — e nada dará sinal, porque
> a trilha continua gravando normalmente. O único sintoma é o teste de ataque de
> §6.2 passar a permitir a chamada direta.
>
> Por isso o teste de ataque de cada função de trilha **verifica os dois
> grants**, não só um.

**Uma função por entidade de origem.** Nada de gravador genérico de histórico:
uma função capaz de inserir qualquer `scope` com qualquer `target_id` anularia a
imutabilidade, bastando chamá-la com os argumentos certos. Cada trilha nasce
exclusivamente da mutação da entidade correspondente. Lógica comum vive em
helper sem `security definer` e sem `execute` concedido.

**Filtro no `WHEN` da declaração da trigger**, com `is distinct from` (D-025) —
`UPDATE` que não muda o valor não gera linha de trilha.

O Security Advisor do Supabase vai apontar essas funções como lint. É o
mecanismo; documentar a exceção no cabeçalho, não "corrigir".

Correção histórica, se algum dia necessária, é procedimento administrativo
explícito e registrado. Não se abre `UPDATE` genérico.

## 5.7 Enforcement de inativação — três funções, não uma (D-022)

Copiar `enforce_inactivation_is_admin()` para todas as entidades deixaria o
gestor dependente do administrador para operação corriqueira, e transformaria o
banco num cemitério de registros "inativos" que só foram concluídos.

| Função | Aplicada a | Quem pode inativar |
| --- | --- | --- |
| `enforce_inactivation_is_admin()` | `companies`, `directors`, `managers`, `teams`, `sellers`, `crm_company_relationships`, `crm_opportunities.record_status` | administrador |
| `enforce_inactivation_is_manager_or_admin()` | `commercial_products`, `crm_loss_reasons`, `crm_portfolios` | `gestor_adm` · administrador |
| — sem trigger — | `crm_contacts` | comercial · gestor **dentro do escopo**; o recorte da RLS já é a barreira |
| — sem conceito — | `crm_tasks`, `crm_activities` | tarefa se conclui ou cancela; atividade é histórico |

**Reativação é sempre de administrador** (D-025), inclusive nas entidades cuja
inativação coube ao gestor. `inativo → ativo` exige motivo e gera linha em
`crm_record_status_history`. Trigger `enforce_reactivation_is_admin()`, separada
das funções de inativação — quem pode tirar de circulação não é
automaticamente quem pode devolver.

Atenção operacional: reativar devolve o registro aos índices únicos parciais e
pode colidir com `companies_cnpj_active_unique` ou
`crm_opportunities_active_unique`. O banco recusa corretamente; a interface
precisa traduzir o motivo, não repassar erro de constraint.

**Encerramento operacional não passa por nenhuma dessas funções.** É escrita
normal, autorizada pela policy de UPDATE e recortada pelo escopo:

```
crm_company_relationships.ended_at   gestor no escopo
crm_portfolio_companies.ended_at     gestor no escopo
crm_portfolios.closed_at             gestor · admin
crm_opportunities.status             comercial · gestor no escopo
crm_tasks.status                     responsável · gestor
```

---

# 5.8 RLS não é a única camada de exposição (D-024)

Duas perguntas diferentes, respondidas em lugares diferentes:

```
RLS:        esta linha pode ser consultada por este usuário?
Aplicação:  quanto desta informação deve aparecer neste contexto?
```

`companies` responde "sim" para qualquer autenticado. Isso **não** autoriza a
ficha completa de uma empresa fora da carteira do consultor. Na busca por CNPJ
fora do escopo, a projeção é reduzida a identidade cadastral:

```
CNPJ · Razão Social · Nome Fantasia · Cidade
Situação: estabelecimento já cadastrado
Atribuição: já atribuído
```

Sem ficha operacional, sem histórico, sem contatos. O detalhe do responsável
segue D-016.

**A exceção de `companies` é de identidade cadastral e não é precedente.**
`crm_contacts`, `crm_company_relationships`, `crm_opportunities`, `crm_tasks` e
`crm_activities` continuam recortados na própria RLS. Ninguém deve concluir mais
tarde que "`companies` tem SELECT amplo, logo o CRM inteiro poderia ter".

---

# 6. Verificação

## 6.1 Testes obrigatórios de RLS

Definição de pronto de toda sprint que toque em policy (D-018). Para cada papel
e cada vínculo:

| Cenário | Esperado |
| --- | --- |
| Consultor lê carteira de outro consultor | zero linhas |
| Consultor lê a própria carteira | as linhas dele |
| Gestor lê carteira de consultor da sua equipe | visível |
| Gestor lê carteira de equipe de outro gestor | zero linhas |
| Diretor lê carteira de qualquer gestor sob si | visível |
| Diretor lê carteira de outra diretoria | zero linhas |
| Pessoa gestor **e** vendedor | união dos dois conjuntos |
| Usuário sem vínculo em `sellers` | zero linhas, sem erro |
| Consultor tenta reatribuir | negado |
| Gestor reatribui fora do escopo | negado |
| Qualquer papel tenta DELETE | negado |
| Usuário altera o próprio `role` | negado pelo trigger |
| Consultor lê contatos de empresa fora do escopo | zero linhas |
| Consultor busca CNPJ fora do escopo | encontra a empresa, não o responsável |
| Consultor busca CNPJ fora do escopo | recebe só a projeção reduzida de §5.8 |
| **Administrador** faz UPDATE em `crm_assignment_history` | negado |
| **Administrador** faz DELETE em `crm_opportunity_status_history` | negado |
| Qualquer papel faz INSERT direto em tabela de histórico | negado |
| Mudança de status de oportunidade | linha aparece no histórico, gravada pela trigger |
| Reatribuição de carteira | vínculo anterior com `ended_at`, linha nova, evento no histórico |
| Gestor encerra vínculo de carteira no escopo | permitido, sem depender de admin |
| Gestor tenta inativar `companies` | negado |
| Gestor inativa `commercial_products` | permitido |
| Consultor inativa contato no escopo | permitido, com `inactivated_at` preenchido |
| Oportunidade inativada por erro | deixa de bloquear o índice único de ativa |
| Inativação de qualquer entidade | grava `inactivated_at`, `inactivated_by`, motivo, e linha em `crm_record_status_history` |
| Gestor tenta reativar catálogo que ele mesmo inativou | negado — reativação é de administrador |
| Administrador reativa com motivo | permitido, com linha na trilha cadastral |
| Reativar empresa cujo CNPJ foi recadastrado | recusado pelo índice único, com mensagem traduzida |
| `UPDATE` que não altera status nem responsável | **nenhuma** linha de trilha gerada |
| Responsável passa de nulo para definido | linha de trilha gerada (`is distinct from`) |
| Chamar função de trilha diretamente pela API | negado — `execute` revogado |

## 6.2 Testes de ataque às funções privilegiadas

Não basta validar o caminho feliz do trigger. Para **cada** função de trilha, com
usuário autenticado comum:

| Tentativa | Esperado |
| --- | --- |
| `select public.write_opportunity_status_history()` | erro de permissão |
| `select public.write_assignment_history_*()` | erro de permissão |
| `select public.write_record_status_*()` | erro de permissão |
| `insert into crm_opportunity_status_history ...` | negado pela RLS |
| `insert into crm_assignment_history ...` | negado pela RLS |
| `insert into crm_record_status_history ...` | negado pela RLS |
| Idem, autenticado como **administrador** | negado igualmente |

Uma função nova de trilha sem o teste correspondente é lacuna, não omissão
menor: `revoke execute` esquecido não quebra nada visível — só abre a porta.

## 6.3 Teste específico do header de perfil (D-019)

Requisição com `x-user-profile` forjado pelo cliente **não** deve alterar o
perfil efetivo. O `delete` no middleware precede o `set` e não é opcional.

## 6.4 Verificação no CI

Herdada do sistema de origem: `format:check && lint && typecheck && test &&
build`, mais a etapa que falha o build se `SUPABASE_SERVICE_ROLE_KEY` aparecer em
`.next/static`.

---

# 7. Regras invioláveis

1. Não relaxar RLS para fazer uma tela funcionar.
2. Não colocar service role no frontend — apenas em Edge Function.
3. Não considerar ocultação de botão ou item de menu como autorização.
4. Nenhuma policy de DELETE em entidade operacional. E nenhuma policy de INSERT,
   UPDATE ou DELETE em tabela de histórico — nem para administrador.
5. Não existe função universal de inativação. Encerrar ≠ inativar (§5.7).
6. Migration com `drop policy` sempre em transação — sem isso, falha após o
   `drop` deixa a tabela sem SELECT e derruba o login de todos, admin incluído.
7. View ou função `security definer` ignora a RLS da tabela base, e o `WHERE`
   dela é a única barreira. Documentar no cabeçalho; o linter do Supabase vai
   apontar, e alguém vai querer "corrigir".
