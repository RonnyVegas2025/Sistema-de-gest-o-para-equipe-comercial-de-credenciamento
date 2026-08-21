'use client'

import { useState } from 'react'
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  CurrencyInput,
  DateInput,
  EmptyState,
  FieldError,
  FilterBar,
  FormField,
  Input,
  Label,
  Modal,
  Pagination,
  PasswordInput,
  PercentInput,
  PhoneInput,
  Select,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Tooltip,
  ToastProvider,
  TR,
  Textarea,
  useToast,
  type BadgeVariant,
} from '@/components/ui'

const BADGES: BadgeVariant[] = [
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
  'rose',
  'peach',
]

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card title={title}>
      <div className="flex flex-wrap items-end gap-4">{children}</div>
    </Card>
  )
}

function Showcase() {
  const { notify } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [amount, setAmount] = useState<number | null>(1234.5)
  const [percent, setPercent] = useState<number | null>(12.5)
  const [page, setPage] = useState(1)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <Breadcrumb
          items={[
            { label: 'Dev', href: '/dev/componentes' },
            { label: 'Componentes' },
          ]}
        />
        <h1 className="mt-2 font-display text-2xl text-ink">
          Catálogo de componentes
        </h1>
        <p className="text-sm text-ink-secondary">
          Ferramenta de desenvolvimento. Não existe em produção.
        </p>
      </div>

      <Section title="Botões">
        <Button>Primário</Button>
        <Button variant="secondary">Secundário</Button>
        <Button variant="ghost">Discreto</Button>
        <Button variant="destructive">Destrutivo</Button>
        <Button loading>Carregando</Button>
        <Button disabled>Desabilitado</Button>
      </Section>

      <Section title="Badges">
        {BADGES.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </Section>

      <Section title="Campos">
        <FormField id="cat-nome" label="Nome" hint="Como aparece na listagem">
          <Input placeholder="Razão social" />
        </FormField>
        <FormField
          id="cat-email"
          label="E-mail"
          error="E-mail inválido"
          required
        >
          <Input defaultValue="invalido" />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-senha">Senha</Label>
          <PasswordInput id="cat-senha" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-uf">UF</Label>
          <Select
            id="cat-uf"
            placeholder="Selecione"
            options={[
              { value: 'sp', label: 'São Paulo' },
              { value: 'rj', label: 'Rio de Janeiro' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-valor">Valor</Label>
          <CurrencyInput
            id="cat-valor"
            value={amount}
            onValueChange={setAmount}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-margem">Margem</Label>
          <PercentInput
            id="cat-margem"
            value={percent}
            onValueChange={setPercent}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-data">Data</Label>
          <DateInput id="cat-data" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-cel-vazio">Celular (vazio)</Label>
          <PhoneInput id="cat-cel-vazio" variant="celular" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-cel">Celular (preenchido)</Label>
          <PhoneInput
            id="cat-cel"
            variant="celular"
            defaultValue="11987654321"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-fixo">Fixo (preenchido)</Label>
          <PhoneInput id="cat-fixo" variant="fixo" defaultValue="1133224455" />
        </div>
        <FormField
          id="cat-cel-erro"
          label="Celular (erro de máscara)"
          error="Celular deve ter 11 dígitos"
        >
          <PhoneInput variant="celular" defaultValue="1198765" />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-cel-off">Celular (desabilitado)</Label>
          <PhoneInput
            id="cat-cel-off"
            variant="celular"
            defaultValue="11987654321"
            disabled
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-obs">Observações</Label>
          <Textarea id="cat-obs" />
        </div>
        <Checkbox label="Ativo" defaultChecked />
        <FieldError>Exemplo de mensagem de erro isolada</FieldError>
      </Section>

      <Section title="Filtros e chips">
        <FilterBar actions={<Button size="sm">Aplicar</Button>}>
          <Input placeholder="Buscar" className="max-w-xs" />
          <Chip onRemove={() => notify('Filtro removido')}>UF: SP</Chip>
        </FilterBar>
      </Section>

      <Card title="Tabela">
        <Table>
          <THead>
            <TR>
              <TH>Empresa</TH>
              <TH numeric>Contratos</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD>Alfa Ltda</TD>
              <TD numeric>12</TD>
            </TR>
            <TR>
              <TD>Beta S.A.</TD>
              <TD numeric>3</TD>
            </TR>
          </TBody>
        </Table>
        <div className="mt-4">
          <Pagination page={page} pageCount={5} onPageChange={setPage} />
        </div>
      </Card>

      <Section title="Feedback">
        <Alert variant="info" title="Informação">
          Alerta informativo.
        </Alert>
        <Alert variant="danger" title="Erro">
          Algo falhou.
        </Alert>
        <Button onClick={() => notify('Salvo com sucesso', 'success')}>
          Disparar toast
        </Button>
        <Tooltip label="Texto de ajuda">
          <Button variant="secondary">Com tooltip</Button>
        </Tooltip>
      </Section>

      <Section title="Estados">
        <Skeleton className="h-4 w-40" />
        <EmptyState
          title="Nada por aqui"
          description="Quando houver dados, eles aparecem nesta área."
        />
      </Section>

      <Section title="Sobreposições">
        <Button onClick={() => setModalOpen(true)}>Abrir modal</Button>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          Confirmar ação
        </Button>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Exemplo de modal"
        footer={<Button onClick={() => setModalOpen(false)}>Fechar</Button>}
      >
        <p className="text-sm text-ink-secondary">
          Foco preso, fechamento por Esc e retorno de foco ao gatilho.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Cancelar contrato?"
        description="Esta ação exige motivo e não pode ser desfeita."
        confirmLabel="Cancelar contrato"
        confirmVariant="destructive"
        onConfirm={() => {
          setConfirmOpen(false)
          notify('Contrato cancelado', 'warning')
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export function Catalog() {
  return (
    <ToastProvider>
      <Showcase />
    </ToastProvider>
  )
}
