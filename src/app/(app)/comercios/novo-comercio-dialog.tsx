'use client'

import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  Select,
} from '@/components/ui'

export type OrigemOpcao = {
  id: string
  match_key: string
  name: string
  requires_client_company: boolean
}

/**
 * ===========================================================================
 * ESTE DIÁLOGO NÃO POSSUI O ESTADO DO ENVIO — a página possui.
 *
 * A primeira versão tinha o `useFormState` aqui, e o retorno da action só era
 * exibido dentro do modal. Consequência: fechado o modal, o resultado do que o
 * usuário mandou some com ele. **Não saber se salvou é pior que uma mensagem
 * errada** — o usuário tenta de novo, e a segunda tentativa bate no índice
 * único de CNPJ, recebendo erro de duplicidade sobre um registro que ele mesmo
 * acabou de criar.
 *
 * Com o estado na página, o retorno sobrevive ao fechamento. A mensagem geral
 * aparece **nos dois lugares** de propósito: com o modal aberto, o aviso da
 * página fica atrás dele, e um erro que o usuário não vê é o mesmo que erro
 * nenhum.
 *
 * E o diálogo é montado sob demanda (`{aberto && <NovoComercioDialog/>}`), o
 * que dispensa qualquer efeito de reset: cada abertura começa com estado novo.
 * Foi um efeito de reset que causou o defeito de 31/08/2026.
 * ===========================================================================
 */
export function NovoComercioDialog({
  onFechar,
  origens,
  acao,
  erro,
  campos,
}: {
  onFechar: () => void
  origens: OrigemOpcao[]
  acao: (formData: FormData) => void
  erro?: string
  campos?: Record<string, string>
}) {
  const [origemId, setOrigemId] = useState('')

  const origem = origens.find((o) => o.id === origemId)
  // A flag vem do CATÁLOGO, nunca de comparação com literal. `match_key ===
  // 'EMPRESA_CLIENTE'` quebraria num rename e não cobriria uma segunda origem
  // com o mesmo comportamento (D-011, D-042).
  const exigeEmpresa = origem?.requires_client_company ?? false

  return (
    <Modal
      open
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
        {erro ? <Alert variant="danger">{erro}</Alert> : null}

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
