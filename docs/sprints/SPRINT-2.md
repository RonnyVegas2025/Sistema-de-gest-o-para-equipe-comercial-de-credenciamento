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
1b Desativar e reativar acesso           sem migration
1c Diagnóstico de recusa na função       sem migration · programada
1d Bug de regeneração                    encerrado · não reproduzível
2  Correção do CI                        sem migration · concluída
3  0012  companies                       leitura ampla, exceção documentada
4  Contrato CnpjProvider                 sem migration
5  0013  relacionamento + enums          primeiro enforcement real do recorte
5b 0014  vínculo de demanda + marcadores requisito da diretoria (D-041)
5c Página Novos Comércios                sem migration · prazo de uma semana
6  0015  crm_contacts                    recorte transitivo · REORDENADA
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
ação passa a ter lugar definido.

**Onde ela entra:** etapa 1b, logo abaixo.

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

## 1b · Desativar e reativar acesso

Aprovada depois da etapa 1, uma vez que **D-036** definiu a semântica que
faltava: `is_active = false` é **encerramento operacional**, não erro cadastral.
A pessoa saiu da empresa ou perdeu o acesso; o registro continua válido e o
histórico continua contando.

Aproveita a tela que já existe. Sem migration, sem Edge Function — não precisa
de service role: é `UPDATE` em `profiles`, e a RLS já restringe a escrita.

**Entrega**

- ação na coluna de ações da `/usuarios`, ao lado de "Gerar nova senha";
- `ConfirmDialog` nomeando a pessoa e dizendo que o acesso cai no próximo
  request;
- **reativar é o mesmo caminho, invertido.** Por D-036 é operação normal, não
  rito de exceção — não exige motivo nem o procedimento de D-025, que existe
  para reverter erro de cadastro.

**A ação recebe o estado alvo, não um "alternar".** Um toggle decide a partir do
que a tela acredita; com a lista desatualizada — outra aba, outro administrador —
ele inverte o valor errado. Mandar `ativo: false` significa *deixe desativado*, e
é idempotente.

### O administrador não pode desativar a si mesmo

É o modo mais rápido de perder o acesso administrativo do projeto: a recuperação
seria pelo painel de Auth, à mão, e ninguém saberia por onde começar.

**A recusa vive na Server Action, não na ausência do botão.** Botão escondido não
é autorização — é a mesma lógica do saneamento de `x-user-profile` (D-019) e da
camada 3b: quem chama direto não vê botão nenhum. A tela também esconde a ação
na própria linha, mas isso é conveniência.

**Motivo e autoria ficam de fora**, e não por esquecimento: exigiriam colunas
novas em `profiles`, portanto migration, portanto uma decisão que não existe.
Quando existir, entra como migration própria.

*Aceite:*

1. Desativar um usuário pela tela; a sessão viva dele cai no reload seguinte.
   **Isso não é reverificação da Sprint 1** — lá se provou o middleware; aqui se
   prova que a tela dispara o mesmo `UPDATE`.
2. Reativar devolve o acesso, sem exigir motivo.
3. **Teste explícito:** chamar a Server Action com o próprio `id` recebe recusa,
   e o `UPDATE` **não** chega a ser emitido. Provado por mutação: removendo a
   checagem, o teste reprova.
4. Um `comercial` que chame a ação recebe recusa.
5. Estado desatualizado não inverte valor errado: a ação recebe o alvo.
6. Alvo de toque de 44 px; a confirmação não empilha modal sobre modal.

---

## 1c · Programada, sem urgência — a Edge Function distinguir "não é admin" de "não consegui verificar"

Achado ao investigar um bug relatado na etapa 1: regenerar senha recusando um
administrador legítimo, com a mensagem de criação de usuários.

A parte de mensagem já foi corrigida — cada ação nomeia a si mesma, e a recusa
da aplicação usa texto diferente da recusa do serviço, para que a próxima
reprodução diga sozinha qual camada disparou.

**O que falta é na função**, e depende de repastá-la no painel, por isso está
aqui e não junto da correção:

```ts
const { data: callerProfile } = await authClient
  .from('profiles').select('role').eq('id', caller.id).single()
if (!callerProfile || callerProfile.role !== 'administrador') {
  return json(403, { error: 'forbidden' })
}
```

**O erro do `.single()` é descartado.** Zero linhas, mais de uma, falha de rede —
tudo vira `data: null`, e a função responde `403 forbidden`. Recusar por padrão
está certo; **registrar como "você não é administrador" não está**. Uma falha de
infraestrutura fica indistinguível de uma negação de permissão, e alguém depura
permissão por horas enquanto o problema é conexão.

*Proposta:* separar os dois. Papel lido e diferente de `administrador` continua
`403 forbidden`; leitura que falhou vira `503 role_check_failed`, com o erro no
log da função. A recusa continua sendo o padrão seguro — o que muda é ela parar
de mentir sobre o motivo.

*Aceite:* reproduzir os dois caminhos e ver códigos diferentes; o log da função
registrando o erro real da leitura.

**O log foi lido, e este defeito NÃO era a causa do bug relatado** — não houve
bug (ver 1d). A etapa segue programada pelo mérito próprio, sem urgência: falha
de infraestrutura indistinguível de negação de permissão faz alguém depurar
permissão por horas enquanto o problema é conexão. Entra quando houver outra
razão para repastar a função no painel.

---

## 1d · Encerrada — bug de regeneração de senha, não reproduzível

**Relato:** logado como administrador, "Gerar nova senha" respondia *"Somente
administradores podem criar usuários"*.

**Resultado: não havia bug de permissão.** Testado depois da correção de
mensagem, o fluxo funcionou — o consultor recebeu a senha temporária e trocou
sem erro.

O que estava na tela era um `Alert` **pendurado de uma submissão anterior**,
provavelmente da janela de deploy. `useFormState` guarda o último retorno e não
oferece reset, então a mensagem sobrevivia a `revalidatePath`, a re-render e a
qualquer outra interação.

**Encerrado como não reproduzível, por evidência contaminada.** O encadeamento
completo está em **D-037**, e vale ler inteiro: a mensagem ambígua consumiu uma
rodada, e o log da Edge Function foi lido para explicar um evento que não
ocorreu.

Duas correções saíram daqui, e **as duas entram por mérito próprio, sem bug para
consertar**:

| | |
| --- | --- |
| Mensagem por ação e por camada | uma recusa passa a dizer quem recusou |
| `useFeedbackDescartavel` | estado de formulário deixa de fabricar evidência |

A terceira, a da Edge Function, virou a etapa 1c acima.

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

**Um detalhe de shell que já mordeu antes.** A checagem usa `grep -q`, não um
pipeline: o status de saída de `grep ... | head` é o do **último** comando, que
devolve 0 mesmo sem casar nada — uma checagem escrita assim passa sempre. O
`ci.yml` nunca teve esse defeito, mas uma conferência ad-hoc minha teve, durante
a Sprint 1, e chegou a reportar um falso alarme.

*Aceite — cumprido:*

| Estado | Resultado |
| --- | --- |
| build limpo | passa |
| string plantada em `.next/server` | **reprova** |
| a mesma string, na checagem ANTIGA | **passava** — era o furo |
| string plantada em `.next/static` | **reprova** |
| removidas | passa |

A linha 2b é a que dá sentido à etapa: o caso que D-030 existe para impedir
atravessava a checagem anterior sem ruído.

Também nesta etapa: a linha do `README.md` e o comentário do `.env.example` que
diziam que `SUPABASE_DB_PASSWORD` é "exigida por `db push`". `db push` não é
usado neste projeto (D-031).

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

*Aceite — CUMPRIDO em 25/08/2026, contra o banco real: 46 de 46 `OK`.*

As três linhas sobre o recorte:

```
as três policies chamam scoped_seller_ids        3 = 3  OK
o predicado incide sobre responsible_seller_id   3 = 3  OK
ramo de gestão para responsável nulo             3 = 3  OK
```

Provado por mutação, cinco vezes.

> **Correção de 26/08/2026 — a mutação "só o `UPDATE` perdendo o recorte" era
> vácua.** Ela media com `update ... where id = <linha invisível>`, e essa forma
> devolve 0 linhas **com ou sem** recorte na escrita: a policy de SELECT filtra a
> linha antes de a de UPDATE ser consultada. O recorte do `UPDATE` está lá — a
> estrutura confirma —, mas a prova apresentada não era prova. Quem isola a
> policy de UPDATE é o `update` **sem `where`**, e é assim que a etapa 5c-0
> passou a medir: 1 linha com recorte, 3 sem.

### Correção de registro, 26/08/2026 — D-018 não fechou aqui

*A versão anterior desta seção dizia "as três linhas que fecham D-018". Era
forte demais, e a correção importa mais que a etapa.*

Aquelas três linhas leem o `polqual` no catálogo do Postgres. Provam que a
policy **existe** e que **chama** `scoped_seller_ids()`. **Não provam que ela
recorta** — nenhuma linha foi lida por um consultor e negada a outro.

O mesmo vale para o gate de cinco usuários da Sprint 1: rodou pelo SQL Editor,
que é dono, e **o dono não é filtrado pela RLS**. Aquele 8/8 mediu a função de
escopo, não a policy. Continua valendo pelo que mede — a **união** contra
"primeiro papel encontrado" (D-005) é propriedade da função, e isso não muda.

Medido em 26/08/2026 no cluster local: `set role authenticated` devolve
`permission denied for table companies`. O harness nunca reproduziu os grants
que o Supabase configura, então **nenhuma asserção de RLS foi executada até
hoje**, nem aqui nem no painel.

A regra de aceite desta sprint continua tendo funcionado: nenhuma tabela `crm_*`
nasceu sem policy com recorte na mesma migration, e é uma sprint — não três — de
distância entre a função e o enforcement. O que muda é o verbo. **Aplicado não é
exercitado**, e era exatamente ter provado que nos separava do DE-025. Declarar
vitória sobre uma verificação que não verifica é repetir DE-025 com documentação
melhor — e pior, porque ficaria uma linha escrita dizendo que estava fechado.

**D-018 fica como aplicada e não exercitada até a etapa 5c-0.**

---

## 5b · Migration `0014` — vínculo de demanda e marcadores de papel

**Requisito acrescentado pela diretoria durante a sprint.** Avaliado pelo
protocolo do `CLAUDE.md` e registrado em **D-041**; a fronteira do dado
financeiro que ele levanta está em **D-040**.

- marcadores `is_merchant` e `is_client_company` em `companies`,
  `not null default false`, **nunca inferidos** — migration nova, jamais edição
  da `0012`, que já está aplicada em produção;
- **catálogo `crm_demand_origins`**, semeado com as três origens, com
  `match_key` estável e a flag `requires_client_company` (D-042);
- vínculo de demanda N:N guardando **apenas origem**: qual origem, qual empresa
  quando houver, quando, e quem conduziu a ação;
- **trigger bicondicional** lendo a flag do catálogo, mais a checagem de que a
  demandante tem `is_client_company`;
- previsão de faturamento no **comércio**, não no vínculo — a comissão é paga
  uma única vez por comércio, mesmo com várias empresas demandando;
- trilha própria da entidade e **recorte pelo comércio** (D-041, decisão 5).

Nasce com recorte na mesma migration, pela regra inegociável desta sprint.

*Aceite:* script de verificação com todas as linhas `OK`, incluindo o recorte
literal, e as mutações de barreira reprovando — entre elas as duas próprias
desta etapa:

| Mutação | Deve reprovar |
| --- | --- |
| origem que **exige** empresa recebendo `client_company_id` nulo | ✔ |
| origem que **não exige** recebendo empresa preenchida | ✔ |
| empresa demandante sem `is_client_company` | ✔ |

A segunda é a que a bicondicional existe para pegar, e a que uma implicação
simples deixaria passar (D-042, decisão 3).

**Não** existe asserção de "comércio sem vínculo é válido" — D-042 corrigiu essa
premissa. Todo comércio tem origem; o que varia é o tipo de alvo, e o que a
estrutura permite é **vínculo sem empresa**, não comércio sem vínculo.

---

## 5c · Página "Novos Comércios"

Importação de planilha pelo motor da Sprint 1, cadastro manual com consulta de
CNPJ (etapa 4), vínculo à empresa demandante, consultor responsável e previsão
de faturamento.

### O que esta entrega NÃO é

**A página entrega o elo, não a comparação.** A pergunta da diretoria é *"o
credenciamento se paga, e em quantos meses?"*, e responder exige quatro entradas:
comissão paga, movimentação realizada, taxa administrativa e o vínculo. **Esta
etapa entrega a quarta.** As outras três seguem em planilha.

Está escrito aqui porque o modo de falhar é específico e silencioso: a tela fica
pronta, todo mundo vê o vínculo aparecendo, e a pergunta segue sem resposta com
a sensação de que foi endereçada. A análise manual em paralelo é o que responde à
diretoria nesse meio-tempo, e ela não é contingência — é o caminho certo para o
prazo.

**E o vínculo não entra na conta econômica.** O spread é do comércio e agrega
todas as empresas que o usam (D-041). O que o vínculo responde é outra coisa, e é
a objeção real: quantos credenciamentos nasceram de demanda e quantos de
ampliação de rede.

*Aceite:* os cinco estados; importação com prévia obrigatória; cadastro com cada
uma das três origens, incluindo uma de melhoria de rede sem empresa; alvo de
toque de 44 px.

E o indicador de exceção: **contador de comércios sem origem no topo da página,
visível por padrão — nunca filtro que alguém precisa lembrar de aplicar**
(D-042, decisão 6). Exceção que só aparece quando procurada não é monitorada.

---

## 6 · Migration `0015` — `crm_contacts`

**Renumerada de `0014` para `0015`** pela entrada do vínculo de demanda (D-041).
Contatos não participa da página "Novos Comércios", não tem dependente naquele
requisito, e mover não quebra a regra de recorte — o recorte de contatos depende
do relacionamento, que continua antes. É a terceira emenda de numeração;
`reconstruir.sh` reprova quem aplicar fora de ordem.

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

## 8 · Bateria de RLS §6.1 — CUMPRIDA em 26/08/2026, na etapa 5c-0

Os cenários que a Sprint 1 registrou como "não verificáveis, exigem tabelas da
Sprint 2" foram executados — em `supabase/dev/comportamento/0014_rls.sql`, com
11 casos, todos `OK`, e seis mutações.

### Correção de plano: roda no CLUSTER, não no projeto hospedado

O plano original previa esta bateria "contra o banco real, pelo SQL Editor, na
forma do gate da Sprint 1". **Não dá, e o motivo é do próprio conteúdo dela.**

Ela precisa de uma hierarquia comercial inteira — dois consultores em equipes
distintas, um gestor, um diretor, um usuário de vínculo duplo, um administrador.
Perfis exigem linhas em `auth.users`, e o schema de autenticação de um projeto
real não é lugar de fixture. Reusar os cinco usuários do seed também não serve:
o caso de vínculo duplo exigiria alterar vínculos reais, contaminando o gate.

### A consequência, escrita como limite e não como equivalência

**A RLS passa a ser provada no cluster local, e não no projeto hospedado. O que
fica descoberto é divergência entre os dois ambientes.**

Isso não é hipotético. Foi exatamente uma divergência assim que produziu esta
etapa: o Supabase concede privilégios de tabela a `anon` e `authenticated` por
bootstrap, o harness nunca reproduziu isso, e a consequência — nenhuma asserção
de RLS jamais executada — passou despercebida por duas sprints. Agora os grants
existem em `supabase/dev/02_harness_grants.sql`, **reproduzidos à mão**, e mão
diverge.

O que continua verificável no painel é a estrutura: os `*_verificacao.sql`
conferem que a policy existe, sobre qual coluna incide e que chama a função de
escopo. **Estrutura igual nos dois ambientes + comportamento provado num deles**
não é o mesmo que comportamento provado nos dois, e este parágrafo existe para
que ninguém leia como se fosse.

Mitigação disponível, não implementada: um script somente-leitura que compare os
grants do projeto hospedado com os do harness. Fica proposto — vale a decisão
quando houver um segundo caso de divergência, ou antes se alguém quiser.

### Os 11 casos

| Cenário | Esperado |
| --- | --- |
| consultor lê relacionamento do próprio escopo | as linhas dele |
| consultor lê relacionamento de outra equipe | zero linhas, sem erro |
| gestor lê relacionamentos das equipes que gerencia | a união |
| relacionamento com responsável nulo | invisível ao consultor, visível à gestão |
| consultor lê contatos de empresa fora do escopo | zero linhas |
| usuário de vínculo duplo | a **união** dos dois conjuntos |
| qualquer papel tenta `DELETE` | `DELETE 0` — RLS filtra, não levanta |

*Aceite — CUMPRIDO em 26/08/2026: 11 de 11 `OK`.* O caso de vínculo duplo é o
que uma implementação errada reprova: com "primeiro papel encontrado", os demais
devolvem números idênticos.

O cenário de contatos fora do escopo fica para a etapa 6 — `crm_contacts` nasce
na `0015`.

### Dois casos que passavam pela barreira errada

**`UPDATE ... where id = <linha invisível>` não testa a policy de UPDATE.** A de
SELECT filtra a linha antes, e o resultado é 0 com ou sem recorte na escrita.
Descoberto porque a mutação que abre só o UPDATE **não reprovava nada**. Quem
isola é o `update` sem `where` — 1 linha com recorte, 3 sem — que é, aliás, a
forma que um consultor escreveria para reatribuir tudo para si de uma vez.

Isso invalida retroativamente a mutação equivalente da `0013`, corrigida na §5.

**O caso do `with check` recusa 42501 mesmo com `with check (true)`.** O Postgres
exige que a linha atualizada continue visível sob a policy de SELECT, então numa
tabela de SELECT recortado o `with check` é redundante — e o caso não detecta a
ausência dele. Está rotulado dizendo isso. Generalizado em `RLS_PERMISSOES.md`
§5.8: onde o `with check` é a única barreira é em tabela de **SELECT amplo**.

---

## 8b · Comportamento das triggers já aplicadas

A 0014 revelou uma lacuna que não é dela: **`*_verificacao.sql` lê o catálogo do
Postgres e é cego para o corpo da função.** Quatro scripts casam texto no corpo,
o que ajuda — mas um corpo que mantenha todos os trechos procurados dentro de um
`if false then` passa na busca e não faz nada. Isso foi medido, não suposto.

O levantamento encontrou 14 funções de trigger com regra no corpo. Esta etapa
**não fecha todas** — antecipa as que não admitem correção posterior, e deixa o
restante para a Sprint 3 com a forma já estabelecida.

### Por que estas duas primeiro

`enforce_reactivation_is_admin` guarda D-025, e sua queda é silenciosa: um
registro reativado por quem não podia é idêntico a um reativado por quem podia.

As seis funções de trilha são o caso irrecuperável:

> Se a trilha não gravar, não há nada para descobrir depois. A informação não
> existe, e a ausência é indistinguível do caso normal. Todo outro defeito desta
> família deixa rastro — a linha errada está lá, e alguém pode encontrá-la. Este
> apaga a própria evidência de si mesmo.

E é barato de introduzir por acidente: as seis têm a mesma forma e foram
escritas por cópia. Por isso **um script com seis casos**, e não seis scripts.

### O que entrou

| Arquivo | Cobre | Casos |
| --- | --- | --- |
| `supabase/dev/comportamento/0010_status.sql` | `enforce_inactivation_is_admin` (0003) · `enforce_reactivation_is_admin` (0008) · `stamp_status_transition` (0010) | 7 |
| `supabase/dev/comportamento/0013_trilha.sql` | as seis funções de trilha (0008/0010, 0012, 0013) | 6 |

**Os dois são exclusivos do cluster local e não vão para o painel** — ver
"O que apagar trilha custou", adiante.

`enforce_inactivation_is_admin` entrou junto porque o próprio script a
encontrou: a primeira versão supunha que inativar não era privilégio de
administrador, reprovou, e o errado era a suposição. As três vivem na mesma
transição da mesma linha e não se medem separadas.

Fica de fora `enforce_inactivation_is_manager_or_admin` (0003): existe, mas
nenhuma tabela a aplica ainda. Não há como medir trigger que não está pendurada
em nada — o caso entra quando a primeira das três tabelas nascer.

### Duas exigências de forma que estes scripts estabelecem

**O contexto é declarado, nunca herdado.** As três barreiras são escritas
`auth.uid() is not null and ...`. No SQL Editor não há JWT: `auth.uid()` é nulo
e nenhuma delas dispara. Um script que apenas tentasse inativar veria tudo
passar — teria medido o console, não a regra. Cada caso define
`request.jwt.claim.sub`, e um caso final mede o console de propósito, para que a
porta fique escrita em vez de descoberta por acidente.

**A recusa é identificada pela mensagem, não pelo errcode.** Duas barreiras
diferentes recusam com o mesmo 42501, e as duas checagens de motivo com o mesmo
23514. Comparar só o código deixaria um caso passar pela barreira do vizinho —
que é a regra de CLAUDE.md aplicada a SQL.

### O que as mutações mediram

| Mutação | Estrutura | Comportamento |
| --- | --- | --- |
| `enforce_reactivation_is_admin` esvaziada com `if false then` | **passa** | caso 4 |
| `enforce_inactivation_is_admin` esvaziada com `if false then` | **passa** | casos 1 e 2 |
| checagem de motivo da reativação REMOVIDA | reprova | caso 5 |
| a mesma checagem envolta em `if false then` | **passa** | caso 5 |
| `write_record_status_team()` esvaziada | **passa** | caso 3 — "não gravou" |
| `write_record_status_seller()` com o `scope` do vizinho | **passa** | caso 4 |
| `write_record_status_company()` sem o motivo | **passa** | caso 5 — motivo nulo |
| barreira do cluster local num bloco `do $$` à parte | — | o script rodou inteiro |

Seis das sete primeiras são invisíveis à verificação estrutural. A última mediu
a própria barreira desta etapa, e reprovou. A terceira linha
contra a quarta é a demonstração inteira: apagar a regra deixa rastro no texto;
envolvê-la em `if false then` não deixa nenhum.

### O que apagar trilha custou

Medir esta família **produz** linhas em `crm_record_status_history`, e limpá-las
exige apagar de lá. Tecnicamente D-023 segue íntegro — a imutabilidade é contra
a aplicação, o dono do banco sempre pôde apagar, e a remoção é cirúrgica. Não é
o argumento que decide.

> A regra existe para produzir um hábito, e o hábito é o que protege quando
> ninguém está prestando atenção. No momento em que existir no repositório um
> script que apaga linhas de trilha e que foi feito para rodar no painel, ele
> vai ser rodado no painel. Não por quem o escreveu, que sabe exatamente o que
> ele faz — por alguém daqui a um ano, depurando outra coisa, que encontra o
> arquivo e o executa porque é assim que se verifica trilha neste projeto. E aí
> a remoção deixa de ser cirúrgica.

Os dois scripts saíram de `supabase/checks/` para `supabase/dev/comportamento/`,
com o motivo no cabeçalho e uma recusa em tempo de execução: exigem
`crm.cluster_local = 'sim'`, que só `reconstruir.sh` define. A localização é o
mecanismo que carrega o peso — aviso em cabeçalho só é lido por quem já está
prestando atenção.

**A recusa fica dentro do bloco que trabalha, como primeira instrução.** A
primeira tentativa a pôs num `do $$` separado antes dele, e não funcionou: o
`psql` sem `ON_ERROR_STOP` imprime o erro e segue para o bloco seguinte — o
script recusava e escrevia na trilha assim mesmo. Pior, a leitura ingênua do
resultado enganou: o banco ficou com zero linhas de trilha, que parecia prova de
recusa e era o `delete` de limpeza tendo rodado.

`0014_comportamento.sql` continua em `checks/` e continua indo para o painel:
não altera status de nada, então não gera nem apaga trilha. O recorte é
*toca `crm_record_status_history`*, não uma categoria inteira em quarentena.

É a **segunda vez nesta sprint** que um defeito fabrica a evidência que o
inocenta — a primeira foi o `Alert` pendurado, que mostrava o erro da submissão
anterior e fez com que se buscasse um log para explicar um evento que nunca
ocorreu (D-037). A família passou a ter nome em `CLAUDE.md`, ao lado da prova
por mutação, com a técnica que a desfaz: **quando sucesso e falha produzem o
mesmo estado final, procurar um efeito colateral que só um dos dois produz.**

Registrado em D-043, corrigindo a formulação inicial.

### Infraestrutura

- `reconstruir.sh --checks` passa a rodar os scripts de comportamento
  intercalados, depois da verificação da mesma migration — nunca no lugar dela.
  Varre os dois diretórios, e a diferença entre eles está escrita ali.
- `supabase/dev/01_harness_perfis.sql`: um administrador e um não-administrador
  para o cluster local, **nunca aplicado no projeto hospedado**, onde os perfis
  vêm do seed. Aplicado *lazy*, imediatamente antes do primeiro script de
  comportamento: inseri-los junto do harness mudaria a contagem de
  `0002_verificacao.sql`, e fixture que altera resultado de verificação de
  schema deixa de ser fixture.

*Aceite:* 7 casos `OK` na 0010, 6 na 0013, com o cluster reconstruído do zero; e
a tabela de mutações acima reproduzida.

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
