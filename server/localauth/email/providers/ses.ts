import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import type { EmailProviderFactory, EmailMessage } from '../types'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

// AWS creds come from the SDK's standard resolution chain (env, shared config,
// instance/task role) — no mountOS-specific credential env vars.
export const createSesEmailSender: EmailProviderFactory = (from) => {
  const region = requireEnv('EMAIL_SES_REGION')
  const client = new SESv2Client({ region })

  return {
    async send(message: EmailMessage): Promise<void> {
      await client.send(new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: message.html, Charset: 'UTF-8' },
              Text: { Data: message.text, Charset: 'UTF-8' },
            },
          },
        },
      }))
    },
  }
}
