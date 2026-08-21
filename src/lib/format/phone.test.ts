import { describe, expect, it } from 'vitest'
import { formatPhone, isValidPhone, phoneDigits } from './phone'

describe('phone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(formatPhone('11987654321', 'celular')).toBe('(11) 98765-4321')
  })

  it('formata fixo com 10 dígitos', () => {
    expect(formatPhone('1133224455', 'fixo')).toBe('(11) 3322-4455')
  })

  it('formata parcial durante a digitação', () => {
    expect(formatPhone('119', 'celular')).toBe('(11) 9')
    expect(formatPhone('', 'celular')).toBe('')
  })

  it('descarta caracteres não numéricos e excesso', () => {
    expect(phoneDigits('(11) 98765-4321x', 'celular')).toBe('11987654321')
    expect(phoneDigits('119876543210000', 'celular')).toBe('11987654321')
    expect(phoneDigits('11332244556', 'fixo')).toBe('1133224455')
  })

  it('valida quantidade de dígitos por tipo', () => {
    expect(isValidPhone('11987654321', 'celular')).toBe(true)
    expect(isValidPhone('1198765432', 'celular')).toBe(false) // 10, faltou 1
    expect(isValidPhone('1133224455', 'fixo')).toBe(true)
    expect(isValidPhone('11332244', 'fixo')).toBe(false)
  })
})
