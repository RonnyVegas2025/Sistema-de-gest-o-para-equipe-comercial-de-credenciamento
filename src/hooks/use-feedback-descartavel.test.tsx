import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFeedbackDescartavel } from './use-feedback-descartavel'

type Estado = { error?: string }
const VAZIO: Estado = {}

/**
 * Reproduz o ciclo real da tela: submeter (a action devolve um objeto novo),
 * receber erro, abrir e fechar um diálogo, e conferir que a mensagem não
 * sobrevive à interação seguinte.
 */
function Tela() {
  const [state, setState] = useState<Estado>(VAZIO)
  const [visivel, descartar] = useFeedbackDescartavel(state, VAZIO)
  const [aberto, setAberto] = useState(false)

  return (
    <div>
      {/* Objeto NOVO a cada submissão, como fazem as Server Actions. */}
      <button onClick={() => setState({ error: 'recusado' })}>submeter</button>

      <button
        onClick={() => {
          descartar()
          setAberto(true)
        }}
      >
        abrir
      </button>
      <button
        onClick={() => {
          descartar()
          setAberto(false)
        }}
      >
        fechar
      </button>

      {visivel.error ? <p role="alert">{visivel.error}</p> : null}
      {aberto ? <p>diálogo aberto</p> : null}
    </div>
  )
}

describe('feedback descartável', () => {
  it('o erro aparece depois de submeter', async () => {
    const user = userEvent.setup()
    render(<Tela />)

    await user.click(screen.getByText('submeter'))

    expect(screen.getByRole('alert')).toHaveTextContent('recusado')
  })

  it('o erro NÃO sobrevive a abrir e fechar o diálogo', async () => {
    const user = userEvent.setup()
    render(<Tela />)

    await user.click(screen.getByText('submeter'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByText('abrir'))
    await user.click(screen.getByText('fechar'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('descartar não impede o erro da submissão seguinte', async () => {
    const user = userEvent.setup()
    render(<Tela />)

    await user.click(screen.getByText('submeter'))
    await user.click(screen.getByText('abrir'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Uma action que recusa de novo devolve OUTRO objeto: a mensagem volta.
    await user.click(screen.getByText('submeter'))

    expect(screen.getByRole('alert')).toHaveTextContent('recusado')
  })

  it('descartar sem nada para descartar não quebra', async () => {
    const user = userEvent.setup()
    render(<Tela />)

    await user.click(screen.getByText('abrir'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('diálogo aberto')).toBeInTheDocument()
  })
})

/**
 * A identidade de `descartar` é contrato, não detalhe.
 *
 * Sem isto, um `useCallback` que fecha sobre o estado volta a passar
 * despercebido — e o defeito que ele causa não aparece no hook, e sim em quem
 * o usa numa lista de dependências, a uma camada de distância.
 */
describe('identidade de descartar', () => {
  it('NÃO muda quando o estado muda', () => {
    const identidades: Array<() => void> = []
    function Sonda({ estado }: { estado: object }) {
      const [, descartar] = useFeedbackDescartavel(estado, {})
      identidades.push(descartar)
      return null
    }
    const { rerender } = render(<Sonda estado={{ n: 1 }} />)
    rerender(<Sonda estado={{ n: 2 }} />)
    rerender(<Sonda estado={{ n: 3 }} />)

    expect(identidades.length).toBeGreaterThanOrEqual(3)
    expect(new Set(identidades).size).toBe(1)
  })

  it('descarta o estado CORRENTE, não o da criação', () => {
    function Sonda({ estado }: { estado: object }) {
      const [visivel, descartar] = useFeedbackDescartavel(estado, {})
      return <button onClick={descartar}>{JSON.stringify(visivel)}</button>
    }
    const segundo = { n: 2 }
    const { rerender } = render(<Sonda estado={{ n: 1 }} />)
    rerender(<Sonda estado={segundo} />)
    screen.getByRole('button').click()
    rerender(<Sonda estado={segundo} />)
    expect(screen.getByRole('button').textContent).toBe('{}')
  })
})
