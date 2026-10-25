// Shared by the browser and the server. Keep this module free of server-only imports.
export const ROLE = {
  superadmin: 'superadmin',
  l1admin: 'l1admin',
  l2admin: 'l2admin',
  user: 'user',
} as const
export type Role = typeof ROLE[keyof typeof ROLE]

// user is the only role that hub understands, rest of them are admins
export const isAdmin = (role: string): boolean => role !== ROLE.user
