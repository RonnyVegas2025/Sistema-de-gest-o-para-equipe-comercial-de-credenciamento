# CLAUDE.md — CRM Comercial de Credenciamento Vegas

Orientação para o agente. **Este arquivo aponta para as fontes canônicas; não as
duplica.** Se algo aqui divergir de um documento em `docs/`, o documento vence —
e a divergência deve ser corrigida aqui.

---

## O que é este sistema

CRM da operação comercial de credenciamento da Vegas Card: prospecção, carteira,
Base Vegas, pós-credenciamento, oportunidades (Vegas Card e Vegas Pay),
atividades, agenda, visitas com geolocalização e acompanhamento gerencial.

Usuários: consultores comerciais, gestores, diretores e administradores.
Acesso por notebook e **tablet em campo** — usabilidade touch não é detalhe.

Parte da Plataforma Vegas. Não é um cadastro de leads.

---

## Antes de escrever código

Leia, nesta ordem:

```
docs/sprints/SPRINT-<atual>.md   ordem operacional da fase — comece por aqui
docs/DECISOES.md                 decisões fechadas, com rationale
docs/MODELO_DADOS.md             entidades, colunas, índices, constraints
docs/RLS_PERMISSOES.md           matriz de papéis e resolução de escopo
docs/VEGAS-PLATFORM-UI-STANDARD.md    fonte normativa visual
docs/ROADMAP.md                  sequenciamento das sprints
docs/DIVERGENCIAS_BASE.md        o que não copiar do sistema de origem
docs/ARQUITETURA.md              o que ficou implementado (A-006)
```

**Durante a Sprint 1, `docs/sprints/SPRINT-1.md` é o documento mais importante**
— é a ordem de execução autorizada, com critério de aceite por etapa.

`ARQUITETURA.md` foi produzido na última etapa da Sprint 1 (A-006). Ele descreve
**o que ficou implementado**, e suas §9 e §11 são as mais importantes: o que não
existe apesar de parecer, e o que nunca rodou contra ambiente real.

---

## Fonte canônica por assunto

| Assunto | Consultar |
| --- | --- |
| Regra visual | `VEGAS-PLATFORM-UI-STANDARD.md` · `tokens.css` · `IDENTIDADE_VISUAL.md` |
| Arquitetura | `DECISOES.md` · `ARQUITETURA.md` quando existir |
| Banco | `MODELO_DADOS.md` · `supabase/migrations/` |
| Segurança | `RLS_PERMISSOES.md` · policies e triggers reais do banco |

`VEGAS-DESIGN-SYSTEM.md` **não existe**. Não cite como fonte (D-013).

---

## Stack

```
Next.js 14.2 (App Router) · TypeScript strict · Node 22
Tailwind 3.4.17 — VERSÃO FIXA
Supabase: Postgres · Auth · RLS · Edge Functions · supabase-js
Vercel · GitHub Actions · exceljs · zod · lucide-react
```

Sem ORM. Tipos de banco mantidos em `src/types/database.ts`.

**Não atualizar versões sem necessidade e sem teste completo.** Especialmente:
não alterar a versão do Tailwind por existir versão mais nova.

---

## Processo

```
1. entender requisito
2. apresentar plano: arquivos afetados, migrations, riscos
3. aguardar validação quando a alteração for estrutural
4. implementar
5. npm run verify   (format:check · lint · typecheck · test · build)
6. testar no navegador — desktop e tablet
7. documentar a decisão em docs/DECISOES.md
```

Não implementar grandes blocos de arquitetura sem apresentar o plano antes.

Toda página dependente de dados considera cinco estados: `loading`, `empty`,
`error`, `forbidden`, `success`.

---

## Regras invioláveis

**Segurança**

- **Verificação estrutural não alcança comportamento.** Um script que lê o
  catálogo do Postgres confere que o trigger existe, que é `BEFORE`, que não é
  `security definer` — e é **cego para o corpo da função**. Medido na `0014`:
  trocando a bicondicional por uma implicação simples, a verificação seguiu com
  todas as linhas OK e a linha proibida entrou. Regra que vive num corpo de
  função exige script de comportamento próprio, que **escreve, mede e limpa** —
  separado do `*_verificacao.sql`, que é somente leitura (D-043).
- **Casar texto no corpo pega a remoção, não o desligamento.** Um corpo que
  mantenha todos os trechos procurados dentro de um `if false then` passa na
  busca textual e não faz nada. Medido sobre a `stamp_status_transition` já
  aplicada: apagar a checagem de motivo reprova; envolvê-la em `if false`
  passa com tudo OK. Busca textual é degrau, nunca o topo.
- **Em script de comportamento, o contexto é declarado, nunca herdado.** As
  barreiras são escritas `auth.uid() is not null and ...`: no SQL Editor não há
  JWT, nenhuma dispara, e um script que só tentasse a operação mediria o
  console em vez da regra — passando por vacuidade. Cada caso define
  `request.jwt.claim.sub`, e um caso final mede o console de propósito.
- **Trilha que não grava é o único defeito que apaga a evidência de si mesmo.**
  Os demais deixam a linha errada no banco, onde alguém pode encontrá-la. Este
  não: a informação não existe, e a ausência é indistinguível de uma entidade
  que nunca mudou de status. Cobertura de comportamento das funções de trilha
  não espera pela sprint em que der (D-044).
- **Teste que protege fronteira de segurança é validado por mutação.** Escrever
  o teste, quebrar o código de propósito, confirmar que reprova, restaurar.
  Sem isso o teste é uma afirmação, não uma garantia — e teste de segurança que
  passa por vacuidade é pior que teste nenhum, porque cria confiança.
- **Contorno local para sintoma é sinal de defeito de padrão — procurar os
  irmãos antes de seguir.** Quando uma correção pontual resolve o sintoma num
  lugar, perguntar se o mesmo defeito existe nos casos análogos. O remendo deixa
  a causa intacta e, pior, **esconde o sintoma justamente onde alguém olharia** —
  o próximo a aparecer virá de outro lugar, sem o rastro que levaria à origem.
  Caso real: `senhaFechada` escondia o diálogo de senha ao fechar, contornando
  estado de formulário que nunca era limpo. Os outros dois formulários da mesma
  tela seguiram pendurando mensagem, e uma delas fabricou evidência de um bug
  que não existia (D-037).
- **Quando um teste de recusa passar, confirmar por QUAL recusa ele passou.**
  Um teste que reprova pelo motivo errado — validação de formato disparando
  antes da checagem de identidade, papel recusado antes da regra que se queria
  exercitar — é indistinguível de um teste que protege. A mutação é o que
  revela: se remover a barreira alvo e o teste continuar verde, ele nunca a
  testou. Caso real: fixtures com `id: 'a1'` reprovavam por uuid inválido, e a
  recusa de auto-desativação nunca era alcançada (Sprint 2, etapa 1b).
- **Recorte se verifica em TODAS as policies de escrita, não só na de leitura.**
  Uma tabela com `SELECT` recortado e `UPDATE` aberto deixa o consultor
  reatribuir para si um registro fora do escopo — e o `SELECT` recortado
  **esconde a operação depois de feita**. Leitura correta com escrita aberta é o
  modo de falhar mais difícil de perceber: nada na tela denuncia, porque a tela
  obedece à policy certa. Conferir só a de leitura passa por cima dele.
- A RLS é a fronteira real. Menu e guarda de rota são conveniência.
- Nunca relaxar RLS para fazer uma tela funcionar.
- Service role apenas em Edge Function. Nunca no frontend, nunca com prefixo
  `NEXT_PUBLIC_`.
- O middleware **remove** `x-user-profile` recebido do cliente **antes** de setar
  o validado. O `delete` não é opcional (D-019).
- Escopo nunca é inferido pelo papel. Papel diz o que faz; hierarquia diz sobre
  o quê (D-005).
- Usuário com múltiplos vínculos recebe a **união** dos escopos, nunca o
  primeiro papel encontrado.

**Banco**

- Migration aplicada nunca é editada. Correção é migration nova.
- Uma migration por vez, com confirmação antes da próxima.
- `drop policy` sempre em transação.
- `alter table add constraint` guardado por bloco `DO` sobre `pg_constraint`.
- Nenhuma policy de DELETE. Tabelas de histórico não recebem policy de INSERT,
  UPDATE nem DELETE — nem para administrador. Só a trigger `security definer`
  escreve (D-023).
- Distinguir **encerramento operacional** (`ended_at`, `closed_at`, `active_to`,
  status comercial — histórico continua contando) de **inativação por registro
  incorreto** (`status = 'inativo'` — sai de tudo). Matriz por entidade em
  D-022. Não existe função universal de inativação.
- Leitura ampla não é exibição ampla: a RLS diz se a linha é legível, a
  aplicação diz quanto exibir (D-024).
- Inativar grava `inactivated_at`, `inactivated_by` e motivo, por trigger.
  Reativar é privilégio de administrador, exige motivo e gera trilha (D-025).
- Trigger de trilha declara `when (old.x is distinct from new.x)` — `UPDATE` que
  não muda valor não gera linha. Nunca `<>`, que devolve nulo com nulo de um dos
  lados.
- **Regra de comportamento vem de dado do catálogo, nunca de literal no
  código.** Quando uma linha de catálogo muda o que o sistema exige,
  o mecanismo é **flag booleana na própria linha + trigger lendo a flag** — não
  `if valor = 'outro'`. Comparar com literal quebra de dois jeitos: quando
  alguém renomeia a linha, e quando surge uma **segunda** linha com o mesmo
  comportamento. Já apareceu duas vezes: `requires_notes` em `crm_loss_reasons`
  (D-011) e `requires_client_company` em `crm_demand_origins` (D-042). Mesma
  forma, mesmo motivo — e sem isto nomeado, a terceira ocorrência é resolvida
  de outro jeito por quem não viu as duas primeiras.
- Toda função de trilha: `security definer` + `set search_path = public` +
  `revoke execute from public, authenticated`. **Uma por entidade** — gravador
  genérico de histórico anula a imutabilidade.
- **`security definer` é resposta a um problema específico, não estilo de casa.**
  Ele existe onde a função precisa **atravessar** a RLS — trilha que escreve em
  tabela sem policy de INSERT, resolução de escopo que leria a si mesma. Função
  de **validação** não atravessa nada: recusa ou deixa passar, com os
  privilégios de quem chamou. Copiar a assinatura por hábito amplia superfície
  sem ganho, e ainda faz o Security Advisor apontar um lint que não tem
  explicação — o que ensina a ignorar os que têm.
- **`from public, authenticated` são os dois, não um.** Revogar só de
  `authenticated` é inócuo: o grant implícito de `PUBLIC` sustenta o privilégio,
  e nada dá sinal — a trilha continua gravando. Ver `RLS_PERMISSOES.md` §5.6.

**Visual**

- Hexadecimal apenas em `tokens.css`. Cor escrita em componente é erro de lint.
- Caminho de imagem apenas em `brand.ts`.
- Não criar outro design system. O usuário deve reconhecer a Plataforma Vegas.
- Gradiente Vegas é assinatura discreta — linha superior, item ativo, progresso.
  Nunca fundo de card, botão primário, KPI ou grande área colorida.
- Outfit para títulos e KPIs; Inter para formulários, tabelas e navegação.
- Alvo touch mínimo de 44 px em telas de toque; densidade compacta a partir de
  `lg:` (D-027). Label sempre visível; placeholder não substitui label. Não
  empilhar modais.

**Dados**

- `relationship_start_date` (desde quando há relacionamento) ≠ `created_at`
  (quando o registro entrou no sistema).
- Classificação prospect × base_vegas é flag explícita. Nunca inferida por nulo.
- Identidade estável (`match_key`, `source_ref`) separada do nome de exibição.
- Timestamps em `timestamptz`; interface em convenção brasileira.

**Escopo**

- Não copiar `managers.team_id` — vestigial no sistema de origem (D-017).
- Não trazer domínio de Produtos Agregados: vidas, titular/dependente,
  fechamento mensal de agregados, mínimo de fornecedor, combos, retenção.
- Não implementar offline, SSO ou rastreamento contínuo (D-007, D-010).
- Não instalar pacote novo sem decisão registrada.
- Não fazer refatoração cosmética sem relação com a tarefa.

---

## Antes de criar componente novo

1. verificar se já existe em `src/components/ui/`
2. verificar se um existente pode ser generalizado
3. só então criar

---

## Ao aparecer requisito novo

Não alterar arquitetura em silêncio. Primeiro informar:

```
REQUISITO
IMPACTO
ALTERNATIVAS
RECOMENDAÇÃO
ARQUIVOS AFETADOS
MIGRATION NECESSÁRIA
RISCO
```

Depois implementar.

---

## Separações que sustentam o modelo

```
Empresa é entidade permanente.
Oportunidade é comercial.
Atividade é histórica — o que já aconteceu.
Tarefa é futura — o que vai acontecer.
Carteira é distribuição.
Produto é parametrizável.
Visita é evidência operacional.
Geolocalização é contexto da ação, nunca obrigatória.
Permissão é garantida pelo banco.
Design Vegas é compartilhado.
```

Preservar estas separações durante todo o desenvolvimento.
