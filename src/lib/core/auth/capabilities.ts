import type { Capabilities } from './adapter'

export const Cap = { C: 8, R: 4, U: 2, D: 1 } as const

export function canCreate(caps: Capabilities, resource: string): boolean {
  return ((caps[resource] ?? 0) & Cap.C) !== 0
}

export function canRead(caps: Capabilities, resource: string): boolean {
  return ((caps[resource] ?? 0) & Cap.R) !== 0
}

export function canUpdate(caps: Capabilities, resource: string): boolean {
  return ((caps[resource] ?? 0) & Cap.U) !== 0
}

export function canDelete(caps: Capabilities, resource: string): boolean {
  return ((caps[resource] ?? 0) & Cap.D) !== 0
}
