import type { EmailProviderFactory, EmailSender } from './types'

// One entry per provider folder. Adding a provider = a new file under
// ./providers/<name>.ts plus one line here — no other call site changes.
const PROVIDERS: Record<string, () => Promise<{ default: EmailProviderFactory }>> = {
  ses: () => import('./providers/ses').then((m) => ({ default: m.createSesEmailSender })),
}

let sender: EmailSender | undefined

export async function initEmailSender(provider: string, from: string): Promise<EmailSender> {
  const load = PROVIDERS[provider]
  if (!load) throw new Error(`Unknown EMAIL_PROVIDER: ${provider} (known: ${Object.keys(PROVIDERS).join(', ')})`)
  const { default: factory } = await load()
  sender = factory(from)
  return sender
}

function emailSender(): EmailSender {
  if (!sender) throw new Error('email sender not initialized')
  return sender
}

export async function sendInviteEmail(to: string, name: string, acceptUrl: string): Promise<void> {
  await emailSender().send({
    to,
    subject: 'You’re invited to mountOS Dashboard',
    text: `Hi ${name},\n\nYou’ve been invited to mountOS Dashboard. Set up your account:\n${acceptUrl}\n\nThis link expires in 7 days.`,
    html: `<p>Hi ${name},</p><p>You’ve been invited to mountOS Dashboard. Set up your account:</p><p><a href="${acceptUrl}">${acceptUrl}</a></p><p>This link expires in 7 days.</p>`,
  })
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  await emailSender().send({
    to,
    subject: 'Reset your mountOS Dashboard password',
    text: `Hi ${name},\n\nReset your password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn’t request this, ignore this email.`,
    html: `<p>Hi ${name},</p><p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you didn’t request this, ignore this email.</p>`,
  })
}
