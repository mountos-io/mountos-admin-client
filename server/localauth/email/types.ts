export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>
}

// One factory per provider file under ./providers/<name>.ts. `from` is the
// provider-agnostic EMAIL_FROM value; each provider reads its own
// EMAIL_<PROVIDER>_* env vars for anything else it needs.
export type EmailProviderFactory = (from: string) => EmailSender
