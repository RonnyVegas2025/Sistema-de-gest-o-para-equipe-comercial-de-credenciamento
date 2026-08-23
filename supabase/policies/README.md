# Espelhos de RLS por domínio

Cada arquivo `.sql` deste diretório reflete as policies de uma tabela.

**Nenhum deles é aplicado por si só.** As policies vão ao banco pela migration
que as cria; estes arquivos existem para o estado das policies ser legível por
domínio, sem abrir o painel nem reler migrations. A sincronia é manual.

| Arquivo | Criado por |
| --- | --- |
| `profiles.sql` | `0001_profiles.sql` |
| `teams.sql` | `0003_entity_status_teams.sql` |
| `directors.sql` | `0004_directors.sql` |
| `managers.sql` | `0005_managers.sql` |
| `sellers.sql` | `0006_sellers.sql` |

## Comportamento da RLS que a aplicação precisa respeitar

Sem policy para uma operação, a RLS **filtra** em vez de levantar erro. Um
`DELETE` devolve `DELETE 0` e um `UPDATE` de linha fora do alcance devolve
`UPDATE 0`, ambos sem exceção. Só os triggers levantam.

Quem chama não pode depender de erro para saber que a operação foi negada —
tem de conferir a contagem de linhas afetadas.
