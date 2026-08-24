'use client'

import { useCallback, useState } from 'react'

/**
 * Torna descartável o retorno de um `useFormState`.
 *
 * **O problema que isto resolve.** `useFormState` guarda o último estado
 * devolvido pela action e não oferece reset: uma vez que o estado vira erro, a
 * mensagem fica na tela até uma nova submissão *daquela mesma action* —
 * atravessando `revalidatePath`, re-render e qualquer outra interação do
 * usuário.
 *
 * Isso não é só ruído visual. **É evidência falsa:** quem vê a tela associa a
 * mensagem à última coisa que fez, e pode não ter relação nenhuma. Custou uma
 * rodada inteira de investigação num bug da tela de usuários — o relato "cliquei
 * em X e recebi Y" deixou de ser confiável, porque Y podia ser de antes.
 *
 * **Como funciona.** O estado descartado é guardado por *identidade de
 * referência*. As Server Actions deste projeto constroem um objeto novo a cada
 * retorno, então uma submissão seguinte nunca é `Object.is`-igual à descartada e
 * volta a aparecer. Uma action que devolvesse literalmente o mesmo objeto duas
 * vezes ficaria escondida na segunda — se isso passar a acontecer, o retorno
 * precisa de um identificador próprio, não de outra comparação.
 *
 * `descartar` é chamado nos pontos em que o usuário começa outra interação:
 * abrir e fechar diálogo, confirmar, cancelar. A regra é uma só — feedback
 * pertence à interação que o produziu, e a interação seguinte o encerra.
 */
export function useFeedbackDescartavel<S>(
  state: S,
  vazio: S,
): readonly [S, () => void] {
  const [descartado, setDescartado] = useState<S | null>(null)

  const visivel = Object.is(state, descartado) ? vazio : state
  const descartar = useCallback(() => setDescartado(state), [state])

  return [visivel, descartar] as const
}
