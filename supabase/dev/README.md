# Cluster local de teste

Onde cada migration é aplicada, testada e **provada por mutação** antes de ir
para o SQL Editor do painel.

```bash
supabase/dev/reconstruir.sh              # reconstrói do zero e aplica tudo
supabase/dev/reconstruir.sh --checks     # idem, verificando cada etapa
                                         # (verificação + comportamento)
supabase/dev/reconstruir.sh --ate 0009   # para depois da 0009
```

Depois: `PGHOST=/tmp PGPORT=5599 PGUSER=postgres psql -d crm`

## Por que existe

As migrations são aplicadas colando no SQL Editor (D-031): o banco não conhece
o histórico e não há `db push` para reproduzir. Sem um cluster local, "o script
de verificação confere que o recorte está lá" seria intenção declarada — e
*conferir* é verbo de execução.

Foi assim que apareceram os cinco erros de expectativa nos scripts da Sprint 1:
rodando, não relendo.

**O cluster já morreu uma vez** com a reciclagem do ambiente, e reconstruí-lo à
mão custou uma etapa. Por isso o script é versionado.

## O script é, ele próprio, uma verificação

Se a sequência não reconstrói o schema do zero, alguma migration depende de
estado que não está no repositório — e o repositório é a única fonte da ordem
aplicada (D-031). Isso é achado, não inconveniente.

Provado por mutação, três caminhos:

| Mutação | Resultado |
| --- | --- |
| migration que não aplica | `FALHOU em … — a sequência não reconstrói do zero`, saída 1 |
| migration sem script de verificação | `SEM script de verificação para 0012`, saída 1 |
| policy derrubada na migration | a verificação da etapa acusa e o script sai 1 |

## `00_harness_auth.sql` — o que o Supabase provê

`auth.users`, `auth.uid()`, `auth.role()` e os papéis `anon`, `authenticated`,
`service_role`. **Nunca é aplicado no projeto hospedado** — lá tudo isso já
existe.

Só o que as migrations realmente tocam. Espelho grande esconde dependência nova:
se uma migration futura passar a depender de outra coluna de `auth.users`, é
melhor que a reconstrução quebre e alguém acrescente conscientemente.

## Os scripts de verificação são afirmações de MOMENTO

**Rodá-los todos no fim reprova cinco deles, e não é defeito** — ver D-038.

Além de conferir o que a migration criou, vários afirmam o que ainda **não**
deve existir: *"nenhuma coluna a mais que o modelo"*, *"`source_ref` ainda não
existe"*, *"`current_manager_id` ainda sem FK"*. São verdadeiras logo depois da
própria migration e falsas depois que a seguinte roda.

Por isso `--checks` roda cada verificação **intercalada**, logo após a sua
migration — que é como são usadas de verdade: aplicar, verificar, seguir.

## Comportamento é um segundo nível, com script separado

`*_verificacao.sql` lê o catálogo do Postgres e é **cego para o corpo da
função**. Quatro scripts casam texto no corpo, o que pega a remoção descuidada —
não pega a regra desligada. Medido sobre a `stamp_status_transition` já
aplicada: apagar a checagem de motivo reprova; envolvê-la em `if false then`,
com o texto intacto, passa com tudo OK.

`*_comportamento.sql` fecha essa lacuna: **escreve, mede e limpa**. Roda depois
da verificação da mesma migration, nunca no lugar dela (D-043).

| Script | Cobre | Casos | Painel? |
| --- | --- | --- | --- |
| `supabase/dev/comportamento/0010_status.sql` | barreiras de inativação, reativação e motivo | 7 | **não** |
| `supabase/dev/comportamento/0013_trilha.sql` | as seis funções de trilha | 6 | **não** |
| `supabase/checks/0014_comportamento.sql` | forma da demanda por origem | 6 | sim |

### Os dois primeiros não saem daqui

Medir a família de status **produz** linhas em `crm_record_status_history`, e
limpá-las exige apagar de lá. Que o dono do banco sempre pôde fazer isso não é o
argumento: a regra de D-023 existe para produzir um hábito, e um script pronto
que apaga trilha acaba sendo rodado no painel um dia — por alguém depurando
outra coisa, que o executa porque é assim que se verifica trilha neste projeto.

Três mecanismos, do mais fraco ao mais forte:

| Onde | O quê |
| --- | --- |
| localização | `supabase/dev/comportamento/`, fora de `checks/` |
| cabeçalho | o motivo escrito no arquivo |
| recusa | exigem `crm.cluster_local = 'sim'`, que só este script define |

A localização é o que carrega o peso — aviso em cabeçalho só é lido por quem já
está prestando atenção.

A recusa fica **dentro** do bloco que trabalha, como primeira instrução. Medido:
num `do $$` separado antes dele, o `psql` sem `ON_ERROR_STOP` imprime o erro e
segue — o script recusava e escrevia na trilha assim mesmo (D-043).

`0014_comportamento.sql` continua em `checks/` e continua indo para o painel:
não altera status de nada, então não gera nem apaga trilha.

### `01_harness_perfis.sql`

Um administrador e um não-administrador, para que os casos possam simular o JWT
de cada um. **Nunca é aplicado no projeto hospedado** — lá os perfis vêm do seed
da estrutura comercial.

Aplicado *lazy*, imediatamente antes do primeiro script de comportamento.
Inseri-los junto do harness mudaria a contagem que `0002_verificacao.sql` faz
sobre a tabela — e fixture que altera resultado de verificação de schema deixa
de ser fixture.

Estado esperado hoje: **14 migrations, 410 checagens estruturais e 19 casos de
comportamento, todos OK.**
