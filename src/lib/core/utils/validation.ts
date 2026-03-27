const usernameRe = /^[a-zA-Z0-9_-]{3,16}$/

export function isUsernameValid(username: string): boolean {
  return usernameRe.test(username)
}

export function usernameErrorMessage(username: string): string {
  if (!username) return ''
  if (/\s/.test(username)) return 'Spaces not allowed'
  if (/[^a-zA-Z0-9_-]/.test(username)) return 'Only letters, digits, hyphen and underscore'
  if (username.length < 3) return 'At least 3 characters'
  if (username.length > 16) return 'At most 16 characters'
  return ''
}
