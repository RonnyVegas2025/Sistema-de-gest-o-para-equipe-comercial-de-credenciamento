import { z } from 'zod'

/** Login: e-mail válido e senha não vazia. */
export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof loginSchema>

/** Recuperação: apenas o e-mail. */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

/** Nova senha: mínimo de 8 caracteres e confirmação igual. */
export const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
    confirm: z.string().min(1, 'Confirme a senha'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'As senhas não conferem',
    path: ['confirm'],
  })
export type NewPasswordInput = z.infer<typeof newPasswordSchema>
