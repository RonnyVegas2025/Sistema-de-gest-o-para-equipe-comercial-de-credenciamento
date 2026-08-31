'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  Select,
} from '@/components/ui'
import { useFeedbackDescartavel } from '@/hooks/use-feedback-descartavel'
import { cadastrarComercio } from '@/lib/comercios/actions'
import type { ComercioState } from '@/lib/comercios/actions'

export type OrigemOpcao = {
  id: string
  match_key: string
  name: string
  requires_client_company: boolean
}

const VAZIO: ComercioState = {}

export function NovoComercioDialog({
  aberto,
  onFechar,
  origens,
}: {
  aberto: boolean
  onFechar: () => void
  origens: OrigemOpcao[]
}) {
  const [estado, acao] = useFormState(cadastrarComercio, VAZIO)
  // Feedback pertence à interação que o produziu (D-037). Sem isto, a mensagem
  // de um envio anterior reaparece ao abrir o diálogo de novo — e já custou uma
  // rodada de investigação num bug que não existia.
  const [visivel, descartar] = useFeedbackDescartavel(estado, VAZIO)
  const [origemId, setOrigemId] = useState('')

  const origem = origens.find((o) => o.id === origemId)
  // A flag vem do CATÁLOGO, nunca de comparação com literal. `match_key ===
  // 'EMPRESA_CLIENTE'` quebraria num rename e não cobriria uma segunda origem
  // com o mesmo comportamento (D-011, D-042).
  const exigeEmpresa = origem?.requires_client_company ?? false

  useEffect(() => {
    if (!aberto) return
    descartar()
    setOrigemId('')
    // `descartar` é estável por `useCallback`; o efeito roda ao abrir.
  }, [aberto, descartar])

  const campos =
    'ok' in visivel && visivel.ok === false ? visivel.campos : undefined

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Novo comércio"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={onFechar}
          >
            Cancelar
          </Button>
          <Enviar />
        </div>
      }
    >
      <form
        id="form-novo-comercio"
        action={acao}
        className="flex flex-col gap-4"
      >
        {'ok' in visivel && visivel.ok === false ? (
          <Alert variant="danger">{visivel.error}</Alert>
        ) : null}

        <div>
          <Label htmlFor="razaoSocial">Razão social</Label>
          <Input
            id="razaoSocial"
            name="razaoSocial"
            required
            className="min-h-11"
          />
          <FieldError>{campos?.razaoSocial}</FieldError>
        </div>

        <div>
          <Label htmlFor="nomeFantasia">Nome fantasia</Label>
          <Input id="nomeFantasia" name="nomeFantasia" className="min-h-11" />
        </div>

        <div>
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            name="cnpj"
            inputMode="numeric"
            required
            className="min-h-11"
          />
          <FieldError>{campos?.cnpj}</FieldError>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="municipio">Município</Label>
            <Input id="municipio" name="municipio" className="min-h-11" />
          </div>
          <div>
            <Label htmlFor="uf">UF</Label>
            <Input id="uf" name="uf" maxLength={2} className="min-h-11" />
          </div>
        </div>

        <div>
          <Label htmlFor="origemId">Origem da demanda</Label>
          <Select
            id="origemId"
            name="origemId"
            required
            value={origemId}
            onChange={(e) => setOrigemId(e.target.value)}
            className="min-h-11"
            options={[
              { value: '', label: 'Selecione a origem' },
              ...origens.map((o) => ({ value: o.id, label: o.name })),
            ]}
          />
          <FieldError>{campos?.origemId}</FieldError>
        </div>

        {/* O servidor NÃO confia neste campo: ele revalida contra o catálogo, e
            a trigger da 0014 recusa nos dois sentidos de qualquer jeito. Aqui
            ele existe para o formulário mostrar o campo certo. */}
        <input
          type="hidden"
          name="origemExigeEmpresa"
          value={exigeEmpresa ? 'true' : 'false'}
        />

        {exigeEmpresa ? (
          <div>
            <Label htmlFor="empresaDemandanteId">
              Empresa cliente demandante
            </Label>
            <Input
              id="empresaDemandanteId"
              name="empresaDemandanteId"
              placeholder="Identificador da empresa cliente"
              className="min-h-11"
            />
            <FieldError>{campos?.empresaDemandanteId}</FieldError>
          </div>
        ) : null}

        <div>
          <Label htmlFor="responsavelId">Consultor responsável</Label>
          <Input
            id="responsavelId"
            name="responsavelId"
            placeholder="Identificador do consultor"
            className="min-h-11"
          />
          <FieldError>{campos?.responsavelId}</FieldError>
        </div>
      </form>
    </Modal>
  )
}

function Enviar() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      form="form-novo-comercio"
      disabled={pending}
      className="min-h-11"
    >
      {pending ? 'Cadastrando…' : 'Cadastrar'}
    </Button>
  )
}
