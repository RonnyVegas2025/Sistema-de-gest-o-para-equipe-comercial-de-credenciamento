import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CurrencyInput } from './currency-input'

describe('CurrencyInput', () => {
  it('digitação acumula centavos e produz o número correto', () => {
    const onValueChange = vi.fn()
    render(
      <CurrencyInput
        value={null}
        onValueChange={onValueChange}
        aria-label="valor"
      />,
    )
    fireEvent.change(screen.getByLabelText('valor'), {
      target: { value: '12345' },
    })
    expect(onValueChange).toHaveBeenCalledWith(123.45)
  })

  it('campo vazio vira null', () => {
    const onValueChange = vi.fn()
    render(
      <CurrencyInput
        value={10}
        onValueChange={onValueChange}
        aria-label="valor"
      />,
    )
    fireEvent.change(screen.getByLabelText('valor'), { target: { value: '' } })
    expect(onValueChange).toHaveBeenCalledWith(null)
  })

  it('exibe o valor formatado em pt-BR', () => {
    render(
      <CurrencyInput
        value={1234.5}
        onValueChange={() => {}}
        aria-label="valor"
      />,
    )
    expect(screen.getByLabelText('valor')).toHaveValue('1.234,50')
  })
})
