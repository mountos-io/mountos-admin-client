// ServiceNode.Status -> a 3-bucket health signal for at-a-glance node indicators
// (NodeGrid). Deliberately not the same mapping as nodeStatusVariant (format.ts), which
// gives "registered" its own primary/blue variant for the node list/detail pages. Here,
// anything short of a confirmed "healthy" or a confirmed "unhealthy" is uncertain/
// transitional and reads as the same amber signal, per the real server-side domain
// ("healthy" | "unhealthy" | "registered" | "draining" | "unknown").
export type NodeHealthVariant = 'success' | 'warning' | 'destructive'

const NODE_HEALTH_VARIANT: Record<string, NodeHealthVariant> = {
  healthy: 'success',
  unhealthy: 'destructive',
}

export function nodeHealthVariant(status: string): NodeHealthVariant {
  return NODE_HEALTH_VARIANT[status] ?? 'warning'
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

export function nodeHealthLabel(status: string): string {
  if (status === 'healthy') return 'Healthy'
  if (status === 'unhealthy') return 'Unhealthy'
  if (!status) return 'Unknown'
  return `${capitalize(status)} (uncertain)`
}

// Worst-of aggregate across a member's serving blockserv (normally exactly one; more than
// one is the defensive duplicate-registration case ServersList already flags). No
// servers at all reads as uncertain, not a clean pass.
export function worstNodeHealthVariant(variants: NodeHealthVariant[]): NodeHealthVariant {
  if (variants.length === 0) return 'warning'
  if (variants.includes('destructive')) return 'destructive'
  if (variants.includes('warning')) return 'warning'
  return 'success'
}
