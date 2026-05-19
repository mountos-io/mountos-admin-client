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

// Cluster name rules mirror region name rules: lowercase letters/digits/hyphens,
// must start with a letter, min 2 chars. Kept here so create and rename flows
// share one source of truth.
const clusterNameRe = /^[a-z][a-z0-9-]+$/

export function isClusterNameValid(name: string): boolean {
  return clusterNameRe.test(name)
}

export function clusterNameErrorMessage(name: string): string {
  if (!name) return ''
  if (/[A-Z]/.test(name)) return 'Lowercase only'
  if (/\s/.test(name)) return 'Spaces not allowed'
  if (!/^[a-z]/.test(name)) return 'Must start with a letter'
  if (/[^a-z0-9-]/.test(name)) return 'Only lowercase letters, digits and hyphens'
  if (name.length < 2) return 'At least 2 characters'
  return ''
}

// Fork name rules — must match S3 bucket naming since forks back S3 buckets.
const FORK_NAME_MIN = 3
const FORK_NAME_MAX = 63
const FORK_NAME_RESERVED = new Set(['main', 'auto'])
const forkNameCharRe = /^[a-z0-9.\-]+$/
const forkNameIpRe = /^\d+\.\d+\.\d+\.\d+$/

function isLowerAlnum(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
}

export function forkNameErrorMessage(name: string): string {
  if (!name) return ''
  if (name.length < FORK_NAME_MIN) return `At least ${FORK_NAME_MIN} characters`
  if (name.length > FORK_NAME_MAX) return `At most ${FORK_NAME_MAX} characters`
  if (!forkNameCharRe.test(name)) return 'Only lowercase letters, digits, periods, and hyphens'
  if (!isLowerAlnum(name[0]) || !isLowerAlnum(name[name.length - 1])) {
    return 'Must begin and end with a letter or digit'
  }
  if (name.includes('..')) return 'Adjacent periods not allowed'
  if (forkNameIpRe.test(name)) return 'Must not look like an IP address'
  if (FORK_NAME_RESERVED.has(name.toLowerCase())) return `"${name}" is a reserved name`
  return ''
}

export function isForkNameValid(name: string): boolean {
  // forkNameErrorMessage suppresses errors for empty input (form UX);
  // require non-empty here so callers that only need a boolean don't
  // accept the empty string.
  return !!name && forkNameErrorMessage(name) === ''
}

// Mirrors Go SanitizeForkName: lowercase, strip invalid chars,
// collapse adjacent dots/hyphens, trim non-alnum edges, truncate.
// Does not enforce reserved-name or IP-shape rules — validate after.
export function sanitizeForkName(name: string, maxLen = FORK_NAME_MAX): string {
  let out = ''
  let prev = ''
  for (let i = 0; i < name.length; i++) {
    let c = name[i]
    if (c >= 'A' && c <= 'Z') c = c.toLowerCase()
    if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
      out += c
      prev = c
      continue
    }
    if (c === '_' || c === ' ') c = '-'
    if (c === '.' || c === '-') {
      if (prev !== '.' && prev !== '-' && out.length > 0) {
        out += c
        prev = c
      }
    }
  }
  while (out.length > 0 && !isLowerAlnum(out[0])) out = out.slice(1)
  while (out.length > 0 && !isLowerAlnum(out[out.length - 1])) out = out.slice(0, -1)
  if (out.length > maxLen) {
    out = out.slice(0, maxLen)
    while (out.length > 0 && !isLowerAlnum(out[out.length - 1])) out = out.slice(0, -1)
  }
  return out
}
