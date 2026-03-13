let token: string | null = null

export function setStepUpToken(t: string) { token = t }

export function getStepUpHeaders(): Record<string, string> {
  if (!token) return {}
  const t = token
  token = null
  return { 'X-StepUp-Token': t }
}
