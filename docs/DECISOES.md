# DECISÕES ARQUITETURAIS — CRM Comercial de Credenciamento Vegas

> Registro canônico de decisões técnicas. Decisão registrada aqui não é alterada
> silenciosamente: mudança exige nova entrada referenciando a anterior.
>
> Formato: contexto · decisão · alternativas descartadas · consequências.

| | |
| --- | --- |
| Sistema | CRM Comercial de Credenciamento Vegas |
| Base técnica | Painel ADM de Produtos Agregados, branch `sprint-3/relatorios-e-estrutura-comercial` |
| Estado | Sprint 0 — documentação aprovada, implementação não iniciada |
| Decisões fechadas | D-001 a D-034 |

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

### Emenda — a Sprint 1 entrega a função, a Sprint 2 entrega o enforcement

A Sprint 1 entregou `scoped_seller_ids()` provada por mutação, **mas sem nenhuma
tabela onde prendê-la**: as cinco de `RLS_PERMISSOES.md` §5.3 —
`crm_company_relationships`, `crm_opportunities`, `crm_activities`, `crm_tasks`,
`crm_portfolio_companies` — nascem da Sprint 2 em diante.

Isso deixa D-018 **meio cumprida**. A função está provada; o enforcement não. E
essa é exatamente a situação que produziu o DE-025 no sistema de origem: lá a
intenção também existia, e a leitura ampla "provisória" seguiu aberta três
sprints. O que faltou não foi decisão — foi um momento em que a dívida se
tornasse visível.

**Regra de aceite da Sprint 2, para criar esse momento:**

> Nenhuma tabela `crm_*` é criada sem a sua policy com recorte **na mesma
> migration**. Não em migration seguinte, não "depois que a tela existir". Se a
> tabela nasce, a policy nasce junto — e o script de verificação daquela
> migration confere que o recorte está lá.

A verificação é o que torna a regra executável: uma tabela sem recorte não passa,
e a falha aparece no momento em que a tabela é criada, não numa auditoria três
sprints depois.

Registrada em `SPRINT-1.md` (seção "O que a Sprint 2 herda como aceite") e em
`ROADMAP.md`, na Sprint 2.

### Estado em 26/08/2026 — aplicada, não exercitada

A `0013` e a `0014` nasceram com recorte nas três policies, conferido pelos
scripts das próprias migrations. A regra de aceite funcionou.

**Mas o que os scripts conferem é o `polqual` no catálogo:** que a policy existe
e que chama `scoped_seller_ids()`. Não que ela recorta. Nenhuma linha foi lida
por um consultor e negada a outro — nem no cluster local (`psql` como
`postgres`), nem no painel (SQL Editor, também dono). **O dono do banco não é
filtrado pela RLS.**

O gate de cinco usuários da Sprint 1 tem o mesmo limite: mediu a **função** de
escopo — a união contra "primeiro papel encontrado" (D-005) —, não a policy.
Continua valendo pelo que mede.

Causa medida em 26/08/2026: `set role authenticated` no cluster local devolve
`permission denied for table companies`. O harness nunca reproduziu os grants que
o Supabase configura, então nenhuma asserção de RLS jamais foi executada.

**D-018 permanece meio cumprida, por um motivo diferente do original.** Antes
faltava o enforcement; agora ele existe e falta exercitá-lo. A etapa 5c-0 da
Sprint 2 fecha isso, e só então a decisão muda de estado.

Declarar fechado antes disso seria repetir o DE-025 com documentação melhor —
com o agravante de haver uma linha escrita afirmando o contrário.

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
| `profiles` | desativar/reativar acesso (`is_active`) | administrador | **não existe conceito** — ver D-036 |

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
inactivation_reason text          -- por que este registro está inativo
reactivation_reason text          -- por que foi devolvido à circulação
```

**Emenda — os dois motivos ficam em colunas SEPARADAS.** A redação original
exigia motivo nos dois sentidos sem dizer onde ele mora, e a primeira
implementação reusou `inactivation_reason` para ambos, transformando-a em
"motivo da transição mais recente".

Isso é ambíguo por construção. A coluna precisa responder **por que este
registro está inativo** — não o que aconteceu por último. Depois de uma
reativação, um campo único passaria a explicar por que o registro está ATIVO,
enquanto o nome promete o contrário; e quem lesse `inactivation_reason` de um
registro reativado receberia a informação errada sem nenhum sinal disso.

A trilha em `crm_record_status_history` já guarda os dois eventos com seus
motivos próprios em `reason`. As colunas na entidade são o estado corrente:

| Coluna | Preenchida em | Limpa em |
| --- | --- | --- |
| `inactivation_reason` | `ativo → inativo` | — permanece, é o histórico do estado |
| `reactivation_reason` | `inativo → ativo` | `ativo → inativo` |
| `inactivated_at` / `_by` | `ativo → inativo`, pelo banco | `inativo → ativo` |

Migration `0010`. A `0008` não é editada (D-021).

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

## D-027 — Alvo de toque responsivo

**Contexto.** A biblioteca copiada foi dimensionada para desktop administrativo:
`button` em 32/40 px, `input` e `select` em 40 px, `checkbox` em 16 px, célula de
tabela com `py-2`. Nenhum controle atinge 44 px. O CRM roda em **tablet no
campo**, e alvo pequeno em tela de toque é erro de operação, não de estética.

Ao aplicar a regra, as fontes divergem no alcance:

- O `VEGAS-PLATFORM-UI-STANDARD.md` qualifica três vezes — §12 "alvos de toque
  mínimos de 44 px **no mobile**", §19 "Mobile em campo → botões 44 px", §20
  "tamanho de toque mínimo de 44 px **no mobile**";
- a mesma §19 lista **densidade e produtividade** como prioridade do desktop
  administrativo — sidebar, tabelas, filtros e múltiplas colunas;
- o `CLAUDE.md` afirmava sem qualificar: "alvo touch mínimo de 44 px".

**Decisão.** Alvo de toque **responsivo**: 44 px na base, densidade compacta a
partir de `lg:`.

```
button   h-11 lg:h-8  (sm)   ·   h-11 lg:h-10 (md)
campos   h-11 lg:h-10
tabela   py-3 lg:py-2
```

As duas exigências da §19 são reais e conflitantes: 44 px fixo em tudo atenderia
o tablet e custaria densidade em toda tela de desktop, contra a própria §19. O
responsivo atende as duas linhas da tabela sem escolher entre elas.

**Checkbox.** O quadrado permanece em 16 px — inflá-lo para 44 px destoaria de
qualquer formulário e não é o que a regra pede. A área de toque vem do **padding
do rótulo** (`min-h-11 py-3`, revertido em `lg:`). O alvo clicável cresce; o
desenho não muda.

**Divergência corrigida na origem.** O `CLAUDE.md` é resumo; o UI Standard é
fonte normativa. Quando resumo e fonte divergem, a fonte vence — e o resumo é
corrigido, não mantido. A linha do `CLAUDE.md` passou a "alvo touch mínimo de
44 px em telas de toque; densidade compacta a partir de `lg:`".

**Consequências.** Todo controle novo nasce com o par base/`lg:`. Componente que
declare só a altura compacta reprova a auditoria de toque. `conformidade.test.tsx`
trava o padrão em `button`, `input` e `select`.

---

## D-028 — CLI do Supabase fixado no projeto

**Contexto.** Os scripts de banco herdados da origem (`db:types`, `db:reset`)
assumiam um `supabase` instalado globalmente na máquina do desenvolvedor. O
repositório não declarava a ferramenta em lugar nenhum: quem clonasse sem o CLI
global veria os scripts falharem, e quem tivesse uma versão diferente rodaria
outra ferramenta com o mesmo nome.

**Decisão.** `supabase` entra como **devDependency com versão exata** —
`"supabase": "2.115.0"`, sem `^`. Fica no `package-lock.json` e é a mesma
ferramenta em qualquer máquina e no CI.

**Motivo.** Versão no lock significa mesmo comportamento em toda máquina e no
CI. Migration que passa numa máquina e falha noutra por diferença de CLI é
exatamente a classe de problema que **D-021** existe para evitar — não faz
sentido disciplinar a ordem das migrations e deixar flutuando a ferramenta que
as aplica. Os ~50 MB do binário são baratos perto de um diagnóstico perdido
nisso.

**Sem intervalo de versão.** `^` permitiria que uma minor nova entrasse num
`npm ci` e mudasse a geração de tipos ou o comportamento de `db push` sem
ninguém ter decidido. Atualização de CLI passa a ser mudança explícita, com
teste, como qualquer outra dependência.

**Alternativa descartada.** Instalação global documentada no README: não
acrescenta pacote ao repositório, mas devolve a variação entre máquinas e deixa
o CI sem a ferramenta — `db:lint` nunca poderia rodar lá.

**Consequências.** `npm ci` passa a baixar o binário. Os scripts `db:*` resolvem
pelo `node_modules/.bin` sem `npx` remoto. `supabase start` continua exigindo
Docker e segue opcional (D-001: o desenvolvimento pode apontar direto para o
projeto hospedado).

---

## D-029 — Saneamento de `x-user-profile` no topo do middleware

**Contexto.** D-019 estabelece que o middleware remove qualquer `x-user-profile`
vindo do cliente **antes** de setar o validado, e chama a verificação de
obrigatória. A implementação do sistema de origem faz o `delete` **dentro de um
ramo só** — o de rota protegida com sessão. Os demais caminhos retornam antes:

| Caminho | Header do cliente |
| --- | --- |
| sem sessão, rota pública | **passa** |
| com sessão, rota pública | **passa** |
| com sessão, rota protegida | removido |

E `getSessionProfile()` confia no header sem condição quando ele existe — só cai
para o `getUser` real quando o header falta.

`/dev` é rota pública no middleware, e o layout do segmento exige perfil
`administrador`. Na origem, portanto, uma requisição a `/dev` com header forjado
atravessa o gate de administrador. O estrago lá é pequeno — o catálogo não
carrega dado —, mas é o caminho de escalonamento que D-019 nomeia, e o padrão
seria herdado por qualquer rota pública futura que leia perfil.

**Decisão.** O `delete` sobe para o **topo** de `src/middleware.ts` e vale para
**toda** requisição, antes de qualquer decisão de rota. Os headers saneados são
passados a `updateSession()`, que constrói com eles todo `NextResponse.next` —
inclusive os dos caminhos que retornam cedo. Nenhum ramo devolve header vindo do
cliente.

O saneamento acontece **antes** de o cliente Supabase existir, então não
interfere na regra de não haver lógica entre `createServerClient` e `getUser()`
— de que depende a renovação do token.

**Verificação.** `src/middleware.test.ts` nasce no mesmo commit que o código, com
os casos de rota protegida, **rota pública** e ausência de sessão. Foi validado
por mutação: revertido o middleware ao padrão da origem, três testes reprovam,
incluindo o de rota pública. A verificação obrigatória de D-019 **nunca existiu
na origem** — nenhum dos 29 arquivos de teste da branch de referência cobre §6.3.

**Consequência.** O gate de administrador de `/dev` passa a ser real mesmo sendo
`/dev` rota pública no middleware. Rota pública nova que leia perfil nasce
protegida por construção, não por lembrança.

---

## D-030 — Sem `serverEnv()`: a service role não é lida pelo runtime do Next

**Contexto.** O `src/lib/env.ts` da origem expõe `publicEnv` e um `serverEnv()`
que valida `SUPABASE_SERVICE_ROLE_KEY`. **Nenhum arquivo o chama** — nem na
origem, nem aqui.

**Decisão.** `serverEnv()` e o schema de servidor não são replicados. `env.ts`
expõe apenas `publicEnv`.

**Motivo.** No CRM a service role vive num único lugar: os secrets da Edge
Function, onde `admin-create-user` a lê. Um schema no runtime do Next que a
exigisse seria código morto convidando alguém a definir a variável na Vercel
para "o schema parar de reclamar" — colocando a chave exatamente onde o desenho
diz que ela não deve estar.

**Consequência verificável.** Depois da remoção, a string
`SUPABASE_SERVICE_ROLE_KEY` não aparece em `.next/static` **nem em
`.next/server`**. A etapa do CI que varre o bundle client continua valendo como
rede de segurança; o desenho é a chave nunca chegar perto.

---

## D-031 — Migrations aplicadas pelo SQL Editor

**Contexto.** Quem opera o projeto trabalha pelo GitHub web e pelo painel do
Supabase: não há repositório clonado nem CLI. O agente que escreve o SQL não
alcança o Supabase — a política de rede do ambiente recusa a conexão antes de
qualquer autenticação. Nenhum dos dois lados pode rodar `supabase db push`.

**Decisão.** As migrations são aplicadas **colando o arquivo no SQL Editor** do
painel. `db push` não é usado — nunca, nem no futuro próximo.

**Consequência, escrita porque é a parte que morde.** O banco **não conhece o
histórico de migrations**. A tabela `supabase_migrations.schema_migrations`,
que o CLI usa como registro do que já foi aplicado, permanece vazia. Portanto:

- **O repositório é a única fonte da ordem aplicada.** `supabase/migrations/` em
  ordem numérica é o registro; não existe segunda fonte para conferir.
- `supabase migration list --linked` reportaria "nada aplicado" mesmo com o banco
  inteiro construído. É informação enganosa, não incompleta.
- Um `db push` futuro tentaria reaplicar **tudo desde a 0001**.

**Migração para CLI, se um dia acontecer.** `supabase migration repair
--status applied <versão>` marca cada versão como aplicada sem reexecutá-la,
reconstruindo o histórico a partir do repositório. É o caminho previsto; não
improvisar outro.

**Scripts removidos do `package.json`.** `db:push`, `db:push:dry` e `db:status`
saíram. Atalho que contradiz a decisão é convite a usá-lo por engano, e
`db:status` seria pior que inútil: reportaria banco vazio com convicção.

**O que substitui a confirmação do `db push`.** Cada migration vem com um script
de verificação em `supabase/checks/`, somente leitura, que lê o catálogo do
Postgres e compara com o modelo — colunas, tipos, defaults, constraints, índices,
`security definer`, `search_path`, triggers, RLS e policies. "Apliquei" vira
"apliquei e aqui está a prova".

---

## D-032 — Diretório restrito de usuários para vínculo

**Contexto.** `profiles_select` permite leitura apenas da própria linha e do
administrador (`RLS_PERMISSOES.md` §5.1). Mas os formulários de diretor, gestor
e vendedor permitem vincular a pessoa a um usuário existente (`profile_id`), e
quem escreve neles é `gestor_adm` além do administrador. Com a policy atual, o
gestor não enxerga a lista para escolher.

**Decisão.** Uma **view restrita** expondo apenas `id` e `full_name` dos perfis
ativos, para preencher o select de vínculo. A policy de `profiles` **não** é
alargada.

**Motivo.** Alargar daria ao gestor `role`, `is_active` e o e-mail de todos os
usuários, quando ele precisa apenas de um nome e um id. A capability §3 dá
`usuarios.read` só ao administrador; a view atende a necessidade real sem
contrariar a matriz.

**Cuidado obrigatório, a documentar no cabeçalho da view.** View sobre tabela com
RLS é `security definer` na prática: ela roda com os privilégios de quem a criou,
**ignora a RLS da tabela base**, e o `WHERE` dela passa a ser a única barreira. O
linter do Supabase vai apontar — é o mecanismo, não um defeito. Documentar a
exceção, não "corrigir".

Consequência: a view não pode ganhar coluna nova sem revisar o que ela expõe.
Acrescentar `email` ali seria alargar a leitura sem tocar em policy nenhuma.

---

## D-033 — `reactivation_reason` em coluna própria

Ver a emenda em D-025. Resumo: os motivos de inativação e de reativação vivem em
colunas separadas, porque uma coluna única deixa de responder "por que este
registro está inativo" no instante em que ele é reativado. Migration `0010`.

---

## D-034 — FKs de vínculo sem ação de delete

**Contexto.** As FKs de `profile_id`, `created_by` e `updated_by` nas entidades
da estrutura comercial não declaram ação de delete, então vale `NO ACTION`.
Consequência observada em teste: com um diretor vinculado a um perfil, apagar
aquele usuário no painel de Auth do Supabase é **bloqueado**, com erro de FK
citando `directors`.

**Decisão.** Mantido `NO ACTION`.

**Motivo.** O CRM não apaga usuário — saída de circulação é `is_active = false`.
O bloqueio recusa uma operação que o sistema não sanciona, e falhar alto é melhor
que desvincular em silêncio: `on delete set null` deixaria o cadastro comercial
apontando para o vazio sem nenhum registro de que houve um vínculo.

**Consequência.** Quem precisar apagar um usuário de teste no painel vai receber
um erro de FK que não explica o contexto. É o custo aceito; a alternativa custa
mais.

---

## D-035 — A checagem de service role procura o nome da variável, não o prefixo da chave

**Contexto.** O CI tem uma etapa que reprova o build se a service role aparecer
no bundle. Ela procura a string `SUPABASE_SERVICE_ROLE_KEY`. A "melhoria"
evidente seria procurar também `sb_secret_`, o prefixo do formato novo de
chave — afinal é o valor, não o nome, que causa dano.

**A melhoria evidente quebra o CI para sempre.** O próprio
`@supabase/supabase-js` carrega o prefixo em código de detecção de formato:

```js
e.startsWith("sb_publishable_") || e.startsWith("sb_secret_")
```

Isso entra em `.next/server/chunks/*` de **qualquer** build que use a
biblioteca — verificado neste repositório, na etapa 1 da Sprint 2. Não é
vazamento: é a biblioteca reconhecendo o formato de uma chave que ela recebe,
e o literal existe mesmo quando nenhuma service role passa perto.

**Decisão.** A checagem procura **`SUPABASE_SERVICE_ROLE_KEY`** — o nome da
variável — em `.next/static` **e** em `.next/server`. Não procura `sb_secret_`,
nem qualquer prefixo de chave.

**Por que isto está escrito.** Sem este registro, o desfecho é previsível:
alguém alarga o padrão de boa-fé, o CI fica vermelho em todo build, e a saída
mais rápida é desligar a checagem. **Uma verificação de segurança desligada é
pior que a versão limitada que ela substituiu**, porque some junto com o sinal
de que existia.

**O que a checagem não faz, e é bom saber.** Ela pega a reintrodução por nome —
um `serverEnv()` de volta, um `process.env.SUPABASE_SERVICE_ROLE_KEY` em código
de runtime. **Não pega** uma chave colada como literal sem o nome ao lado. Isso
é rede de segurança, não autorização: o desenho é a chave nunca chegar perto do
bundle (D-030), e a checagem só avisa quando o desenho falhou de um jeito
específico.

---

## D-036 — `is_active` de usuário é encerramento operacional, não erro cadastral

**Contexto.** A matriz de D-022 não incluía `profiles`. A pergunta apareceu na
etapa 1 da Sprint 2, quando a tela de usuários passou a existir e a ação de
desativar ficou sem semântica definida.

**Decisão.** Para usuário, `is_active = false` é **encerramento operacional**.
A pessoa saiu da empresa ou perdeu o acesso; o registro continua válido e o
histórico continua contando. Não é o caso de cadastro mestre de D-022, onde
`status = 'inativo'` significa registro criado incorretamente.

Consequências que decorrem disso, e não de preferência:

- **O que ela apaga é acesso, não existência.** Quem desativou continua sendo o
  autor das linhas que criou, continua resolvível em `inactivated_by`, em
  `ended_by` e em toda trilha. Um usuário desativado que sumisse das telas
  transformaria histórico em referência quebrada.
- **A reativação é normal, não excepcional.** Alguém volta de licença, muda de
  área e volta. Isso não exige o rito de D-025, escrito para reverter erro de
  cadastro.
- **`profiles` não ganha `status entity_status`.** `is_active` já responde a
  pergunta certa, e acrescentar a coluna de cadastro mestre traria junto a
  semântica errada.

**Fica na matriz de D-022 assim:**

| Entidade | Operação normal | Quem faz | Inativação (`status = 'inativo'`) |
| --- | --- | --- | --- |
| `profiles` | desativar/reativar acesso (`is_active`) | administrador | não existe conceito — ver D-036 |

**O que ainda não está decidido:** onde a ação entra na interface e se ela grava
motivo e autoria. A proposta está no plano da Sprint 2.

---

## D-037 — Estado de formulário não sobrevive à interação seguinte

**Contexto — o encadeamento completo, porque a lição está nele.**

Um bug foi relatado na tela de usuários: logado como administrador, "Gerar nova
senha" respondia *"Somente administradores podem criar usuários"*. Dois defeitos
aparentes — a ação falhava para quem tinha permissão, e a mensagem descrevia
outra ação.

A investigação consumiu uma rodada inteira:

1. A mensagem era **uma só, escrita para criação**, e saía de cinco pontos: as
   três guardas locais e as duas traduções da resposta da Edge Function. Uma
   recusa na tela não dizia qual camada disparou.
2. Foi lido o log de invocações da Edge Function para desempatar. Ele mostrava
   **nenhuma chamada no horário**, o que apontava para a guarda local.
3. Só que as duas guardas — criar e regenerar — são **byte a byte idênticas**, e
   a criação havia passado minutos antes. A contradição não fechava.
4. **Nunca houve recusa.** Testada depois, a regeneração funcionou: o consultor
   recebeu a senha temporária e trocou sem erro.

O que estava na tela era um `Alert` **pendurado de uma submissão anterior**,
provavelmente da janela de deploy. `useFormState` guarda o último retorno da
action e não oferece reset: a mensagem sobrevive a `revalidatePath`, a re-render
e a qualquer outra interação, até uma nova submissão *daquela mesma action*.

**Foi lido um log para explicar um evento que não ocorreu.**

Primeira ocorrência da família nomeada em `CLAUDE.md` — *evidência produzida
pelo mecanismo que deveria ter falhado não vale*. A mensagem na tela era o
próprio defeito se fazendo passar por sintoma de outra coisa. A segunda
ocorrência veio em D-043.

**Decisão.** Feedback de formulário pertence à interação que o produziu, e a
interação seguinte o encerra — abrir diálogo, fechar, cancelar, confirmar.
Implementado em `useFeedbackDescartavel`, aplicado aos três formulários da tela
de usuários e obrigatório nos que vierem.

**Por que a correção entra por mérito próprio, sem bug para consertar.** Estado
de formulário que sobrevive à interação seguinte não é ruído visual: **é
instrumento de medida quebrado**. Ele fabrica evidência, e evidência fabricada
custa rodada de investigação — aqui custou uma inteira, mais a leitura de um log.
A ausência de bug não torna a correção opcional.

**O achado que vale mais que a correção.** A etapa 1 já tinha esbarrado neste
defeito: `senhaFechada` era um controle paralelo, criado para o diálogo de senha
sumir ao fechar. **Um contorno local para um defeito de padrão deixa o padrão
intacto e esconde o sintoma no único lugar onde alguém olharia.** Os outros dois
formulários seguiram pendurando mensagem, e um deles produziu a evidência falsa.
Virou regra no `CLAUDE.md`: quando um contorno local resolver um sintoma,
perguntar se o mesmo defeito existe nos irmãos antes de seguir.

**O que ficou coberto e o que não.** A semântica do descarte e a fiação dos
diálogos têm teste, provados por mutação. **A submissão real não tem**:
`useFormState` com action-função depende do suporte a form actions do React que
o Next embarca, e o `react-dom` do `node_modules` não tem — verificado com um
spike, não suposto. Cobrir exigiria dependência nova. Cobertura declarada e
inexistente é pior que ausência assumida, então a ausência está escrita no
arquivo de teste.

---

## D-038 — Scripts de verificação são afirmações de momento, e rodam intercalados

**Contexto.** Ao reconstruir o cluster local do zero, os onze scripts de
`supabase/checks/` foram rodados de uma vez, no fim. **Cinco reprovaram** — e o
primeiro impulso foi ler aquilo como migration irreprodutível.

Não era. As onze migrations aplicaram sem um único erro. Quem falhou foi a
leitura: além de conferir o que a migration criou, vários scripts afirmam o que
ainda **não** deve existir naquele ponto da sequência:

```
0001  nenhuma coluna a mais que o modelo      -> must_change_password é da 0002
0003  current_manager_id ainda SEM FK         -> a FK fecha na 0005
0006  source_ref ainda NÃO existe             -> é da 0007
```

São verdadeiras logo após a própria migration e falsas depois que a seguinte
roda.

**Decisão.** Isso é propriedade desejada, não defeito. **É o que pega migration
que faz mais do que declara** — uma coluna a mais, uma FK antecipada, um índice
que veio junto sem estar no plano. Um script que só conferisse presença deixaria
isso passar.

A consequência é operacional: **verificação roda logo depois da sua migration,
nunca no fim de tudo.** É como já se usava no painel — aplicar, verificar,
seguir (D-031) —, e agora está assim também em
`supabase/dev/reconstruir.sh --checks`.

**Por que isto está escrito.** A leitura errada é atraente: cinco scripts
vermelhos parecem defeito de schema, e o caminho curto dali é "relaxar" as
asserções de ausência para o lote passar. Isso removeria justamente a parte que
detecta migration fazendo mais do que declara — trocando um alarme correto por
silêncio conveniente.

---

## D-039 — CNPJ em formato canônico, imposto pelo banco

**Contexto.** `companies_cnpj_active_unique` é a barreira contra cadastro
duplicado de estabelecimento. Ela é um índice único sobre a coluna `cnpj`, e um
índice compara **texto**: `'12.345.678/0001-90'` e `'12345678000190'` são dois
valores diferentes, e os dois entram.

**Decisão.** O banco impõe o formato:

```sql
check (cnpj is null or cnpj ~ '^[0-9]{14}$')
```

Quatorze dígitos, sem pontuação, ou nulo.

**Por que no banco e não só na aplicação.** Sem a constraint, a unicidade passa a
depender de **todo** chamador normalizar — importação, tela de cadastro,
integração de consulta de CNPJ, API futura. Basta um esquecer para o duplicado
entrar **sem erro nenhum**: nada falha, nada avisa, e o sistema passa a ter dois
estabelecimentos que são o mesmo.

É o cenário que D-006 e D-016 existem para impedir. D-006 diz que o consultor
não é dono do CNPJ e que CNPJ já cadastrado **não gera erro de duplicidade** — o
sistema recupera o estabelecimento e informa a situação. Isso só funciona se o
banco souber o que é "o mesmo CNPJ".

**Consequência aceita, escrita porque é a parte que morde.** Normalizar passa a
ser responsabilidade de quem escreve, e o banco **recusa** o que não estiver
canônico. Isso custa tratamento de erro na tela de cadastro e no motor de
importação — uma planilha com CNPJ pontuado falha em vez de entrar torta.

É o custo certo. Duplicata silenciosa custa mais, e cobra depois, quando dois
consultores já trabalharam o mesmo estabelecimento por caminhos diferentes.

**O que a constraint NÃO faz.** Não valida dígito verificador. Formato canônico
é sobre comparabilidade — que o índice enxergue igualdade —, não sobre o CNPJ
existir. Validação de DV, se entrar, é da aplicação ou do fornecedor de consulta
(D-008), e não substitui esta constraint.

---

## D-040 — Fronteira do dado financeiro, com gatilho explícito

**Contexto.** O requisito de "Novos Comércios" (D-041) traz, na sua segunda
fase, movimentação mensal, taxa administrativa e spread acumulado. Isso
contradiz uma premissa registrada — `RLS_PERMISSOES.md` §2, sobre o papel
`financeiro`:

> *"Praticamente fora do CRM na V1 — **não há dado financeiro**; taxa negociada
> é condição comercial, não faturamento."*

A decisão é escrita **antes da primeira coluna**, e não quando a contradição já
estiver no banco. Requisito financeiro que entra por partes — "só uma coluna de
faturamento previsto" — nunca provoca a decisão, e a matriz de permissões fica
defasada em silêncio.

**Decisão. A fronteira é entre estimativa e realizado.**

| Lado | O que é | Exemplos | Situação |
| --- | --- | --- | --- |
| **Estimativa comercial** | o que se espera ou se negocia | previsão de faturamento, taxa negociada, condições comerciais | **permitido na V1** — já é o que a §2 chamava de condição comercial |
| **Faturamento** | o que aconteceu | movimentação realizada, spread acumulado, comissão efetivamente paga | **exige revisitar a §2 antes de entrar** |

**O gatilho, explícito.** A primeira migration que criar coluna ou tabela do lado
direito **não é aplicada** sem que, antes:

1. `RLS_PERMISSOES.md` §2 seja reescrita — o papel `financeiro` deixa de ser
   "praticamente fora do CRM" e ganha matriz própria;
2. a matriz de §3 receba o módulo correspondente, com as três capacidades
   declaradas para os seis papéis;
3. `src/lib/permissions/can.ts` acompanhe, e o espelho TS × RLS seja conferido
   pelos testes de §6.

**Por que o gatilho é a migration e não a tela.** A tela é reversível; a coluna
aplicada não (D-021 — correção é migration nova). E o papel `financeiro` existir
sem leitura é diferente de existir com leitura errada.

**Consequência imediata.** A fase 1 do requisito — cadastro, vínculo de demanda,
previsão de faturamento — **passa limpa**: é toda do lado esquerdo. Nenhuma
revisão de permissão é necessária agora.

---

## D-041 — Comércio credenciado e empresa demandante

**Contexto.** A operação credencia comércios para atender demandas de empresas
clientes. O vínculo comércio → empresa demandante só existia em e-mail, e sem
ele não há como responder à objeção da diretoria: se o credenciamento está
descolado da venda.

**Decisão 1 — mesma tabela, classificação explícita.**

Empresa cliente e comércio credenciado são ambos linhas em `companies`. São
pessoas jurídicas com CNPJ, endereço e consulta de CNPJ idênticos, e o índice
único parcial de CNPJ é **por tabela**: em duas tabelas, o mesmo CNPJ entraria
nas duas sem nada impedir — e o caso não é hipotético, uma empresa cliente pode
também ser credenciada como comércio.

A classificação é **explícita**, em `is_merchant` e `is_client_company`,
`not null default false`. **Nunca inferida.** A alternativa — deduzir "é empresa
cliente" da ausência de linha em `crm_company_relationships` — é o mesmo erro que
a regra de `prospect × base_vegas` proíbe.

Migram para tabelas de papel dedicadas sem perda, quando "ser comércio" ganhar
atributos próprios.

**Decisão 2 — o vínculo de demanda é N:N, e não contradiz D-014.**

A distinção é de **assunto**, não de cardinalidade:

```
crm_company_relationships   nosso relacionamento COM o estabelecimento
                            prospect × base_vegas, consultor responsável
                            1:1 por empresa (D-014)

vínculo de demanda          qual empresa cliente DEMANDOU este credenciamento
                            relação entre DUAS empresas · N:N
```

D-014 restringe quantas linhas de relacionamento uma empresa tem. O vínculo é
outra tabela, com outro sujeito. **Seria** contradição pôr a empresa demandante
como coluna em `crm_company_relationships`: aí um comércio com duas demandantes
exigiria duas linhas de relacionamento.

**Não usar `parent_company_id`.** É grupo econômico — matriz e filial, mesma
titularidade. Usá-la aqui faria a filial virar "demandante" da matriz em
qualquer consulta que percorresse a árvore.

**Decisão 3 — o vínculo guarda apenas origem: quem demandou e quando.**

Previsão de faturamento e comissão pertencem ao **comércio**, não ao vínculo,
porque **a comissão é paga uma única vez por comércio**, mesmo com várias
empresas demandando.

**Decisão 4 — CORRIGIDA POR D-042.**

O texto original dizia que comércio pode existir sem demandante. **Está errado.**
Credenciamento sem demandante não existe; o que existe é demanda de origem
diferente — empresa cliente, melhoria de rede/Pós-Vendas, melhoria de
rede/Venda Nova. Ver **D-042**.

A conclusão prática sobrevive à correção, por outro motivo: o vínculo continua
não podendo ser o registro de "é comércio", porque agora ele **sempre** existe e
o que varia é o tipo de alvo. O marcador explícito da decisão 1 segue
necessário.

**Decisão 5 — o recorte do vínculo é pelo comércio.**

É o objeto do trabalho comercial e é dele que sai a comissão. Recortar pela
empresa demandante faria o consultor perder de vista o próprio credenciamento
quando a demanda viesse de carteira alheia.

### O que este vínculo responde — e o que NÃO responde

**Não entra na conta econômica.** O spread é do comércio e agrega todas as
empresas que o usam: um comércio credenciado por indicação da empresa X pode
movimentar com A, B e C, e isso é normal e desejável. A conta é **comissão do
comércio contra spread do comércio**; a empresa demandante não participa.

O vínculo responde outra coisa, e é a pergunta que a diretoria fez de fato:
**quantos credenciamentos nasceram de demanda real e quantos de ampliação de
rede.** Comércio sem demandante não é caso de borda — é uma das duas categorias
que a objeção "está descolado da venda" implicitamente separa.

---

## D-042 — Origem da demanda de credenciamento

**Corrige uma premissa de D-041.** Aquela decisão registrou que "comércio pode
existir sem demandante". Está errado: **credenciamento sem demandante não
existe.** O que existe é demanda de **origem diferente**.

| Origem | Alvo |
| --- | --- |
| Empresa cliente | uma empresa nomeada solicitou |
| Melhoria de rede — Pós-Vendas | ampliar a rede para contratos existentes |
| Melhoria de rede — Venda Nova | consultor amplia a oferta antes de prospectar |

**Melhoria de rede tem propósito econômico:** ampliar a rede aumenta o
faturamento dos cartões de contratos que já temos. É **alvo difuso, não ausência
de alvo**. Por isso **todo comércio tem origem**, e comércio sem origem passa a
ser exceção a investigar — não estado normal.

### Decisão 1 — catálogo em tabela, não enum

Critério de D-011, aplicado literalmente: a lista deve ser mantida pelo gestor.
Campanha sazonal e reativação de comércio inativo são candidatas plausíveis, e
com enum cada uma custaria `alter type add value` mais deploy.

`crm_demand_origins` segue o padrão de `crm_loss_reasons`: `match_key` estável
separado do `name` exibido, porque "Melhoria de Rede — Pós-Vendas" vai ser
renomeado e o `match_key` não.

### Decisão 2 — a regra estrutural vem de uma flag no catálogo

`requires_client_company` na linha da origem, lida por trigger.

**Por que não um CHECK.** Uma constraint não lê outra tabela. As alternativas
eram copiar o discriminador para a linha do vínculo — **segunda fonte de
verdade**, e uma linha com origem "Pós-Vendas" e discriminador "empresa_cliente"
seria aceita pelo banco e mentiria — ou deixar a regra só na aplicação, o que não
alcança a importação de planilha, que escreve direto.

Trigger é o mecanismo já estabelecido no projeto para regra que constraint não
alcança. E o paralelo com D-011 é exato, inclusive no motivo: lá a
obrigatoriedade de `loss_notes` vem de `requires_notes` na linha do catálogo, e
**não** de comparação com o literal `'outro'`, que quebraria num rename.

### Decisão 3 — o trigger recusa nas DUAS direções

Bicondicional, não implicação:

```
requires_client_company = true   →  client_company_id NOT NULL, ou recusa
requires_client_company = false  →  client_company_id NULL,     ou recusa
```

Uma linha "melhoria de rede" com empresa preenchida por engano é **ambígua para a
única pergunta que o vínculo existe para responder**. Conta como demanda nomeada
ou não? Qualquer resposta que a contagem der estará errada para metade dos
leitores.

E o erro é invisível: **a linha com todos os campos preenchidos parece mais
completa que as corretas.** É o pior tipo de dado errado — o que aparenta
qualidade.

### Decisão 4 — a demandante precisa ter `is_client_company`

Sem isso, nada impediria apontar **um comércio como demandante de si mesmo**, e
essa linha passaria por todas as outras validações.

---

## O que este trigger NÃO faz

Três limites, escritos porque cada um é um lugar onde alguém confiaria no banco
para coisa que ele não faz.

**1. Verifica presença e papel, não pertinência.** Ele exige que exista uma
empresa e que ela seja `is_client_company`. **Não verifica se é a empresa
certa.** Apontar a demandante errada — empresa B no lugar da A — passa por todas
as validações. Isso é **conferência humana**, e continua sendo.

**2. Se a empresa perder a flag depois, as demandas antigas permanecem.** O
trigger roda na escrita; linhas gravadas quando `is_client_company` era verdadeiro
continuam lá quando alguém desmarcar.

**Isso está certo: histórico não se reescreve.** Uma empresa deixar de ser
cliente hoje não desfaz a demanda que ela fez ano passado — é o mesmo princípio
de D-022, onde encerrar não é apagar.

Está escrito porque o impulso de "corrigir com uma varredura" é forte, e a
varredura destruiria o registro de que aquela demanda existiu — justamente o dado
que a diretoria pediu.

**3. A flag governa estrutura, não verdade.** Diz se o campo deve estar
preenchido; não diz se o conteúdo corresponde ao que aconteceu.

---

## Decisão 5 — o que fica no vínculo

```
crm_accreditation_demands
  merchant_company_id     o comércio · o recorte passa por aqui (D-041)
  origin_id               → crm_demand_origins
  client_company_id       nulo conforme a flag
  requested_at
  responsible_seller_id   nulável · quem CONDUZIU a ação
  team_id                 nulável · quando a ação foi de equipe
```

`responsible_seller_id` e `team_id` **não são** o responsável pelo comércio, que
vive em `crm_company_relationships`. São dois fatos diferentes: quem responde
pelo estabelecimento, e quem conduziu aquela ação. Numa melhoria de rede a
atribuição da ação é justamente o que interessa, e sobrepor os dois a perderia.

## Decisão 6 — "todo comércio tem origem" NÃO vira constraint

É regra de cardinalidade mínima — "pelo menos uma linha filha" —, que FK não
expressa. Forçá-la quebraria a importação, que escreve o comércio antes da
demanda.

**Vira exceção visível: contador no topo da página, por padrão — não filtro.**
Exceção que só aparece quando procurada não é exceção monitorada.

Barrar estruturalmente transformaria dado a corrigir em registro perdido, e **o
que não entra não aparece para ser corrigido**. Na carga inicial isso
significaria descartar exatamente as linhas que precisam de atenção.

---

## D-043 — Comportamento é nível de prova próprio, e o que toca trilha não sai do cluster local

**Contexto.** A `0014` foi provada por mutação: trocando a bicondicional do
`enforce_demand_origin_shape()` por uma implicação simples, `0014_verificacao.sql`
seguiu com **todas as 52 linhas OK** e a linha proibida entrou no banco.

Não é defeito daquele script. Um `*_verificacao.sql` lê o catálogo do Postgres:
confere que a função existe, que a trigger é `BEFORE`, que `prosecdef` é falso,
que o `execute` foi revogado, que o `WHEN` tem `is distinct from`. Nada disso
alcança o que a função **decide**.

Quatro scripts também casam texto no corpo, o que ajuda — e o quanto ajuda foi
medido nesta sprint sobre a `stamp_status_transition`, já aplicada:

| O que se fez ao corpo | `0010_verificacao.sql` |
| --- | --- |
| REMOVER a checagem de motivo da reativação | **reprova** — o texto sumiu |
| envolvê-la em `if false then`, texto intacto | **passa, com tudo OK** |

A busca textual pega a remoção descuidada. Não pega a regra desligada.

**Decisão, parte 1 — a forma.**

1. Regra que vive num corpo de função exige script de comportamento próprio,
   que **escreve, mede e limpa**.
2. Ele é **separado** do `*_verificacao.sql`, que permanece somente leitura.
   Misturar os dois tiraria da verificação a propriedade de poder ser colada em
   qualquer banco sem consequência.
3. O contexto é **declarado, nunca herdado**. As barreiras são escritas
   `auth.uid() is not null and ...`; sem JWT nenhuma dispara, e o script mediria
   o console em vez da regra. Cada caso define `request.jwt.claim.sub`, e um
   caso final mede o console de propósito — para que a porta fique escrita.
4. A recusa é identificada pela **mensagem**, não só pelo `errcode`. Duas
   barreiras diferentes recusam com o mesmo 42501; comparar só o código deixa um
   caso passar pela barreira do vizinho.
5. `reconstruir.sh --checks` roda o comportamento **depois** da verificação da
   mesma migration, nunca no lugar dela.

**Decisão, parte 2 — script que toca trilha não sai do cluster local.**

Medir a família de status **produz** linhas em `crm_record_status_history`, e
limpá-las exige apagar de lá. Que o dono do banco sempre pôde fazer isso, e que
a remoção seja cirúrgica, é tecnicamente correto — e não é o argumento que
decide.

**A regra de D-023 existe para produzir um hábito, e o hábito é o que protege
quando ninguém está prestando atenção.** No momento em que existir no
repositório um script que apaga trilha e que foi feito para rodar no painel, ele
vai ser rodado no painel. Não por quem o escreveu, que sabe exatamente o que ele
faz — por alguém daqui a um ano, depurando outra coisa, que encontra o arquivo e
o executa porque é assim que se verifica trilha neste projeto. Aí a remoção
deixa de ser cirúrgica.

A trilha é o único artefato do sistema irrecuperável por natureza. Foi o
argumento para antecipar essas funções na fila (D-044); vale igualmente aqui.

Três mecanismos, do mais fraco ao mais forte:

| Onde | O quê |
| --- | --- |
| **localização** | `supabase/dev/comportamento/`, não `supabase/checks/` — este último é o diretório do que se cola no painel |
| **cabeçalho** | o motivo escrito no arquivo, não só nesta decisão |
| **recusa** | o script exige `crm.cluster_local = 'sim'`, que só `reconstruir.sh` define no banco que ele mesmo cria |

A localização é o mecanismo que carrega o peso. Aviso em cabeçalho só é lido por
quem já está prestando atenção — que é justamente quem não precisava do aviso.

**A recusa fica DENTRO do bloco que trabalha, como primeira instrução.** Medido:
com a barreira num `do $$` separado antes dele, o `psql` sem `ON_ERROR_STOP`
imprime o erro e **segue** para o bloco seguinte — o script recusou e escreveu na
trilha assim mesmo. Barreira que depende do cliente abortar não é barreira. E a
leitura ingênua do resultado enganou: o banco ficou com zero linhas de trilha,
que parecia prova de recusa e era o `delete` de limpeza tendo rodado.

Segunda ocorrência da família nomeada em `CLAUDE.md` — *evidência produzida pelo
mecanismo que deveria ter falhado não vale*; a primeira foi D-037. O que separou
os casos foi o **segundo** erro: `relation "resultado_trilha" does not exist` só
aparece se o bloco de trabalho nunca rodou, porque a limpeza bem-sucedida
deixaria a temp table de pé. Quando sucesso e falha produzem o mesmo estado
final, procurar um efeito colateral que só um dos dois produz.

`0014_comportamento.sql` **continua em `supabase/checks/`** e continua indo para
o painel: ele não altera status de nada e portanto não gera nem apaga trilha. O
recorte é preciso — *toca `crm_record_status_history`* —, não uma categoria
inteira posta de quarentena por precaução.

**Se um dia for necessário verificar comportamento de trilha contra o banco
real**, isso vira decisão própria, tomada na hora, com o risco na mesa — não
herdada de um arquivo que já estava lá.

**Alternativas descartadas.** Deixar as linhas de teste no histórico do banco
real: contamina relatório para sempre, e o `[teste]` some junto com a entidade
apagada, restando um `target_id` órfão. Manter os scripts em `checks/` com aviso
no cabeçalho: é a formulação que esta decisão corrige.

---

## D-044 — Trilha que não grava é o defeito irrecuperável da família

**Contexto.** O levantamento de 14 funções de trigger com regra no corpo
mostrou famílias de defeito com gravidades diferentes. Uma delas não é
comparável às outras.

**A distinção.** Todo outro defeito desta família deixa rastro. A linha errada
está no banco, e alguém pode encontrá-la — a origem proibida da `0014` aparece
na tabela; o registro reativado indevidamente tem `changed_by` na trilha.

Quando a trilha não grava, não há nada para descobrir depois. **A informação não
existe, e a ausência é indistinguível de uma entidade que nunca mudou de
status.** O defeito apaga a própria evidência de si mesmo.

**Decisão.** As seis funções de trilha têm cobertura de comportamento
antecipada, em `0013_comportamento.sql`, com um caso por escopo. Cada caso
afirma cinco coisas, e cada uma corresponde a um modo de falhar:

| Afirmação | Pega |
| --- | --- |
| exatamente 1 linha | não gravou · gravou duas vezes |
| `scope` correto | cópia com o escopo do vizinho |
| `reason` preenchido e igual ao informado | corpo esvaziado — o modo silencioso |
| `ativo → inativo` | `old`/`new` trocados |
| `changed_by` correto | perda do `auth.uid()` |

**Um script com seis casos, não seis scripts.** As seis funções têm a mesma
forma e foram escritas por cópia — que é exatamente por que o defeito é barato
de introduzir, e por que a cobertura precisa vê-las lado a lado.

Medido: `write_record_status_team()` esvaziada, `write_record_status_seller()`
com o `scope` do vizinho e `write_record_status_company()` sem o motivo passam
**as três** pela verificação estrutural, e reprovam nos casos 3, 4 e 5.

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
