# Cluster local de teste

Onde cada migration é aplicada, testada e **provada por mutação** antes de ir
para o SQL Editor do painel.

```bash
supabase/dev/reconstruir.sh              # reconstrói do zero e aplica tudo
supabase/dev/reconstruir.sh --checks     # idem, verificando cada etapa
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

Estado esperado hoje: **11 migrations, 255 checagens, todas OK.**
