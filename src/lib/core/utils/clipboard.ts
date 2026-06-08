// Robust clipboard copy returning whether the text was written.
//
// The async Clipboard API rejects with "Document is not focused" when called
// during a dialog's focus transition (e.g. a copy button in a just-opened
// modal), which would silently leave the previous clipboard value. Fall back to
// a synchronous textarea copy so the first click is reliable.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through to the synchronous path */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
