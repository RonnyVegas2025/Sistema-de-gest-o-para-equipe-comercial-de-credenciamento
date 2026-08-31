'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { CircleAlert, Plus, Search, Store, UserMinus } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FilterBar,
  Input,
  Label,
  Pagination,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { formatarCnpj } from '@/services/cnpj/normalizar'
import type {
  ComercioLinha,
  ContadoresComercios,
} from '@/lib/comercios/queries'
import { NovoComercioDialog, type OrigemOpcao } from './novo-comercio-dialog'

const POR_PAGINA = 25

type Props = {
  contadores: ContadoresComercios
  linhas: ComercioLinha[]
  totalFiltrado: number
  origens: OrigemOpcao[]
  filtros: { busca?: string; apenasSemOrigem: boolean; pagina: number }
  podeCadastrar: boolean
}

/**
 * ===========================================================================
 * O CONTADOR NÃO É FILTRO, E ESTA É A REGRA QUE O SUSTENTA
 *
 * Os números vêm do servidor calculados sobre o escopo INTEIRO, sem nenhum
 * filtro da tela (D-042, decisão 6). Clicar num contador aplica o filtro
 * correspondente — mas o número **não muda**, porque ele não depende do que a
 * tela está mostrando.
 *
 * É essa propriedade que separa monitoramento de filtro. Exceção que só aparece
 * quando alguém lembra de procurar não é exceção monitorada.
 *
 * E zero é exibido como zero. Contador que some no zero ensina que a ausência
 * dele significa "não medido" — e aí a próxima ausência, que é real, passa.
 * ===========================================================================
 */
export function ComerciosClient({
  contadores,
  linhas,
  totalFiltrado,
  origens,
  filtros,
  podeCadastrar,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [busca, setBusca] = useState(filtros.busca ?? '')
  const [dialogAberto, setDialogAberto] = useState(false)

  const navegar = useCallback(
    (mudancas: Record<string, string | null>) => {
      const q = new URLSearchParams(params.toString())
      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor === null || valor === '') q.delete(chave)
        else q.set(chave, valor)
      }
      // Qualquer mudança de filtro volta para a primeira página: manter a
      // página anterior mostraria vazio num conjunto que tem resultados.
      if (!('pagina' in mudancas)) q.delete('pagina')
      router.push(`/comercios?${q.toString()}`)
    },
    [params, router],
  )

  const paginas = Math.max(1, Math.ceil(totalFiltrado / POR_PAGINA))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Contador
          icone={<Store className="h-5 w-5" />}
          rotulo="Comércios no seu escopo"
          valor={contadores.total}
        />
        <Contador
          icone={<CircleAlert className="h-5 w-5" />}
          rotulo="Sem origem registrada"
          valor={contadores.semOrigem}
          destaque={contadores.semOrigem > 0}
          ativo={filtros.apenasSemOrigem}
          onClick={() =>
            navegar({ sem_origem: filtros.apenasSemOrigem ? null : '1' })
          }
        />
        {/*
          Ausente — e não zero — para quem não distribui. Ver
          `ContadorSemResponsavel`: para um consultor essas linhas são
          invisíveis pela RLS, e exibir "0" afirmaria que não existe nenhuma.
        */}
        {contadores.semResponsavel.seAplica ? (
          <Contador
            icone={<UserMinus className="h-5 w-5" />}
            rotulo="Sem responsável atribuído"
            valor={contadores.semResponsavel.valor}
            destaque={contadores.semResponsavel.valor > 0}
          />
        ) : null}
      </div>

      <FilterBar
        actions={
          podeCadastrar ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => setDialogAberto(true)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Novo comércio
            </Button>
          ) : null
        }
      >
        <form
          className="flex flex-1 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            navegar({ busca: busca.trim() || null })
          }}
        >
          <div className="flex-1">
            <Label htmlFor="busca">
              Buscar por razão social, fantasia ou CNPJ
            </Label>
            <Input
              id="busca"
              name="busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: Padaria do Bairro"
              className="min-h-11"
            />
          </div>
          <Button type="submit" variant="secondary" className="min-h-11">
            <Search className="h-4 w-4" aria-hidden />
            Buscar
          </Button>
        </form>
      </FilterBar>

      <Card className="p-0">
        {linhas.length === 0 ? (
          <EmptyState
            className="p-8"
            icon={<Store className="h-6 w-6" />}
            title={
              filtros.busca || filtros.apenasSemOrigem
                ? 'Nenhum comércio para este filtro'
                : 'Nenhum comércio cadastrado ainda'
            }
            description={
              filtros.busca || filtros.apenasSemOrigem
                ? 'Ajuste a busca ou limpe o filtro de exceção para ver a lista completa.'
                : 'Cadastre o primeiro comércio ou importe uma planilha.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Comércio</TH>
                  <TH>CNPJ</TH>
                  <TH>Praça</TH>
                  <TH>Responsável</TH>
                  <TH>Origem</TH>
                </TR>
              </THead>
              <TBody>
                {linhas.map((l) => (
                  <TR key={l.relationshipId}>
                    <TD>
                      <span className="font-medium">{l.razaoSocial}</span>
                      {l.nomeFantasia ? (
                        <span className="text-caption text-fg-muted block">
                          {l.nomeFantasia}
                        </span>
                      ) : null}
                    </TD>
                    <TD>{l.cnpj ? formatarCnpj(l.cnpj) : '—'}</TD>
                    <TD>
                      {l.municipio
                        ? `${l.municipio}${l.uf ? `/${l.uf}` : ''}`
                        : '—'}
                    </TD>
                    <TD>{l.responsavelNome ?? 'Sem responsável'}</TD>
                    <TD>
                      {l.temOrigem ? (
                        <Badge variant="success">Registrada</Badge>
                      ) : (
                        <Badge variant="warning">Sem origem</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      {paginas > 1 ? (
        <Pagination
          page={filtros.pagina}
          pageCount={paginas}
          onPageChange={(p) => navegar({ pagina: String(p) })}
        />
      ) : null}

      <NovoComercioDialog
        aberto={dialogAberto}
        onFechar={() => setDialogAberto(false)}
        origens={origens}
      />
    </div>
  )
}

function Contador({
  icone,
  rotulo,
  valor,
  destaque = false,
  ativo = false,
  onClick,
}: {
  icone: React.ReactNode
  rotulo: string
  valor: number
  destaque?: boolean
  ativo?: boolean
  onClick?: () => void
}) {
  const conteudo = (
    <>
      <span className="text-caption text-fg-muted flex items-center gap-2">
        {icone}
        {rotulo}
      </span>
      <span
        className={
          destaque
            ? 'text-h1 font-display text-state-warning-fg'
            : 'text-h1 font-display'
        }
      >
        {valor}
      </span>
    </>
  )

  if (!onClick) {
    return <Card className="flex flex-col gap-1">{conteudo}</Card>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={
        ativo
          ? 'flex min-h-11 flex-col gap-1 rounded-lg border-2 border-brand-500 bg-surface p-4 text-left shadow-card'
          : 'flex min-h-11 flex-col gap-1 rounded-lg border border-line bg-surface p-4 text-left shadow-card'
      }
    >
      {conteudo}
    </button>
  )
}
