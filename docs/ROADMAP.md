# ROADMAP — CRM Comercial de Credenciamento Vegas

> Fundação antes de funcionalidade. Sprints pequenas, com plano aprovado antes
> da implementação e verificação antes de declarar concluído.

---

## Sprint 0 · Diagnóstico, decisões e documentação — *concluída*

Planejamento. **Nenhum código, nenhum repositório, nenhuma migration.**

**Entregas**

- Diagnóstico do repositório-base (branch `sprint-3-relatorios-e-estrutura-comercial`)
- 26 decisões arquiteturais fechadas, com rationale e alternativas descartadas
- Modelo de dados proposto, com índices, constraints e ordem de migrations
- Matriz de permissões e estratégia de resolução de escopo
- Registro das divergências com a base técnica
- `CLAUDE.md` e plano executável da Sprint 1

A **fundação física** — criar repositório, copiar componentes, configurar CI,
tokens e shell — é a Sprint 1, etapas 1 e 2. Sprint 0 decidiu o que fazer;
Sprint 1 faz.

`VEGAS-PLATFORM-UI-STANDARD.md` (D-013) precisa estar disponível antes da etapa 2
da Sprint 1. `ARQUITETURA.md` é a última etapa da Sprint 1 (A-006), porque
descreve o que ficou implementado — não uma projeção.

---

## Sprint 1 · Auth, shell, estrutura comercial e **escopo**

A sprint mais crítica do projeto. Auth + hierarquia + RLS + escopo são o
alicerce; depois disso as telas comerciais andam rápido.

A ordem operacional detalhada, com critério de aceite por etapa, está em
`docs/sprints/SPRINT-1.md` — é a fonte para execução. O resumo abaixo é o mapa.

**Etapas 1–2 — Fundação física**
Repositório, Next 14.2, TypeScript strict, Tailwind 3.4.17, Node 22, CI, husky,
script `verify`, `tokens.css`, `brand.ts`, 28 componentes de UI, shell Vegas.
`next.config.mjs` **com `geolocation=(self)`** (D-020). Nenhuma migration.

**Etapa 3 — Supabase e ambientes**
Projeto novo e independente; Supabase e funções da Vercel na mesma região.

**Etapa 4 — Autenticação**
Migrations `0001`–`0002`. Edge Function `admin-create-user`, middleware com
`x-user-profile` **e o `delete` do header forjado** (D-019), `requireProfile`,
login, troca obrigatória de senha, bloqueio de usuário inativo.

**Etapas 5–6 — Estrutura comercial**
Migrations `0003`–`0006`. `teams`, `directors`, `managers`, `sellers` com CRUD.
Cadeia diretor → gestor → equipe → vendedor.

**Etapa 7 — Chave estável e carga**
Migration `0007`: `source_ref` + índices únicos parciais. Spec de importação
adaptada de `sellers.ts`, deduplicando por `source_ref` (D-004). Carga da
estrutura real a partir da exportação do Painel ADM com coluna `id`.

**Etapa 8 — Trilha cadastral**
Migration `0008`: `crm_record_status_history`, colunas de inativação e as
triggers de trilha das entidades da sprint (D-025). **Antes da `0009`** —
`directors`, `managers`, `teams` e `sellers` já admitem inativação aqui.

**Etapa 9 — Escopo hierárquico e RLS**
Migration `0009`: `current_seller_id()`, `current_manager_id()`,
`current_director_id()`, `scoped_seller_ids()` com união de escopos, mais as
policies com recorte. **Bateria completa de `RLS_PERMISSOES.md` §6, incluindo os
testes de ataque às funções privilegiadas.**

**Etapas 10–11 — Verificação e `ARQUITETURA.md`**
`npm run verify`, validação em navegador, e então o `ARQUITETURA.md` refletindo o
que ficou implementado (A-006).

**Critério de fechamento — gate obrigatório.** Quatro usuários reais de teste —
consultor, gestor, diretor e administrador — mais **um quinto com vínculo duplo**
(gestor e vendedor), provando que cada um enxerga exatamente o escopo esperado e
que a união de escopos funciona. Somada à bateria completa de
`RLS_PERMISSOES.md` §6, incluindo os testes de ataque às funções privilegiadas.

Se a bateria não passar, **não se avança para `companies`**. Detalhamento em
`docs/sprints/SPRINT-1.md`.

---

## Sprint 2 · Estabelecimentos, CNPJ e contatos

Migrations `0010`–`0012`.

- `companies` com campos de consulta de CNPJ e coordenadas
- Contrato `CnpjProvider` em `src/services/cnpj/`, com implementação manual como
  fallback (D-008) — fornecedor real fica para A-001
- `crm_contacts` com recorte de escopo (D-009)
- `crm_company_relationships` 1:1 (D-014), classificação prospect × base_vegas
- Busca por CNPJ existente com o comportamento de D-016
- Página do estabelecimento: cadastro, relacionamento, contatos

---

## Sprint 3 · Carteiras e importação

Migration `0013`.

- `crm_portfolios`, `crm_portfolio_companies`, `crm_assignment_history`
- Motor de importação copiado (`types`, `engine`, `csv`, `xlsx`, `grid`)
- Spec de importação de carteira, com prévia obrigatória
- Distribuição e reatribuição com histórico (D-006)
- Minha Carteira, com filtros e layout de tablet

---

## Sprint 4 · Produtos, oportunidades e condições comerciais

Migrations `0014`–`0017`.

- `commercial_products` com `match_key`, `crm_loss_reasons`
- `crm_opportunities` com unicidade de ativa por empresa × produto (D-015)
- `crm_vegas_card_terms`, `crm_vegas_pay_terms`
- `crm_opportunity_status_history` por trigger
- Motivo de perda obrigatório, com `requires_notes` (D-011)
- Página da oportunidade

---

## Sprint 5 · Atividades, agenda e timeline

Migrations `0018`–`0019`.

- `crm_activities` e `crm_tasks`
- Timeline da negociação
- Agenda: retornos de hoje e atrasados
- Vínculo `source_task_id` (A-004)

---

## Sprint 6 · Visitas e geolocalização

- Registro de visita otimizado para tablet — sem formulário gigante em campo
- Captura de coordenadas com precisão e horário
- Estados explícitos: permissão negada, indisponível, falha de captura
- Baixa precisão **não bloqueia** o registro
- **Pré-requisito da sprint:** auditoria de alvo touch de 44 px nos componentes
  (`button`, `input`, `select`, `checkbox`, linhas de tabela)

---

## Sprint 7 · Dashboard e visão gerencial

- Dashboard do consultor: oportunidades por status, retornos de hoje e
  atrasados, visitas de hoje, carteira total, carteira não trabalhada
- Visão do gestor conforme escopo
- Toda métrica responde a uma pergunta operacional — indicador não entra para
  preencher espaço
- Selo de cobertura colado ao número, não em legenda de rodapé: print de tela
  circula sozinho dentro da empresa

---

## Sprint 8 · Pós-Credenciamento, mapa e refinamentos

- Base Vegas como contexto de relacionamento e cross-sell
- Mapa operacional (A-002 decide a biblioteca)
- Cálculo de distância entre visita e estabelecimento
- Refinamentos de responsividade e acessibilidade

---

# Previsto, não construído

A arquitetura não deve bloquear, mas nada disso entra agora: roteirização,
sugestão de rota, check-in/check-out, metas, funil, conversão por consultor /
cidade / produto, ranking, notificações, WhatsApp, e-mail, assinatura digital,
contratos, anexos, propostas, integração Vegas Pay, simulador de taxas,
recomendação por IA, análise territorial, campanhas, leads, SLA, automações de
follow-up.

---

# Processo por sprint

```
1. entender requisito
2. apresentar plano com arquivos afetados, migrations e riscos
3. aguardar validação quando a alteração for estrutural
4. implementar
5. verificar: format:check · lint · typecheck · test · build
6. testar no navegador — desktop e tablet
7. testar estados: loading · empty · error · forbidden · success
8. testar permissionamento por papel
9. documentar decisão em DECISOES.md
10. atualizar CHANGELOG
```

Não declarar "pronto" porque o TypeScript compilou. Não validar interface só por
leitura de código. Não confundir mecanismo entregue com carga de dados feita.
