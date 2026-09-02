export class ApiError extends Error {
  readonly status: number
  readonly errorCode?: number

  constructor(message: string, status: number, errorCode?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
  }
}

// Statuses the node live-stats proxy returns when it could not reach the node process:
// 502 for a dial failure (the process is not listening, whether it just restarted or is
// gone for good) and 404 for a node whose registry row is already deactivated or removed.
// The proxy cannot tell "briefly restarting" from "terminated after its copyset retired",
// so this is corroborating evidence, not proof; pair it with the node's own status/isActive
// field where that is available.
export function isNodeUnreachableError(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 502 || e.status === 404)
}
