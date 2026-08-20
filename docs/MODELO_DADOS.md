# MODELO DE DADOS — CRM Comercial de Credenciamento Vegas

> Proposta para aprovação. **Nenhuma migration executada** (D-021).
> Rationale das decisões em `DECISOES.md`. Políticas em `RLS_PERMISSOES.md`.

Convenções de auditoria, aplicadas a toda entidade operacional:

```
created_at  timestamptz not null default now()
created_by  uuid references profiles(id) default auth.uid()
updated_at  timestamptz not null default now()   -- trigger set_updated_at
updated_by  uuid references profiles(id)
```

Nenhuma tabela recebe policy de DELETE.

**Encerrar ≠ inativar** (D-022). Toda entidade operacional tem colunas para as
duas semânticas, e elas não se substituem:

| | Efeito |
| --- | --- |
| `ended_at` / `closed_at` / `active_to` preenchido | **Encerrou.** O histórico continua contando; só deixa de valer daí em diante |
| `status = 'inativo'` | **Sai de tudo**, inclusive do histórico. É para erro de cadastro |

O formulário precisa explicar isso na tela, senão o usuário escolhe errado.

**Colunas de inativação**, presentes em toda entidade que admite `'inativo'`
(D-025):

```
inactivated_at      timestamptz
inactivated_by      uuid references profiles(id)
inactivation_reason text
```

**Divisão de responsabilidade entre aplicação e banco.** O motivo é texto que só
o operador conhece — o banco não tem como inventá-lo:

| Campo | Origem |
| --- | --- |
| `inactivation_reason` | **informado pela operação**, validado pela trigger (não vazio) |
| `inactivated_at` | definido exclusivamente pela trigger — `now()` |
| `inactivated_by` | definido exclusivamente pela trigger — `auth.uid()` |

A trigger recusa a transição para `'inativo'` com motivo vazio ou nulo, e grava
a linha em `crm_record_status_history` levando o mesmo texto para `reason`.

**Reativação segue a mesma divisão:** o motivo vem da operação (campo
obrigatório no diálogo de reativação), a autoria e o instante vêm do banco. A
trigger `enforce_reactivation_is_admin()` valida papel **e** presença do motivo
antes de permitir `inativo → ativo`.

Não usar RPC dedicada nesta fase — coluna + validação na trigger resolve sem
acrescentar camada.

Três categorias de enforcement, não uma função universal:

```
CADASTRO MESTRE      → inativação administrativa
ENTIDADE OPERACIONAL → fechamento/cancelamento pela regra de negócio
HISTÓRICO            → imutável no banco (D-023)
```

---

# 1. Tipos

## 1.1 Enums

| Tipo | Valores | Motivo de ser enum |
| --- | --- | --- |
| `app_role` | `administrador` `gestor_adm` `analista_adm` `comercial` `financeiro` `auditoria` | Herdado; muda com mudança de arquitetura, não de operação |
| `entity_status` | `ativo` `inativo` | Herdado |
| `crm_relationship_type` | `prospect` `base_vegas` | Dois estados estáveis; expansão prevista (ex-cliente, suspenso) por `alter type add value` |
| `crm_opportunity_origin` | `novo_prospect` `base_vegas` `importacao` `indicacao` `outro` | Expansão provável, mas não é lista mantida por usuário |
| `crm_opportunity_status` | `nao_iniciada` `em_negociacao` `contrato_firmado` `sem_interesse` | Estável; transições têm regra (D-015) |
| `crm_activity_type` | `ligacao` `email` `whatsapp` `visita` `reuniao` `proposta` `observacao` | Fixo por especificação |
| `crm_task_type` | `ligacao` `email` `reuniao` `visita` | Fixo por especificação |
| `crm_task_status` | `pendente` `concluido` `cancelado` | Fixo |

**Por que `crm_loss_reasons` é tabela e não enum:** a lista é mantida pelo
gestor (D-011). Enum exigiria migration a cada motivo novo.

**Regra geral.** Valor interno é estável; o texto exibido pode mudar sem quebrar
integração. Nunca usar rótulo visível como chave.

---

# 2. Estrutura corporativa

Copiada do sistema de origem (migrations `0001`–`0005`, `0008`–`0010`, `0020`),
com um acréscimo: `source_ref`.

## 2.1 `profiles`

```
id          uuid PK → auth.users(id) on delete cascade
full_name   text not null
email       text not null
role        app_role not null default 'auditoria'
is_active   boolean not null default true
must_change_password boolean not null default true
created_at, updated_at
```

Triggers herdados: `handle_new_user` (nasce sempre como `auditoria`, o menos
privilegiado — promoção é ato explícito de administrador, nunca vem de
metadata), `prevent_profile_tampering`, `set_updated_at`.

## 2.2 `directors`

```
id          uuid PK default gen_random_uuid()
source_ref  text                      -- UUID no Painel ADM (D-004)
full_name   text not null
email       text
profile_id  uuid → profiles(id)       -- NULÁVEL: pode não ter conta
status      entity_status not null default 'ativo'
active_from date
active_to   date
auditoria
```

## 2.3 `managers`

```
id          uuid PK
source_ref  text
full_name   text not null
email       text
role_title  text
mobile      text
phone       text
director_id uuid → directors(id)      -- nulável
profile_id  uuid → profiles(id)       -- nulável
status      entity_status not null default 'ativo'
active_from date
active_to   date
auditoria
```

**Sem `team_id`** — coluna vestigial no sistema de origem (D-017). O vínculo de
gerência é `teams.current_manager_id`, muitos por gestor.

## 2.4 `teams`

```
id                 uuid PK
source_ref         text
name               text not null
description        text
current_manager_id uuid → managers(id)
conta_na_meta      boolean not null default true
status             entity_status not null default 'ativo'
valid_from         date
valid_to           date
auditoria
```

`conta_na_meta` não tem uso na V1 (não há cálculo de meta), mas é carregada
junto: reconstruir a classificação depois exigiria revisitar equipe por equipe.

**FK circular.** `current_manager_id` nasce sem FK e é fechada na migration
seguinte, via bloco `DO` sobre `pg_constraint` — mesmo padrão da `0003`/`0004`.

## 2.5 `sellers`

```
id          uuid PK
source_ref  text
full_name   text not null
email       text
phone       text
mobile      text
team_id     uuid → teams(id)
profile_id  uuid → profiles(id)       -- nulável
status      entity_status not null default 'ativo'
joined_at   date
left_at     date
auditoria
```

**Sem `manager_id`.** O gestor do vendedor é sempre o gestor atual da equipe:

```
seller.team_id → team.current_manager_id → manager
```

Uma coluna `sellers.manager_id` seria a mesma armadilha de `managers.team_id`
(D-017): no dia em que a equipe trocar de gestor, `teams.current_manager_id`
passa a apontar para Maria e `sellers.manager_id` continua em João. Duas fontes
para o mesmo fato, divergindo em silêncio.

A resolução de escopo (`RLS_PERMISSOES.md` §4.2) já percorre o caminho pela
equipe e não precisa da coluna. A importação deriva o gestor da equipe pelo
mesmo motivo (padrão DE-039 do sistema de origem).

Se algum dia houver necessidade funcional de gestor independente da equipe, a
coluna volta **documentada como snapshot ou vínculo independente** — nunca como
espelho do que a equipe já diz.

## 2.6 Índices da estrutura corporativa

```sql
-- Chave estável de replicação (D-004), uma por tabela:
create unique index <t>_source_ref_unique on <t> (source_ref)
  where source_ref is not null;

directors_status_idx, directors_profile_idx
managers_status_idx, managers_director_idx, managers_profile_idx
teams_status_idx, teams_current_manager_idx
sellers_status_idx, sellers_team_idx, sellers_profile_idx
```

---

# 3. Cadastro corporativo

## 3.1 `companies`

Identidade estável do estabelecimento. **Sem coluna de responsável** (D-006).

```
id                      uuid PK
legal_name              text not null
trade_name              text
cnpj                    text                -- só dígitos
legacy_customer_code    text                -- reconciliação com legado
parent_company_id       uuid → companies(id)
relationship_start_date date                -- desde quando há relacionamento
status                  entity_status not null default 'ativo'

-- Dados públicos vindos da consulta de CNPJ (D-008)
situacao_cadastral      text
cnae_principal          text
atividade               text
cep                     text
logradouro              text
numero                  text
complemento             text
bairro                  text
municipio               text
uf                      text
telefone                text
cnpj_lookup_at          timestamptz
cnpj_lookup_source      text                -- qual fornecedor respondeu

-- Geolocalização do estabelecimento (Contexto §23)
latitude                numeric(10,7)
longitude               numeric(10,7)

auditoria
```

**`relationship_start_date` × `created_at`.** O primeiro é desde quando existe
relacionamento comercial; o segundo, quando o registro entrou no sistema. Em
carga retroativa qualquer métrica de "novos no mês" mente se usar `created_at`.
**Não usar `relationship_start_date IS NULL` para classificar prospect** — nulo
também ocorre em carga mal preenchida. A classificação é explícita, em 4.1.

```sql
create unique index companies_cnpj_active_unique on companies (cnpj)
  where status = 'ativo' and cnpj is not null;
create index companies_status_idx on companies (status);
create index companies_municipio_uf_idx on companies (municipio, uf);
```

O índice parcial permite inativar e recadastrar o mesmo CNPJ.

## 3.2 `crm_contacts`

```
id                 uuid PK
company_id         uuid not null → companies(id)
name               text not null
role_title         text
phone              text
mobile             text
whatsapp           text
email              text
is_primary         boolean not null default false
is_decision_maker  boolean not null default false
notes              text
status             entity_status not null default 'ativo'
inactivated_at, inactivated_by, inactivation_reason   -- convenção
auditoria
```

N contatos por estabelecimento. Só `name` é obrigatório. Dado pessoal de
terceiro: acesso restrito por escopo, ver `RLS_PERMISSOES.md` §4.

**Única entidade em que `status = 'inativo'` é operação normal, não correção de
erro** (D-022). "Carlos não trabalha mais no estabelecimento" é mudança natural,
não cadastro errado — por isso `inactivated_at` e `inactivated_by`, preenchidos
por trigger. O contato sai das listas e dos selects, mas continua resolvível nas
atividades em que apareceu.

```sql
create index crm_contacts_company_idx on crm_contacts (company_id);
create unique index crm_contacts_primary_unique on crm_contacts (company_id)
  where is_primary and status = 'ativo';
```

---

# 4. Relacionamento e catálogo

## 4.1 `crm_company_relationships`

**Uma linha por empresa** (D-014).

```
id                     uuid PK
company_id             uuid not null → companies(id)
relationship_type      crm_relationship_type not null default 'prospect'
origin                 crm_opportunity_origin not null default 'novo_prospect'
responsible_seller_id  uuid → sellers(id)
team_id                uuid → teams(id)
relationship_started_at date
ended_at               timestamptz        -- encerramento do relacionamento
ended_by               uuid → profiles(id)
end_reason             text
status                 entity_status not null default 'ativo'
auditoria
```

`ended_at` é encerramento operacional pelo gestor, dentro do escopo. `status =
'inativo'` é retirada administrativa por erro cadastral, restrita a
administrador (D-022). Relacionamento encerrado permanece contando no histórico.

**Sem `portfolio_id`.** A carteira vigente do estabelecimento é descoberta pelo
vínculo, não duplicada aqui:

```
companies → crm_portfolio_companies (ended_at is null) → crm_portfolios
```

Uma coluna `portfolio_id` no relacionamento seria segunda fonte de verdade:
poderia apontar para a Carteira A enquanto o vínculo vigente em
`crm_portfolio_companies` aponta para a Carteira B, sem nada no banco impedindo.
Como bônus, some a FK para uma tabela que só nasce duas migrations depois.

```sql
create unique index crm_company_rel_company_unique on crm_company_relationships (company_id);
create index crm_company_rel_seller_idx on crm_company_relationships (responsible_seller_id);
create index crm_company_rel_team_idx   on crm_company_relationships (team_id);
create index crm_company_rel_type_idx   on crm_company_relationships (relationship_type);
```

O índice em `responsible_seller_id` é o que sustenta o recorte de escopo — sem
ele, toda avaliação de policy vira varredura.

## 4.2 `commercial_products`

```
id                       uuid PK
match_key                text not null      -- VEGAS_CARD, VEGAS_PAY
name                     text not null      -- editável
category                 text
status                   entity_status not null default 'ativo'
allows_new_accreditation boolean not null default true
allows_cross_sell        boolean not null default true
auditoria
```

```sql
create unique index commercial_products_match_key_unique on commercial_products (match_key);
```

`match_key` é imutável; renomear `Vegas Pay` para `Vegas Pay Multibandeiras` não
quebra importação nem relação. Produto usado historicamente nunca é excluído —
inativado permanece nos registros antigos.

## 4.3 `crm_loss_reasons`

```
id             uuid PK
match_key      text not null
name           text not null
requires_notes boolean not null default false
sort_order     integer not null default 0
status         entity_status not null default 'ativo'
auditoria
```

Catálogo mantido pelo gestor (D-011). Carga inicial: taxa, prazo, concorrente,
sem interesse, baixo volume, decisão da matriz, produto não adequado, não
localizado, estabelecimento encerrado, outro — este último com
`requires_notes = true`.

**A obrigatoriedade de justificativa vem da flag, não do literal `'outro'`.**

---

# 5. Negociação

## 5.1 `crm_opportunities`

```
id              uuid PK
company_id      uuid not null → companies(id)
relationship_id uuid not null → crm_company_relationships(id)
product_id      uuid not null → commercial_products(id)
seller_id       uuid → sellers(id)
team_id         uuid → teams(id)
origin          crm_opportunity_origin not null
status          crm_opportunity_status not null default 'nao_iniciada'
record_status   entity_status not null default 'ativo'
opened_at       timestamptz not null default now()
closed_at       timestamptz
loss_reason_id  uuid → crm_loss_reasons(id)
loss_notes      text
notes           text
auditoria
```

**Duas colunas de estado, deliberadamente** (D-022):

- `status` é o **estado comercial**. Fechar em `contrato_firmado` ou
  `sem_interesse` é operação de negócio do consultor ou do gestor, dentro do
  escopo. `closed_at` acompanha.
- `record_status` é o **estado cadastral**. `'inativo'` significa registro criado
  incorretamente e é privilégio de administrador.

Uma oportunidade perdida **não** é uma oportunidade inativa. Confundir as duas
faria o funil mentir e o histórico sumir.

**Unicidade de oportunidade ativa** (D-015):

```sql
create unique index crm_opportunities_active_unique
  on crm_opportunities (company_id, product_id)
  where status in ('nao_iniciada', 'em_negociacao')
    and record_status = 'ativo';
```

O `record_status` no predicado é necessário: uma oportunidade criada por engano e
inativada não pode continuar bloqueando a abertura da oportunidade correta.

Encerrada uma negociação, outra pode nascer para o mesmo produto — a anterior
permanece como histórico.

**Motivo de perda obrigatório:**

```sql
constraint loss_reason_required check (
  status <> 'sem_interesse' or loss_reason_id is not null
)
```

`loss_notes` obrigatório quando o motivo tem `requires_notes` é regra
cross-table — **não cabe em CHECK**, exige trigger `before insert or update`.

```sql
create index crm_opportunities_company_idx on crm_opportunities (company_id);
create index crm_opportunities_seller_idx  on crm_opportunities (seller_id);
create index crm_opportunities_status_idx  on crm_opportunities (status);
create index crm_opportunities_product_idx on crm_opportunities (product_id);
```

## 5.2 `crm_opportunity_status_history`

Exigida pelo Contexto §13: toda alteração relevante registra usuário, data, hora,
valor anterior e valor novo. Coluna não guarda série temporal.

```
id             uuid PK
opportunity_id uuid not null → crm_opportunities(id)
previous_status crm_opportunity_status
new_status     crm_opportunity_status not null
loss_reason_id uuid → crm_loss_reasons(id)
notes          text
changed_by     uuid → profiles(id) default auth.uid()
changed_at     timestamptz not null default now()
```

Gravada por trigger `after update` em `crm_opportunities`, **em função `security
definer`** — o único caminho que atravessa a RLS. A tabela não recebe policy de
INSERT, UPDATE nem DELETE, para ninguém, inclusive administrador via API
(D-023). Trilha que a aplicação pode escrever é trilha que a aplicação pode
esquecer de escrever; trilha que a aplicação pode editar não é trilha.

```sql
create index crm_opp_status_hist_opp_idx on crm_opportunity_status_history (opportunity_id, changed_at desc);
```

## 5.3 Condições comerciais por produto

Tabelas específicas, 1:1 com a oportunidade. Evita dezenas de colunas nulas na
tabela principal e permite produto novo sem alterar `crm_opportunities`.

```
crm_vegas_card_terms
  opportunity_id  uuid PK → crm_opportunities(id)
  taxa_administrativa  numeric(7,4)
  prazo                text
  notes                text
  auditoria

crm_vegas_pay_terms
  opportunity_id  uuid PK → crm_opportunities(id)
  taxa_debito          numeric(7,4)
  taxa_credito         numeric(7,4)
  prazo_credito        text            -- D1, D30
  notes                text
  auditoria
```

`prazo_credito` fica como texto com CHECK, não enum: a lista de prazos tende a
variar por negociação mais do que os status.

---

# 6. Operação

## 6.1 `crm_activities` — histórico, o que já aconteceu

```
id              uuid PK
company_id      uuid not null → companies(id)
opportunity_id  uuid → crm_opportunities(id)     -- nulável
seller_id       uuid → sellers(id)
type            crm_activity_type not null
description     text
occurred_at     timestamptz not null
latitude        numeric(10,7)
longitude       numeric(10,7)
accuracy_meters numeric(8,2)
captured_at     timestamptz
auditoria
```

`occurred_at` ≠ `created_at`: a visita pode ser registrada depois de acontecer.

**Geolocalização nunca é obrigatória.** Coordenadas ausentes são estado válido —
permissão negada, dispositivo sem GPS, falha de captura. `accuracy_meters` é
guardada para permitir análise correta e o cálculo futuro de distância até o
estabelecimento. Baixa precisão **não bloqueia** o registro.

```sql
create index crm_activities_company_idx    on crm_activities (company_id, occurred_at desc);
create index crm_activities_opportunity_idx on crm_activities (opportunity_id, occurred_at desc);
create index crm_activities_seller_idx     on crm_activities (seller_id, occurred_at desc);
```

## 6.2 `crm_tasks` — agenda, o que vai acontecer

```
id             uuid PK
company_id     uuid not null → companies(id)
opportunity_id uuid → crm_opportunities(id)
seller_id      uuid → sellers(id)
type           crm_task_type not null
scheduled_at   timestamptz not null
status         crm_task_status not null default 'pendente'
notes          text
completed_at   timestamptz
completed_by   uuid → profiles(id)
auditoria
```

Atividade futura não é armazenada como se já tivesse acontecido. Tarefa atrasada
é `pendente` com `scheduled_at` no passado — **não é status novo**, é consulta.

```sql
create index crm_tasks_seller_sched_idx on crm_tasks (seller_id, scheduled_at)
  where status = 'pendente';
create index crm_tasks_company_idx      on crm_tasks (company_id);
create index crm_tasks_opportunity_idx  on crm_tasks (opportunity_id);
```

O índice parcial atende diretamente "retornos de hoje" e "retornos atrasados" do
dashboard.

## 6.3 `crm_portfolios` e `crm_portfolio_companies`

```
crm_portfolios
  id             uuid PK
  name           text not null
  description    text
  responsible_id uuid → sellers(id)
  origin         crm_opportunity_origin
  region         text
  closed_at      timestamptz          -- encerrada/arquivada (gestor · admin)
  closed_by      uuid → profiles(id)
  status         entity_status not null default 'ativo'   -- inativação admin
  auditoria

crm_portfolio_companies
  id           uuid PK
  portfolio_id uuid not null → crm_portfolios(id)
  company_id   uuid not null → companies(id)
  seller_id    uuid → sellers(id)
  assigned_at  timestamptz not null default now()
  assigned_by  uuid → profiles(id) default auth.uid()
  ended_at     timestamptz          -- encerrado/redistribuído
  ended_by     uuid → profiles(id)
  status       entity_status not null default 'ativo'
  auditoria
```

Redistribuir **não sobrescreve** o vínculo anterior: encerra-o com `ended_at` e
cria linha nova, com o evento em `crm_assignment_history` (D-006, D-022).

```sql
create unique index crm_portfolio_companies_unique
  on crm_portfolio_companies (portfolio_id, company_id)
  where ended_at is null and status = 'ativo';
create index crm_portfolio_companies_seller_idx on crm_portfolio_companies (seller_id);
create index crm_portfolio_companies_company_idx on crm_portfolio_companies (company_id);
```

## 6.4 `crm_assignment_history`

Exigida por D-006. Vínculo anterior nunca é sobrescrito em silêncio.

```
id            uuid PK
scope         text not null
              check (scope in ('relationship', 'portfolio', 'opportunity'))
target_id     uuid not null
company_id    uuid → companies(id)
previous_seller_id uuid → sellers(id)
new_seller_id      uuid → sellers(id)
reason        text
changed_by    uuid → profiles(id) default auth.uid()
changed_at    timestamptz not null default now()
```

`scope` + `target_id` é referência polimórfica deliberada: três origens com a
mesma semântica de evento — *responsável anterior → responsável novo* — e uma
tabela por origem triplicaria a consulta da timeline de reatribuição.

**Sem FK sobre `target_id`, e por isso três proteções obrigatórias** (D-023):

1. `scope` e `target_id` são `not null`;
2. `scope` restrito por CHECK aos três valores conhecidos;
3. **somente a trigger insere** — a ausência de FK não pode virar liberdade para
   a aplicação inventar `target_id`.

**Guarda IDs, não nomes.** Os IDs preservam rastreabilidade; a tela resolve os
nomes atuais na exibição. Nome congelado no histórico diverge do cadastro e
confunde na leitura seis meses depois.

```sql
create index crm_assignment_hist_target_idx  on crm_assignment_history (scope, target_id, changed_at desc);
create index crm_assignment_hist_company_idx on crm_assignment_history (company_id, changed_at desc);
```

---

## 6.5 `crm_record_status_history`

Trilha das transições de validade cadastral (D-025). Distinta de
`crm_opportunity_status_history`, que registra funil comercial.

> Quarta tabela além da lista de §21 do briefing, junto com `directors`,
> `crm_opportunity_status_history` e `crm_assignment_history`. Justificativa:
> inativar por erro cadastral e perder uma negociação são eventos de natureza
> diferente e não podem compartilhar tabela — misturá-los faria o funil
> contabilizar correções administrativas.

```
id              uuid PK
scope           text not null
                check (scope in ('company', 'director', 'manager', 'team',
                                 'seller', 'relationship', 'contact',
                                 'product', 'loss_reason', 'portfolio',
                                 'portfolio_company', 'opportunity'))
target_id       uuid not null
previous_status entity_status not null
new_status      entity_status not null
reason          text
changed_by      uuid → profiles(id) default auth.uid()
changed_at      timestamptz not null default now()
```

```sql
create index crm_record_status_hist_target_idx
  on crm_record_status_history (scope, target_id, changed_at desc);
```

Mesmas proteções de `crm_assignment_history`: `scope` e `target_id` `not null`,
`scope` restrito por CHECK, gravação só por trigger, imutável no banco (D-023).

Cobre os dois sentidos: `ativo → inativo` e a reativação `inativo → ativo`, que
é privilégio de administrador e exige motivo.

## 6.6 Declaração das funções e triggers de trilha

**Uma função por tabela de origem** — `write_record_status_company()`,
`write_record_status_seller()`, `write_opportunity_status_history()`,
`write_assignment_history_relationship()` e assim por diante. Nada de gravador
genérico parametrizável: uma função capaz de inserir qualquer `scope` com
qualquer `target_id` anularia a imutabilidade, bastando chamá-la com os
argumentos certos. Lógica comum, se houver, vive em helper **sem**
`security definer` e **sem** `execute` concedido — o privilégio fica na borda,
não no utilitário.

Assinatura obrigatória:

```sql
create or replace function public.write_<entidade>_<trilha>()
returns trigger
language plpgsql
security definer
set search_path = public            -- fixo e mínimo
as $$ ... $$;

revoke execute on function public.write_<entidade>_<trilha>()
  from public, authenticated;
```

O `security definer` é intencional: é o que atravessa a RLS de uma tabela sem
policy de INSERT. Por isso vem sempre acompanhado de `search_path` fixo e
`execute` revogado. Comentar no cabeçalho — o Security Advisor do Supabase vai
apontar como lint, e alguém vai querer "corrigir".

**Filtro no `WHEN` da declaração**, não dentro da função: assim a função nem é
chamada quando nada mudou (D-025).

```sql
when (old.status is distinct from new.status)                              -- funil
when (old.responsible_seller_id is distinct from new.responsible_seller_id) -- reatribuição
when (old.status is distinct from new.status)                              -- cadastral
```

`is distinct from`, nunca `<>`: com nulo de um dos lados, `<>` devolve nulo e o
trigger não dispara — e sair de responsável nulo para responsável definido é
justamente a mudança que mais interessa registrar.

---

# 7. Diagrama de relacionamentos

```
profiles ──┬─ directors ──< managers ──< teams ──< sellers
           │                                        │
           └── (profile_id nulável em todas)        │
                                                    │
companies ──1:1── crm_company_relationships ────────┤
    │                      │                        │
    │                      └──< crm_opportunities ──┤
    │                                │              │
    ├──< crm_contacts                ├── crm_vegas_card_terms  (1:1)
    │                                ├── crm_vegas_pay_terms   (1:1)
    ├──< crm_activities >────────────┤
    │                                ├──< crm_opportunity_status_history
    ├──< crm_tasks >─────────────────┘
    │
    └──< crm_portfolio_companies >── crm_portfolios

commercial_products ──< crm_opportunities
crm_loss_reasons    ──< crm_opportunities
crm_assignment_history  (polimórfica: relationship | portfolio | opportunity)
```

---

# 8. Ordem de migrations proposta

Uma por vez, com confirmação antes da próxima (D-021).

| # | Assunto | Sprint |
| --- | --- | --- |
| 0001 | `app_role`, `profiles`, funções `auth_role`/`is_admin`/`has_role`, `set_updated_at`, `handle_new_user`, `prevent_profile_tampering`, RLS | 1 |
| 0002 | `must_change_password` | 1 |
| 0003 | `entity_status`, `enforce_inactivation_is_admin()`, `enforce_inactivation_is_manager_or_admin()`, `teams` | 1 |
| 0004 | `directors` | 1 |
| 0005 | `managers` + FK circular de `teams` | 1 |
| 0006 | `sellers` | 1 |
| 0007 | `source_ref` nas quatro tabelas + índices únicos parciais | 1 |
| 0008 | `crm_record_status_history` + funções e triggers de trilha cadastral das entidades já existentes | 1 |
| 0009 | Funções de escopo (`current_*`, `scoped_seller_ids`) + policies com recorte | 1 |
| 0010 | `companies` + trilha cadastral | 2 |
| 0011 | `crm_contacts` + trilha cadastral | 2 |
| 0012 | `crm_relationship_type`, `crm_opportunity_origin`, `crm_company_relationships` | 2 |
| 0013 | `crm_portfolios`, `crm_portfolio_companies`, `crm_assignment_history` | 3 |
| 0014 | `commercial_products`, `crm_loss_reasons` | 4 |
| 0015 | `crm_opportunity_status`, `crm_opportunities` + índice único parcial + CHECK | 4 |
| 0016 | `crm_vegas_card_terms`, `crm_vegas_pay_terms` | 4 |
| 0017 | `crm_opportunity_status_history` + trigger; trigger de `requires_notes` | 4 |
| 0018 | `crm_activity_type`, `crm_activities` — **sem** `source_task_id` | 5 |
| 0019 | `crm_task_type`, `crm_task_status`, `crm_tasks`; depois `alter table crm_activities add column source_task_id` com a FK | 5 |

Cada migration que cria entidade com `status` traz junto a trigger de trilha
cadastral correspondente — `crm_record_status_history` nasce na Sprint 1 porque
`directors`, `managers`, `teams` e `sellers` já admitem inativação lá.

**`source_task_id` não existe na `0018`.** A coluna referencia `crm_tasks`, que
só nasce na `0019` — criar a coluna antes obrigaria a um `alter table add
constraint` posterior, e criar a FK antes é SQL impossível. Mais simples do que
o padrão de FK circular de `teams`/`managers`: aqui não há circularidade real,
só ordem. A coluna e a FK entram juntas na `0019`, depois de `crm_tasks`.

---

# 9. Pontos que exigem atenção na implementação

1. **Timezone.** Banco em `timestamptz`, interface em convenção brasileira.
   Nunca assumir que timestamp do navegador e do banco representam o mesmo fuso
   sem tratamento.
2. **Não existe função universal de inativação** (D-022). São três: uma para
   cadastro mestre (administrador), uma para catálogo (`gestor_adm` +
   administrador) e nenhuma para histórico, que é imutável. Entidades
   operacionais encerram por coluna própria (`ended_at`, `closed_at`,
   `status` comercial), não por inativação. Ver `RLS_PERMISSOES.md` §5.7.
3. **Não criar índice indiscriminadamente.** Os listados aqui são os que
   sustentam recorte de escopo, dashboard e busca por CNPJ. Índice novo exige
   consulta que o justifique.
4. **Região.** Supabase e funções da Vercel na mesma região (`sa-east-1` /
   `gru1`). Latência entre regiões multiplica por cada round-trip.
