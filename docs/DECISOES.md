[DECISOES.md](https://github.com/user-attachments/files/31279740/DECISOES.md)
# DECISÕES ARQUITETURAIS — CRM Comercial de Credenciamento Vegas

> Registro canônico de decisões técnicas. Decisão registrada aqui não é alterada
> silenciosamente: mudança exige nova entrada referenciando a anterior.
>
> Formato: contexto · decisão · alternativas descartadas · consequências.

| | |
| --- | --- |
| Sistema | CRM Comercial de Credenciamento Vegas |
| Base técnica | Painel ADM de Produtos Agregados, branch `sprint-3-relatorios-e-estrutura-comercial` |
| Estado | Sprint 0 — documentação aprovada, implementação não iniciada |
| Decisões fechadas | D-001 a D-026 |

---

## D-001 — Projeto Supabase novo e independente

**Contexto.** O Painel ADM está em produção desde agosto/2026 com 20 migrations
aplicadas. Compartilha com o CRM a estrutura comercial e, parcialmente, a base
de empresas. O documento de base técnica recomendava projeto único com schemas
separados.

**Decisão.** O CRM tem projeto Supabase próprio, sem acoplamento de banco.

**Alternativas descartadas.**

| Alternativa | Motivo |
| --- | --- |
| Mesmo projeto, schema `public` | Migration em tabela compartilhada afetaria sistema em produção; prospects em `companies` alterariam consultas que assumem "linha = cliente" |
| Mesmo projeto, schema `crm` | Reduz acoplamento de domínio, mantém o operacional: RLS, roles e migrations num banco só |
| Banco separado com sincronização bidirecional | Complexidade sem ganho proporcional nesta fase |

**Consequências.** Isolamento total de risco e prospects sem contaminar métricas
do Painel. Em contrapartida, autenticação duplicada (D-007) e cadastro
corporativo replicado (D-004).

---

## D-002 — Reaproveitamento dos seis perfis de acesso

**Contexto.** O Painel opera com `administrador`, `gestor_adm`, `analista_adm`,
`comercial`, `financeiro`, `auditoria`. O risco de vazamento entre sistemas —
cadastrar consultores como `comercial` e com isso abrir o Painel — não existe,
por consequência de D-001.

**Decisão.** Mesma nomenclatura de seis perfis, **com matriz de capabilities
própria do CRM**. Não copiar as permissões do domínio de Agregados.

**Alternativas descartadas.** Papel por aplicação (`user_app_roles`) — só
necessário em banco compartilhado. Matriz nova exclusiva — divergência de
vocabulário sem ganho.

**Consequências.** Módulos do CRM exigem declaração explícita das três
capacidades para todos os seis papéis, inclusive os que resultarão em somente
leitura. Ver `RLS_PERMISSOES.md`.

---

## D-003 — `companies` acrescida de camada CRM de relacionamento

**Contexto.** `companies` carrega identidade corporativa estável. O CRM precisa
acrescentar classificação prospect × Base Vegas, responsável, origem e carteira.

**Decisão.** `companies` mantém identidade; atributos de relacionamento vivem em
`crm_company_relationships`, referenciando `companies.id`.

**Alternativas descartadas.** Reusar `companies` para tudo — a tabela cresceria
com colunas de domínio competindo com identidade. Tabela CRM totalmente separada
— perderia identidade estável por CNPJ e reintroduziria deduplicação entre duas
bases.

**Consequências.** Empresa transita de prospect para Base Vegas sem duplicar
registro. Toda consulta de carteira passa por junção; índices em `company_id`,
`responsible_seller_id` e `status` são obrigatórios.

---

## D-004 — Fonte de verdade e carga por `source_ref`

**Contexto.** Consequência de D-001: `directors`, `managers`, `teams`, `sellers`
passam a existir nos dois bancos. A spec de importação de vendedores do Painel
(DE-039) deduplica por nome normalizado, e o próprio código assume que "vendedor
não tem chave natural única". Isso basta na origem, onde é a única fonte; não
basta para replicação entre bancos, e P-001 proíbe depender de nome textual.

**Decisão.**

- **Painel ADM é fonte de verdade** de `directors`, `managers`, `teams`,
  `sellers`. O CRM os carrega por importação estruturada.
- **CRM é fonte de verdade** de `companies` — população distinta (estabelecimento
  credenciado ≠ cliente de agregados). Sem sincronização entre as duas tabelas.
- **`profiles` do CRM pertence ao projeto CRM.** Sem compartilhamento de Auth.
- A exportação da estrutura comercial do Painel **inclui a coluna `id`**
  (autorizado). O CRM grava esse UUID em `source_ref`, separado do seu `id`
  próprio, com índice único parcial sobre não nulos.
- **Sem sincronização automática** nesta fase. Atualização é nova importação,
  idempotente por `source_ref`.

**Consequências.** Renomear uma pessoa na origem não cria registro duplicado no
CRM. Registros nascidos no CRM ficam com `source_ref` nulo e não colidem. O
mecanismo de round-trip do Painel (DE-033) já emite `id` como chave nunca
gravada — o padrão é reaproveitado, não inventado.

---

## D-005 — Papel define ação, escopo define alcance

**Contexto.** Não existe papel `diretor` entre os seis, e diretores são usuários
previstos. Criar um papel por nível hierárquico faria a matriz crescer a cada
nível.

**Decisão.** Dois eixos independentes:

```
PAPEL   → o que pode fazer   → canRead/canWrite/canInactivate(role, module)
ESCOPO  → sobre quais dados  → derivado de directors/managers/teams/sellers
```

Diretor é `gestor_adm` cujo vínculo hierárquico resolve para a diretoria
inteira. Escopo **nunca é inferido pelo papel**.

**Regra de acumulação.** Uma pessoa com mais de um vínculo recebe a **união** dos
escopos, nunca "o primeiro papel encontrado". Não é hipótese: DE-035 do sistema
de origem nomeia Rossi como diretor e gestor, e Danilo como gestor e vendedor.
Como as tabelas são separadas e o vínculo é por `profile_id`, as três funções de
identidade podem retornar valor simultaneamente para o mesmo usuário.

**Consequências.** Sétimo papel `diretor` não será criado. Funções SQL de
resolução de escopo especificadas em `RLS_PERMISSOES.md`.

---

## D-006 — Propriedade de lead e reatribuição

**Contexto.** O índice único parcial de CNPJ impede que dois consultores
cadastrem o mesmo estabelecimento. Sem regra explícita, vira conflito de campo.

**Decisão.**

- **O consultor não é proprietário da empresa.** `companies` não tem coluna de
  responsável. Identidade não tem dono.
- Responsabilidade vive em `crm_company_relationships.responsible_seller_id`,
  `crm_portfolio_companies.seller_id` e `crm_opportunities.seller_id`.
- CNPJ já cadastrado **não gera erro de duplicidade**: o sistema recupera o
  estabelecimento e informa a situação conforme D-016.
- Reatribuição é capability de `gestor_adm` e `administrador`, **restrita ao
  próprio escopo** — o gestor só reatribui dentro de `scoped_seller_ids()`.
- Toda reatribuição grava linha em `crm_assignment_history`: responsável
  anterior, novo, quem alterou, data/hora, motivo. Vínculo anterior nunca é
  sobrescrito em silêncio.

---

## D-007 — Autenticação independente na V1

**Decisão.** Projetos Supabase distintos, usuários distintos, sessões distintas,
senhas distintas. Sem OIDC, sem SSO, sem abstração preparatória.

Preservado do padrão validado: criação administrativa, senha temporária forte
exibida uma única vez, troca obrigatória no primeiro acesso,
`must_change_password` verificado no middleware a cada request, bloqueio de
usuário inativo em meio a sessão, `prevent_profile_tampering`, service role
exclusivamente em Edge Function.

**Consequência registrada.** SSO entre sistemas da Plataforma Vegas poderá ser
estudado futuramente como **projeto específico de identidade**, não como ajuste
incremental — migração de identidade é cara e deve ser planejada como tal.

---

## D-008 — Consulta de CNPJ desacoplada do fornecedor

**Decisão.** Fornecedor não escolhido na Sprint 0. A Sprint 0 define apenas
contrato e ponto de integração, em `src/services/cnpj/`:

```
CnpjProvider.lookup(cnpj) → CnpjLookupResult
```

`CnpjLookupResult` normaliza para modelo interno: CNPJ, razão social, nome
fantasia, situação cadastral, CNAE, atividade, CEP, logradouro, número,
complemento, bairro, município, UF, telefone.

A aplicação não conhece detalhes do fornecedor. Previstos desde o contrato:
timeout, indisponibilidade, CNPJ não encontrado, limite de chamadas, cache
eventual e **preenchimento manual como fallback** — a ausência do serviço não
pode bloquear cadastro em campo.

**Consequência.** `companies` guarda `cnpj_lookup_at` e `cnpj_lookup_source`
para rastreabilidade de origem do dado.

---

## D-009 — Contatos estruturados na V1

**Contexto.** Lacuna do escopo original: sem entidade de contato, nome e telefone
do responsável iriam para campo de observação.

**Decisão.** `crm_contacts` entra na V1, relacionada a `companies`, N por
estabelecimento. Campos opcionais salvo `name`.

**Tratamento de dado pessoal.** Acesso restrito à finalidade operacional: o
módulo `contatos` exclui `financeiro` e `auditoria` da matriz, e a RLS recorta
por escopo comercial — quem não tem o estabelecimento no alcance não lê seus
contatos. Não criar campos sensíveis sem necessidade comercial demonstrada.

---

## D-010 — Sem modo offline na V1

**Decisão.** Não implementar sincronização offline, IndexedDB como banco
operacional, resolução de conflito ou fila de eventos. Os tablets têm conexão.

**Contrapartida obrigatória.** A experiência **não pode perder dado digitado em
falha de conexão**. Formulários longos (visita, oportunidade, atividade) mantêm
rascunho local até a gravação confirmar. Toda falha de gravação é informada
explicitamente — nunca silenciosa, nunca otimista.

---

## D-011 — Motivo de perda obrigatório, catálogo parametrizável

**Contexto.** `sem_interesse` isolado não gera aprendizado, e é impossível
reconstruir retroativamente.

**Decisão.** `crm_loss_reasons` é **tabela**, não enum PostgreSQL, porque a lista
deve ser mantida pelo gestor. Identidade estável por `match_key`, separada de
`name` (mesmo princípio do `match_key` de produtos).

Transição para `sem_interesse` exige `loss_reason_id`. A obrigatoriedade de
`loss_notes` vem de uma flag `requires_notes` na própria linha do catálogo —
**não** de comparação com o literal `'outro'`, que quebraria se o motivo fosse
renomeado ou se surgissem outros motivos que exijam detalhamento.

---

## D-012 — Copiar e adaptar, sem pacote compartilhado

**Decisão.** Motor de importação e componentes de UI são **copiados e adaptados**
para o novo repositório. Sem extração para pacote NPM nesta fase.

**Motivo.** Velocidade na criação do CRM e independência entre sistemas na
primeira fase.

**Custo aceito conscientemente.** Correção de defeito passa a ser feita duas
vezes. Mitigação: preservar estrutura e API dos componentes para que
`@vegas/tokens` e `@vegas/ui` sejam extraíveis quando houver sistemas
suficientes e estabilidade.

Não trazer specs nem páginas de negócio de Agregados — apenas o núcleo genérico
(`types`, `engine`, `csv`, `xlsx`, `grid`) e as specs como referência.

---

## D-013 — Fonte normativa visual

**Contexto.** O `VEGAS-DESIGN-SYSTEM.md`, citado no documento de base técnica
como "entregue à parte", **não está no repositório-base** em nenhuma branch.

**Decisão.** A fonte normativa visual do CRM é:

```
docs/VEGAS-PLATFORM-UI-STANDARD.md   (+ .docx original)
src/styles/tokens.css
docs/IDENTIDADE_VISUAL.md
```

O UI Standard é anexado ao repositório do CRM e convertido para Markdown, para
consumo direto pelo agente. Ele define ajustes de contraste, tokens,
responsividade, alvo touch de 44 px, mapas, geolocalização e shell.

`VEGAS-DESIGN-SYSTEM.md` **não é tratado como existente** enquanto não estiver
disponível. Nenhum documento do CRM deve citá-lo como fonte.

---

## D-014 — `crm_company_relationships` é 1:1 com `companies` na V1

**Decisão.** Uma linha de relacionamento por empresa.

```
companies
   ↓ 1:1
crm_company_relationships
   ↓ 1:N
crm_opportunities
```

O estabelecimento tem um relacionamento operacional principal; negociações
diferentes ficam abaixo dele como oportunidades distintas.

**Alternativa descartada por ora.** Múltiplas linhas por contexto comercial,
permitindo consultor exclusivo de relacionamento e outro de Vegas Pay na mesma
empresa. Não introduzir complexidade estrutural antes de existir o caso real; se
surgir, evolui-se a responsabilidade por oportunidade ou criam-se vínculos
especializados.

**Implementação.** Índice único em `crm_company_relationships.company_id`.

---

## D-015 — Status ativos para unicidade empresa × produto

**Decisão.**

```
ATIVAS      nao_iniciada · em_negociacao
ENCERRADAS  contrato_firmado · sem_interesse
```

Uma empresa não pode ter duas oportunidades **ativas** do mesmo produto. Índice
único parcial sobre `(company_id, product_id)` restrito aos status ativos.

**Consequência deliberada.** Encerrada uma negociação, outra pode nascer no
futuro para o mesmo produto. Relacionamento comercial é histórico, não registro
único eterno:

```
Vegas Pay · 2026 — Sem Interesse      (preservada)
Vegas Pay · 2027 — Em Negociação      (registro novo)
```

Combina com `crm_opportunity_status_history` (D-021 do modelo): guardar somente a
última mudança perderia a trilha exigida pelo Contexto §13.

---

## D-016 — Exposição do responsável na busca por CNPJ

**Contexto.** Informar que o estabelecimento já está atribuído evita trabalho
duplicado; revelar o nome do colega abre carteira alheia entre consultores.

**Decisão.** Proteção por escopo.

Para `comercial` fora do escopo:

```
Estabelecimento já cadastrado
Situação: Em negociação
Produto: Vegas Pay
Responsabilidade: atribuído a outro consultor
[Visualizar dados permitidos]
```

Para `gestor_adm`, `administrador` e escopo superior:

```
Estabelecimento já cadastrado
Responsável: João Silva
Equipe: Americana
Produto: Vegas Pay
Status: Em negociação
[Visualizar]  [Reatribuir]
```

**Implementação.** A distinção não pode ficar só na interface. A RLS de
`crm_company_relationships` já recorta por escopo; a tela obtém a *existência* do
vínculo por caminho que não exponha `responsible_seller_id` fora do escopo.

---

## D-017 — Não copiar `managers.team_id`

**Contexto.** DE-040 do sistema de origem registra que a coluna não é lida por
nenhuma regra — nem painel, nem importação —, existia só para se auto-exibir, e
exibia errado: mostrava uma equipe de "pertencimento" escondendo as várias que o
gestor de fato gerencia. Foi ocultada, não removida, para preservar
reversibilidade.

**Decisão.** A coluna não é replicada no CRM. O vínculo de gerência é
`teams.current_manager_id`, muitos por gestor.

---

## D-018 — Escopo hierárquico na Sprint 1; testes de RLS na definição de pronto

**Contexto.** DE-025 do sistema de origem adiou o recorte do comercial na Sprint
2 com leitura ampla "provisória". Três sprints depois, `companies_select`
continua `using (public.auth_role() is not null)` e o `can.ts` está idêntico. Não
é descuido — é o comportamento previsível de uma dívida de segurança que não
bloqueia nenhuma tela.

**Decisão.** No CRM o recorte por consultor é requisito funcional, não melhoria
futura. As funções de escopo entram na **Sprint 1**, junto com auth e estrutura
comercial, antes de qualquer tela comercial.

**Definição de pronto.** Toda sprint que toque em policy só fecha com **testes de
RLS por papel** passando. O sistema de origem já possui o mecanismo
(`rls-integration.yml`, `rls*.integration.test.ts`); no CRM ele deixa de ser
opcional.

---

## D-019 — `x-user-profile` só com remoção do header forjado

**Contexto.** DE-038 do sistema de origem elimina a duplicação de `getUser` e da
leitura de `profiles` por navegação: o middleware valida na borda e anexa o
perfil ao header `x-user-profile`, que o render lê.

**Decisão.** O mecanismo é copiado, e `src/lib/auth/profile-header.ts` e o
`delete` no middleware formam **uma unidade indivisível**. O middleware remove
qualquer `x-user-profile` recebido do cliente **antes** de setar o seu.

**Verificação obrigatória.** Teste automatizado específico enviando header
forjado e confirmando que não sobrevive. Sem o `delete`, o header vira caminho de
escalonamento de papel.

---

## D-020 — `Permissions-Policy` libera geolocalização

**Contexto.** O `next.config.mjs` do sistema de origem envia
`geolocation=()`, desabilitando a API no documento. O navegador nega antes de
exibir prompt, e o sintoma na tela é indistinguível de "usuário negou".

**Decisão.** O CRM usa `geolocation=(self)`. Câmera e microfone permanecem
desabilitados enquanto não houver requisito de anexo por foto. Demais cabeçalhos
de segurança preservados: `X-Frame-Options: DENY`, `X-Content-Type-Options`,
`Referrer-Policy`.

---

## D-021 — Nenhuma migration de domínio antes da aprovação documental

**Decisão.** Migrations do domínio CRM só começam após aprovação de
`MODELO_DADOS.md` e `RLS_PERMISSOES.md`.

Regras permanentes, herdadas do processo validado:

- migration aplicada nunca é editada — correção é migration nova;
- numeradas, aplicadas uma por vez, com confirmação antes da próxima;
- operação envolvendo `drop policy` sempre em transação;
- `alter table add constraint` guardado por bloco `DO` sobre `pg_constraint`;
- nenhuma policy de DELETE; saída de circulação é `status = 'inativo'`.

## D-022 — Encerramento não é inativação: matriz por entidade

**Contexto.** O aprendizado mais caro do sistema de origem: confundir as duas
semânticas custa histórico. `end_date` preenchido significa que encerrou e o
histórico **continua contando**; `status = 'inativo'` significa que o registro
sai de tudo, e é para erro de digitação. Copiar
`enforce_inactivation_is_admin()` para todas as entidades transformaria o banco
num cemitério de registros "inativos" que na verdade só foram concluídos — e
deixaria o gestor dependente do administrador para operações de negócio
corriqueiras.

**Decisão.** Três categorias de enforcement, não uma função universal.

```
CADASTRO MESTRE      → inativação administrativa
ENTIDADE OPERACIONAL → fechamento/cancelamento pela regra de negócio
HISTÓRICO            → imutável
```

O gestor recebe **operações de negócio apropriadas**, não permissão genérica de
inativação.

| Entidade | Operação normal | Quem faz | Inativação (`status = 'inativo'`) |
| --- | --- | --- | --- |
| `companies` | manter cadastro | conforme permissão | somente administrador |
| `commercial_products` | ativar/inativar catálogo | gestor · admin | `gestor_adm` · administrador |
| `crm_loss_reasons` | ativar/inativar motivo | gestor · admin | `gestor_adm` · administrador |
| `directors` `managers` `teams` `sellers` | encerramento por vigência (`active_to`, `left_at`, `valid_to`) | gestor · admin conforme escopo | administrador, correção excepcional |
| `crm_company_relationships` | reatribuir · encerrar relacionamento (`ended_at`) | gestor no escopo | administrador, só erro cadastral |
| `crm_contacts` | inativar contato | comercial · gestor no escopo | **permitido** — contato muda naturalmente |
| `crm_opportunities` | fechar por `contrato_firmado` ou `sem_interesse` | comercial · gestor no escopo | administrador, só registro criado incorretamente |
| `crm_tasks` | concluir · cancelar | responsável · gestor | não existe conceito de inativação |
| `crm_activities` | histórico | — | não inativar |
| `crm_portfolios` | encerrar/arquivar (`closed_at`) | gestor · admin | inativação administrativa |
| `crm_portfolio_companies` | encerrar · redistribuir (`ended_at`) | gestor no escopo | não apagar; preservar histórico |

**Exemplos da distinção:**

```
Carteira        ativo → encerrado              (operação)
Oportunidade    em_negociacao → contrato_firmado (operação)
Oportunidade    em_negociacao → sem_interesse  (operação)
Tarefa          pendente → concluido           (operação)

Qualquer entidade  status → inativo            (erro cadastral)
```

**Contato inativo é caso à parte.** "Carlos não trabalha mais no
estabelecimento" não é erro de cadastro, é mudança natural. O consultor
autorizado inativa o contato sem destruir o histórico das atividades em que ele
apareceu — por isso `crm_contacts` ganha `inactivated_at` e `inactivated_by`.

---

## D-023 — Tabelas históricas são imutáveis no banco

**Contexto.** D-021 já estabelece que a trilha é gravada por trigger. Isso
garante que ela **seja** escrita; não garante que não seja alterada depois.
Ausência de botão na interface não é imutabilidade.

**Decisão.** Para `crm_opportunity_status_history` e `crm_assignment_history`:

```
SELECT   permitido conforme escopo do registro de origem
INSERT   negado por API — nenhuma policy de INSERT
UPDATE   negado para todos
DELETE   negado para todos
```

Vale **inclusive para administrador via API normal**.

**Mecanismo, com as restrições que o tornam seguro.** As tabelas não recebem
policy de INSERT, UPDATE ou DELETE. A gravação acontece por função de trigger
`security definer`, propriedade do dono do banco — o único caminho que atravessa
a RLS. O `security definer` aqui é **intencional, não atalho**, e por isso vem
com quatro restrições obrigatórias:

1. **`set search_path = public`** fixo e mínimo em toda função de trilha.
   Sem isso, um schema no caminho de busca pode sequestrar a resolução de nome
   dentro de uma função que roda com privilégio do dono.
2. **`revoke execute from public, authenticated`** em cada função. Ela existe
   para ser acionada pelo trigger, não para ser chamada.
3. **Uma função por entidade.** Nada de gravador genérico de histórico:
   `write_opportunity_status_history()`, `write_assignment_history_relationship()`
   e assim por diante. Cada trilha nasce **exclusivamente da mutação da entidade
   correspondente**. Uma função genérica capaz de inserir histórico arbitrário
   anularia a imutabilidade — bastaria chamá-la com os argumentos certos.
4. Se houver lógica comum, ela vive em helper **sem** `security definer` e **sem**
   `execute` concedido, chamado de dentro das funções de trigger. O privilégio
   fica na borda, não no utilitário.

É o mesmo padrão da view `account_directory` do sistema de origem, e precisa do
mesmo comentário explícito no cabeçalho: o Security Advisor do Supabase vai
apontar como lint, e alguém vai querer "corrigir".

**Correção histórica**, se algum dia for necessária, exige procedimento
administrativo explícito e registrado. Não se abre `UPDATE` genérico.

**Proteções adicionais em `crm_assignment_history`.** A referência polimórfica
(`scope` + `target_id`) não tem FK; a ausência de FK não pode virar liberdade
para a aplicação inventar `target_id`:

```
scope      not null, check in ('relationship', 'portfolio', 'opportunity')
target_id  not null
```

somado à regra de que só a trigger insere.

O histórico guarda `previous_seller_id`, `new_seller_id`, `changed_by`,
`changed_at` e `reason`. **Guarda IDs, não nomes** — os IDs preservam
rastreabilidade e a tela resolve os nomes atuais quando exibe. Nome congelado no
histórico diverge do cadastro e confunde.

---

## D-024 — RLS diz se a linha é legível; a aplicação diz quanto exibir

**Contexto.** `companies` tem leitura ampla entre autenticados (D-003, D-006):
empresa não tem dono, relacionamento tem. Existe risco de alguém concluir mais
tarde que "`companies` tem SELECT amplo, então todo o CRM deveria ter também".

**Decisão.** São duas perguntas distintas:

```
RLS:        esta linha pode ser consultada por este usuário?
Aplicação:  quanto desta informação deve aparecer neste contexto?
```

Leitura ampla **não** significa que o consultor veja a ficha completa de uma
empresa fora da sua carteira. Na busca por CNPJ fora do escopo, a projeção é
reduzida:

```
CNPJ · Razão Social · Nome Fantasia · Cidade
Situação: estabelecimento já cadastrado
Atribuição: já atribuído
```

Nada de ficha operacional. O detalhe do responsável segue D-016.

`crm_contacts`, `crm_company_relationships`, `crm_opportunities`, `crm_tasks` e
`crm_activities` **permanecem recortados pelo escopo** na própria RLS.

**A exceção de `companies` é deliberada e de identidade cadastral.** Não é
precedente para o resto do CRM, e não tem relação com a leitura ampla acidental
do DE-025 do sistema de origem.

---

## D-025 — Inativação com autoria e motivo, reativação explícita, trilha só em mudança real

**Contexto.** D-022 definiu *quem* pode inativar o quê. Faltavam três brechas
que ficariam abertas na Sprint 1.

### 1. Inativação registra autoria e motivo

Toda entidade que admite `status = 'inativo'` (ou `record_status = 'inativo'`)
carrega:

```
inactivated_at      timestamptz
inactivated_by      uuid → profiles(id)
inactivation_reason text
```

**Divisão de responsabilidade.** O motivo é texto que só o operador conhece; o
banco não tem como inventá-lo.

| Campo | Origem |
| --- | --- |
| `inactivation_reason` | **informado pela operação**, validado pela trigger |
| `inactivated_at` | definido exclusivamente pela trigger — `now()` |
| `inactivated_by` | definido exclusivamente pela trigger — `auth.uid()` |

A trigger recusa a transição para `'inativo'` com motivo vazio ou nulo, e leva o
mesmo texto para `reason` em `crm_record_status_history`.

Sem motivo, meses depois ninguém distingue "cadastro duplicado" de "criei sem
querer" de "não sei por que está assim". A distinção importa porque inativação é
reservada a **erro cadastral** — se o motivo registrado descrever uma conclusão
de negócio, a operação foi feita no campo errado.

Não introduzir RPC dedicada nesta fase: coluna preenchida pela operação mais
validação na trigger resolve sem acrescentar camada.

### 2. Reativação não é automática

`inativo → ativo` **não** é UPDATE comum:

- privilégio de **administrador**, mesmo quando a inativação coube ao gestor
  (catálogos, carteiras);
- exige motivo, **informado pela operação** — campo obrigatório no diálogo de
  reativação. A trigger `enforce_reactivation_is_admin()` valida papel **e**
  presença do motivo antes de permitir `inativo → ativo`;
- gera linha em `crm_record_status_history`, com autoria e instante vindos do
  banco.

Reativar sem trilha desfaz silenciosamente uma decisão administrativa e apaga a
razão pela qual o registro havia saído de circulação.

**Cuidado de implementação.** Reativar devolve o registro aos índices únicos
parciais. Reativar uma empresa cujo CNPJ foi recadastrado colide com
`companies_cnpj_active_unique`; reativar uma oportunidade colide com
`crm_opportunities_active_unique` se já existir outra ativa para o mesmo
produto. O banco recusa — corretamente —, e a interface precisa explicar o
motivo real, não devolver erro genérico de constraint.

### 3. Trilha só grava mudança real

Toda trigger de histórico é declarada com cláusula `WHEN`:

```sql
create trigger crm_opportunities_status_history
  after update on crm_opportunities
  for each row
  when (old.status is distinct from new.status)
  execute function public.write_opportunity_status_history();
```

O filtro fica no `WHEN` da declaração, não dentro da função: assim a função nem é
chamada quando nada mudou. Sem isso, salvar a mesma tela duas vezes — ou editar
observação sem tocar no status — geraria linha de trilha idêntica, e a timeline
da negociação encheria de eventos que não aconteceram.

`is distinct from` e não `<>`: com nulo de um dos lados, `<>` devolve nulo e o
trigger não dispara. Passar de responsável nulo para responsável definido é
exatamente a mudança que mais interessa registrar.

---

## D-026 — O banco é soberano; a aplicação traduz o erro

**Contexto.** Reativar um registro devolve-o aos índices únicos parciais e pode
colidir com `companies_cnpj_active_unique` ou `crm_opportunities_active_unique`.
A tentação, quando isso aparece em produção, é afrouxar a constraint ou
contorná-la na aplicação.

**Decisão.** Constraint prevista **não se contorna**. Ela é a regra; a recusa do
banco é o comportamento correto. O que a aplicação faz é **capturar o erro
conhecido e traduzi-lo em mensagem operacional**.

```
Postgres:   duplicate key value violates unique constraint
            "companies_cnpj_active_unique"

Usuário:    Não é possível reativar este estabelecimento porque já existe
            outro cadastro ativo para o mesmo CNPJ.
```

**Padrão geral, não exceção da reativação.** Toda constraint previsível tem
mensagem correspondente mapeada por nome:

| Constraint | Mensagem |
| --- | --- |
| `companies_cnpj_active_unique` | Já existe cadastro ativo para este CNPJ |
| `crm_opportunities_active_unique` | Já existe negociação em aberto deste produto para o estabelecimento |
| `crm_portfolio_companies_unique` | Este estabelecimento já está vinculado a esta carteira |
| `crm_contacts_primary_unique` | Já existe contato principal para este estabelecimento |
| `<t>_source_ref_unique` | Registro já importado — a atualização casa por `source_ref` |
| `loss_reason_required` | Informe o motivo da perda antes de encerrar |

O mapeamento é **por nome de constraint**, não por texto da mensagem do
Postgres — o texto muda entre versões, o nome não. Constraint sem tradução cai
em mensagem genérica e vira item de correção, nunca motivo para relaxar a regra.

---

# Decisões em aberto

| # | Assunto | Quando decidir |
| --- | --- | --- |
| A-001 | Fornecedor de consulta de CNPJ | Sprint 2, sobre o contrato de D-008 |
| A-002 | Biblioteca de mapa | Sprint 6 ou 8, quando o mapa entrar |
| A-003 | ~~Quem inativa o quê~~ | **Resolvido em D-022** |
| A-004 | Vínculo `crm_tasks` → `crm_activities` na conclusão | Sprint 5; a coluna `source_task_id` já nasce prevista |
| A-005 | Extração de `@vegas/tokens` e `@vegas/ui` | Quando houver terceiro sistema e estabilidade de componentes |
| A-006 | `ARQUITETURA.md` | Sprint 0, **depois** de a fundação ser copiada. Região do Supabase, região/runtime da Vercel, IDs de ambiente, URLs e fornecedor de CNPJ ficam marcados como "a confirmar após configuração" — não se fabrica informação de ambiente |
