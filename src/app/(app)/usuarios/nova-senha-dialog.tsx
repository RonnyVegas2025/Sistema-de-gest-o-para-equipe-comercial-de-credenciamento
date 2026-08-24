'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Alert, Button, Modal } from '@/components/ui'

/**
 * Exibe a senha temporária UMA vez, em diálogo próprio.
 *
 * Por que não `toast`: o toast persiste no DOM enquanto visível e sai da
 * atenção do usuário sozinho — a senha ficaria na tela sem ninguém olhando, e
 * sumiria sem ninguém copiar. Por que não numa coluna da tabela: ali ela
 * sobreviveria à navegação e apareceria em qualquer print da lista.
 *
 * Fechar é definitivo: a senha não é relida do servidor, e o caminho para uma
 * nova é "Gerar nova senha", que grava trilha própria. O aviso abaixo diz isso
 * antes de o usuário fechar, não depois.
 */
export function NovaSenhaDialog({
  senha,
  email,
  onClose,
}: {
  senha: string
  email: string
  onClose: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Clipboard bloqueado (contexto não seguro, permissão negada). A senha
      // está visível e selecionável na tela — o caminho manual continua aberto,
      // e um erro aqui só tiraria a atenção dela.
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Senha temporária"
      footer={<Button onClick={onClose}>Já anotei, fechar</Button>}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-secondary">
          Senha de primeiro acesso de{' '}
          <strong className="text-ink">{email}</strong>.
        </p>

        <div className="flex items-center gap-2">
          <code className="vg-numeric flex-1 select-all break-all rounded border border-line bg-surface-muted px-3 py-2 text-sm text-ink">
            {senha}
          </code>
          <Button
            variant="secondary"
            onClick={copiar}
            icon={
              copiado ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )
            }
            aria-label="Copiar senha"
          >
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
        </div>

        <Alert variant="warning" title="Aparece uma única vez">
          Ao fechar, esta senha não pode ser consultada de novo — nem por
          administrador. Se ela se perder, use <strong>Gerar nova senha</strong>
          , que substitui a anterior.
        </Alert>

        <p className="text-sm text-ink-secondary">
          No primeiro acesso o sistema exige a troca desta senha antes de
          liberar qualquer tela.
        </p>
      </div>
    </Modal>
  )
}
