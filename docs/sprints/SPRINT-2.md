# SPRINT 2 — Estabelecimentos, CNPJ e contatos

> **Autorizada.** Plano aprovado com as três decisões registradas abaixo.

Fontes canônicas: `DECISOES.md` · `MODELO_DADOS.md` · `RLS_PERMISSOES.md` ·
`ARQUITETURA.md` · `VEGAS-PLATFORM-UI-STANDARD.md`.

Estado de partida: Sprint 1 encerrada, onze migrations aplicadas e verificadas
contra o banco real (255 checagens), gate de cinco usuários 8/8, aplicação no ar
em `https://sistema-de-gest-o-para-equipe-comer.vercel.app`.

---

# O que esta sprint fecha

A Sprint 1 entregou `scoped_seller_ids()` provada **sem nenhuma tabela onde
prendê-la**. A função está provada; o *enforcement* não. É esta sprint que fecha
D-018 — e é por isso que a regra de aceite da §"Regra inegociável" existe.

Duas pendências da Sprint 1 morrem aqui:

- a Edge Function `admin-create-user` ganha o chamador que lhe falta (etapa 1);
- os cenários de `RLS_PERMISSOES.md` §6.1 que dependiam de tabelas com recorte
  passam a ser verificáveis (etapa 8).

---

# Regra de aceite inegociável

**Nenhuma tabela `crm_*` é criada sem a sua policy com recorte na mesma
migration.** Não em migration seguinte, não "depois que a tela existir". E o
script de verificação daquela migration confere que o recorte está lá.

Emenda a D-018, aprovada ao fim da Sprint 1.

**Por que é regra e não recomendação.** É a situação exata que produziu o DE-025
no sistema de origem, onde uma leitura ampla "provisória" seguiu aberta três
sprints. Lá também a intenção existia; o que faltou foi o momento em que a
dívida se tornava visível. Esta regra é esse momento: a migration não passa na
verificação sem o recorte.

## O que cada script confere, por tabela `crm_*`

| Checagem | Por quê |
| --- | --- |
| `relrowsecurity = true` | RLS ligada não é default |
| policy de SELECT cujo `qual` contém `scoped_seller_ids` | a regra, literal |
| o ramo `gestor_adm` / `administrador` existe | §5.3: registro sem responsável é visível à gestão, nunca ao consultor |
| nenhuma policy de DELETE | regra inviolável |
| índice na coluna de responsável | sem ele toda avaliação de policy vira varredura |

Mesma forma dos onze scripts da Sprint 1: consulta única, somente leitura,
colunas `secao · verificacao · esperado · obtido · status`, todas as linhas `OK`.

## Prova por mutação — o script só vale se reprovar

Para cada migration com recorte: trocar o predicado por `using (true)`,
confirmar que o script acusa, restaurar. Sem isso o script é uma afirmação, não
uma garantia — e verificação de segurança que passa por vacuidade é pior que
verificação nenhuma, porque cria confiança.

## A exceção de `companies`, escrita antes de alguém perguntar

`companies` **não é `crm_*` e não tem coluna de responsável.** D-006: *o
consultor não é proprietário da empresa; identidade não tem dono.* Sua leitura é
ampla de propósito — a busca por CNPJ tem de encontrar o estabelecimento mesmo
fora do escopo, senão o índice único parcial vira erro de duplicidade sem
explicação, que é o que D-006 e D-016 existem para evitar. `RLS_PERMISSOES.md`
§5.2 já traz a policy e o rationale.

**Isso vai escrito no cabeçalho da `0012` e no seu script de verificação**, que
registra a ausência de recorte como resultado esperado, com o motivo. Tabela sem
recorte e sem explicação é como dívida silenciosa começa: quem lê seis meses
depois não distingue decisão de omissão.

O que o recorte protege é o **relacionamento**, não a **identidade**. E leitura
ampla não é exibição ampla (D-024): a RLS diz se a linha é legível, a aplicação
diz quanto exibir.

---

# Ordem de execução

Sequencial. Não paralelizar, não antecipar etapa posterior.

**Uma migration por vez**, aplicada pelo SQL Editor (D-031), com o seu script de
verificação devolvendo todas as linhas `OK` antes da próxima. Migration aplicada
nunca é editada; correção é migration nova.

```
1  Tela de usuários                      sem migration
2  Correção do CI                        sem migration
3  0012  companies                       leitura ampla, exceção documentada
4  Contrato CnpjProvider                 sem migration
5  0013  relacionamento + enums          primeiro enforcement real do recorte
6  0014  crm_contacts                    recorte transitivo
7  Página do estabelecimento             sem migration
8  Bateria de RLS §6.1                   sem migration
9  Verificação final e documentação      sem migration
```

---

## 1 · Tela de usuários — o chamador que falta

**Escopo novo**, acrescentado ao `ROADMAP.md` na aprovação deste plano. Não
estava previsto em sprint nenhuma.

**Por que primeiro.** Não precisa de migration: roda inteira sobre o que já
existe — `profiles` (`0001`), `must_change_password` (`0002`) e a view
`user_directory` (`0011`), construída exatamente para preencher `profile_id` em
formulário de vínculo. E fecha o único item da seção 6 da revisão que não depende
de terceiros.

**O argumento decisivo é operacional.** Os cinco usuários do gate são de teste.
Usuário real de piloto nasce por esta tela ou nasce à mão no painel de Auth — e a
segunda opção é onde se erra por distração. Deixar a Edge Function implantada e
sem chamador por mais uma sprint é a pendência que envelhece escondida.

**Entrega**

- rota `/usuarios` sob `(app)`, no shell Vegas;
- Server Action que invoca `admin-create-user` **com o JWT do chamador**;
- listagem de usuários, criação (nome, e-mail, papel) e regeneração de senha;
- a senha temporária é exibida **uma vez** na tela e nunca registrada em log.

**As três camadas continuam valendo, e a terceira é a única que importa.** A tela
exige administrador e a Server Action revalida — mas quem não pode ser contornado
chamando a API direto é a própria Edge Function, que revalida sessão e papel por
conta própria antes de tocar na service role.

**Desativar usuário não entrou nesta etapa.** Faltava a semântica: qual dos dois
sentidos de D-022 a ação tem para um usuário. Ficou decidido depois, em **D-036**
— `is_active = false` é **encerramento operacional**, não erro cadastral —, e a
ação passa a ter lugar definido. A proposta de onde ela entra está na etapa 1b.

*Aceite:*

1. Um usuário real é criado pela tela e nasce com `must_change_password = true`.
2. O primeiro login dele cai em `/trocar-senha` e não escapa por URL direta.
3. Um `comercial` que abra `/usuarios` recebe o estado `forbidden`, não um erro.
4. **Prova por mutação da camada 3b:** invocar a Edge Function com o token de um
   usuário não-administrador devolve `403 forbidden`. Se devolver `200`, a
   barreira não existe — e o teste é o que revela isso. Roteiro de execução em
   `docs/sprints/SPRINT-2-CAMADA-3B.md`, incluindo o **controle contra
   vacuidade**: uma função quebrada que respondesse `403` a todo mundo passaria
   sem a barreira existir.
5. Os cinco estados (`loading`, `empty`, `error`, `forbidden`, `success`).
6. Alvo de toque de 44 px em tela de toque, densidade compacta a partir de `lg:`
   (D-027).

---

## 2 · Correção do CI — `.next/server`

A checagem de service role no `ci.yml` varre apenas `.next/static`. **Mas D-030 é
sobre o runtime do Next**, e é em `.next/server` que um `serverEnv()`
reintroduzido apareceria. Hoje os dois estão limpos, então a correção nasce
verde — o que é justamente a hora de fazê-la.

**A checagem procura o NOME da variável, não o prefixo da chave** (D-035). Um
grep por `sb_secret_` daria falso positivo: o próprio `@supabase/supabase-js`
carrega `e.startsWith("sb_secret_")` numa função de detecção de formato de
chave, e ela aparece em `.next/server/chunks/*` de qualquer build. Confirmado
neste repositório. Alargar o padrão tornaria a etapa vermelha permanentemente —
e o caminho conhecido dali em diante é alguém desligar a checagem.

Também nesta etapa: corrigir a linha do `README.md` que diz que
`SUPABASE_DB_PASSWORD` é "exigida por `db:push`". `db:push` foi removido em
D-031.

*Aceite:* o CI varre os dois diretórios; a etapa reprova se `SUPABASE_SERVICE_ROLE_KEY`
aparecer em qualquer um deles. Verificado quebrando de propósito: um arquivo
temporário com a string em `.next/server` faz o passo falhar.

---

## 3 · Migration `0012` — `companies`

Tabela conforme `MODELO_DADOS.md` §3.1, com a convenção completa de inativação:
`inactivated_at`, `inactivated_by`, `inactivation_reason` **e**
`reactivation_reason` em coluna própria (D-033).

- função de trilha **própria da entidade** — uma por entidade (D-023); gravador
  genérico de histórico anula a imutabilidade;
- `security definer` + `set search_path = public` +
  `revoke execute from public, authenticated` — **os dois, não um**: revogar só
  de `authenticated` é inócuo, porque o grant implícito de `PUBLIC` sustenta o
  privilégio e nada dá sinal;
- trigger declarando `when (old.status is distinct from new.status)` — nunca
  `<>`, que devolve nulo com nulo de um dos lados;
- inativação restrita a administrador (D-022, cadastro mestre);
- policies de `RLS_PERMISSOES.md` §5.2, **com a exceção escrita no cabeçalho**;
- índices: único parcial de CNPJ ativo, `status`, `municipio + uf`.

*Aceite:* `supabase/checks/0012_verificacao.sql` devolve todas as linhas `OK`,
incluindo uma linha que registra **a ausência de recorte como esperada**, com o
motivo. Provado por mutação: alterar o predicado do índice único parcial faz o
script reprovar.

---

## 4 · Contrato `CnpjProvider`

`src/services/cnpj/` com a interface, o schema de validação e a **implementação
manual** como fallback (D-008). O fornecedor real continua em aberto (A-001) —
**nenhum pacote novo é instalado nesta etapa.**

O provider **não escreve no banco**: devolve dados que o formulário preenche.
`cnpj_lookup_at` e `cnpj_lookup_source` registram quando e quem respondeu.

*Aceite:* trocar de implementação não toca em nenhum chamador. Testes de unidade
cobrem CNPJ válido, inválido, não encontrado e falha do fornecedor — os quatro,
porque "não encontrado" e "fornecedor fora do ar" não podem virar a mesma tela.

---

## 5 · Migration `0013` — relacionamento

**Aqui o recorte deixa de ser função provada e vira barreira real.**

- enums `crm_relationship_type` e `crm_opportunity_origin`;
- `crm_company_relationships`, **uma linha por empresa** (D-014), com índice
  único em `company_id`;
- distinção de D-022 preservada: `ended_at` / `ended_by` / `end_reason` são
  encerramento operacional pelo gestor, dentro do escopo, e o histórico continua
  contando; `status = 'inativo'` é retirada administrativa por erro cadastral,
  restrita a administrador;
- função de trilha própria, nas mesmas condições da etapa 3;
- **sem `portfolio_id`** — a carteira vigente é descoberta pelo vínculo em
  `crm_portfolio_companies`, e duplicá-la aqui criaria segunda fonte de verdade
  sem nada no banco impedindo a divergência;
- policies com recorte, incluindo o ramo de gestão para responsável nulo;
- índices em `responsible_seller_id`, `team_id` e `relationship_type`.

*Aceite:* `0013_verificacao.sql` todas as linhas `OK`, com a checagem literal do
recorte. **Provado por mutação:** trocar o predicado da policy por `using (true)`
faz o script reprovar; restaurado em seguida.

---

## 6 · Migration `0014` — `crm_contacts`

**A inversão em relação a `MODELO_DADOS.md` §8 acontece aqui, e o motivo está
registrado como emenda naquele documento.** A ordem proposta trazia `crm_contacts`
antes do relacionamento; a policy de contatos (`RLS_PERMISSOES.md` §5.4) é um
`EXISTS` sobre `crm_company_relationships`, então nascer com recorte exigiria
uma tabela que só viria depois. A ordem era conveniência; a regra é garantia.

- `crm_contacts` conforme §3.2, com a convenção completa de inativação;
- **única entidade em que `status = 'inativo'` é operação normal**, não correção
  de erro (D-022): "Carlos não trabalha mais no estabelecimento" é mudança
  natural. O contato sai das listas e dos selects, mas continua resolvível nas
  atividades em que apareceu;
- função de trilha própria;
- recorte **transitivo**, via relacionamento — dado pessoal de terceiro não tem
  leitura ampla (D-009);
- índices: `company_id`, e único parcial de contato principal ativo.

*Aceite:* `0014_verificacao.sql` todas as linhas `OK`, e a checagem confirma que
o `qual` da policy referencia `crm_company_relationships` — prova de que o
recorte é o transitivo, e não um `true` disfarçado. Provado por mutação.

---

## 7 · Página do estabelecimento

Cadastro, relacionamento e contatos numa página só. Busca por CNPJ com o
comportamento de D-016.

**CNPJ já cadastrado não gera erro de duplicidade** (D-006): o sistema recupera o
estabelecimento e informa a situação. Para `comercial` fora do escopo, sem nome
de colega:

```
Estabelecimento já cadastrado
Situação: Em negociação
Responsabilidade: atribuído a outro consultor
```

Para `gestor_adm`, `administrador` e escopo superior, com responsável, equipe e
ação de reatribuir.

**A distinção não pode ficar só na interface.** A tela obtém a *existência* do
vínculo por caminho que não exponha `responsible_seller_id` fora do escopo — é a
aplicação de D-024 na prática: a RLS já recorta, e a aplicação decide quanto
exibir do que sobrou.

*Aceite:* os cinco estados; verificado em navegador, desktop e tablet; um
consultor fora do escopo não obtém o nome do responsável **por nenhum caminho**,
incluindo a resposta bruta da requisição — não só pelo que a tela desenha.

---

## 8 · Bateria de RLS §6.1 — agora verificável

Os cenários que a Sprint 1 registrou como "não verificáveis, exigem tabelas da
Sprint 2" passam a ser executáveis. Rodam contra o banco real, pelo SQL Editor,
na forma do gate da Sprint 1: um arquivo, uma colagem, uma tabela de saída.

| Cenário | Esperado |
| --- | --- |
| consultor lê relacionamento do próprio escopo | as linhas dele |
| consultor lê relacionamento de outra equipe | zero linhas, sem erro |
| gestor lê relacionamentos das equipes que gerencia | a união |
| relacionamento com responsável nulo | invisível ao consultor, visível à gestão |
| consultor lê contatos de empresa fora do escopo | zero linhas |
| usuário de vínculo duplo | a **união** dos dois conjuntos |
| qualquer papel tenta `DELETE` | `DELETE 0` — RLS filtra, não levanta |

*Aceite:* todas as linhas `OK`, e cada uma provada por mutação. O caso de vínculo
duplo é o que uma implementação errada reprova: com "primeiro papel encontrado",
os demais devolvem números idênticos.

---

## 9 · Verificação final e documentação

- `npm run verify` limpo;
- `src/types/database.ts` atualizado — só depois de a migration ser aplicada
  **e** verificada, nunca antes;
- `ARQUITETURA.md` atualizado com o que ficou implementado, e a §11 encolhendo;
- `DECISOES.md` com as decisões novas da sprint;
- `SPRINT-2-REVISAO.md` com a mesma separação de níveis de prova da Sprint 1:
  provado contra o banco do projeto, provado por mutação, coberto com dublê, não
  rodou. **Nada é marcado como cumprido sem ter rodado.**

---

# Fora de escopo desta sprint

**Por sequenciamento:** carteiras e telas de importação (Sprint 3); produtos,
oportunidades e condições comerciais (Sprint 4); atividades, tarefas e agenda
(Sprint 5); mapa e geolocalização (Sprint 6).

**Por dependência externa:**

- **Fornecedor real de consulta de CNPJ** — A-001 segue aberta. Esta sprint
  entrega o contrato e o preenchimento manual.
- **Carga da estrutura comercial real** — a exportação do Painel ADM ainda não
  existe, e aquele repositório está congelado. A etapa 7 da Sprint 1 entregou o
  mecanismo, não os dados.

**Por decisão declarada:**

- **Workflow do e2e.** Não entra nesta sprint. Fica registrado na seção 6 da
  revisão da Sprint 1 como escolha, não como esquecimento — com a nota de que
  `E2E_EMAIL` precisa apontar para um usuário que **já trocou a senha**: com
  qualquer um dos cinco recém-criados o spec falha, porque espera chegar em
  `/inicio` e o middleware desvia para `/trocar-senha`.

**Também não:** instalar pacote novo sem decisão registrada; atualizar versão de
dependência; alterar a versão do Tailwind; extrair pacote compartilhado; criar
identidade visual paralela; refatorar componente sem relação com a tarefa.

---

# Riscos desta sprint

| Risco | Mitigação |
| --- | --- |
| Tabela `crm_*` nascendo sem recorte | a regra inegociável, conferida pelo script da própria migration |
| Recorte escrito mas inócuo | prova por mutação em toda migration com policy |
| `companies` sem recorte lido como descuido | exceção escrita no cabeçalho da migration **e** no script |
| Recorte transitivo de contatos virando `true` disfarçado | o script confere que o `qual` referencia `crm_company_relationships` |
| Nome do responsável vazando fora do escopo | aceite da etapa 7 verifica a resposta bruta, não só a tela |
| Numeração de migration colidindo de novo | emenda ao `MODELO_DADOS.md` §8 aplicada antes da primeira migration |
| Varredura por falta de índice no recorte | índice na coluna de responsável é item de aceite, não otimização posterior |
| Senha temporária vazando em log | aceite da etapa 1: exibida uma vez, nunca registrada |
