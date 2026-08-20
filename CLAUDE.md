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
docs/ARQUITETURA.md              ler quando existir
```

**Durante a Sprint 1, `docs/sprints/SPRINT-1.md` é o documento mais importante**
— é a ordem de execução autorizada, com critério de aceite por etapa.

`ARQUITETURA.md` **ainda não existe**: ele é produzido na última etapa da Sprint
1 (A-006), descrevendo o que ficou implementado. Não é pré-requisito de leitura
até lá, e não deve ser escrito antes.

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
- Toda função de trilha: `security definer` + `set search_path = public` +
  `revoke execute from public, authenticated`. **Uma por entidade** — gravador
  genérico de histórico anula a imutabilidade.

**Visual**

- Hexadecimal apenas em `tokens.css`. Cor escrita em componente é erro de lint.
- Caminho de imagem apenas em `brand.ts`.
- Não criar outro design system. O usuário deve reconhecer a Plataforma Vegas.
- Gradiente Vegas é assinatura discreta — linha superior, item ativo, progresso.
  Nunca fundo de card, botão primário, KPI ou grande área colorida.
- Outfit para títulos e KPIs; Inter para formulários, tabelas e navegação.
- Alvo touch mínimo de 44 px. Label sempre visível; placeholder não substitui
  label. Não empilhar modais.

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
