export interface ActivePoll {
  start(): void
  stop(): void
}

const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined'

function isActive() {
  return hasDom && !document.hidden && document.hasFocus()
}

function safeTick(tick: () => void | Promise<void>) {
  try {
    const r = tick()
    if (r && typeof (r as Promise<void>).catch === 'function') {
      (r as Promise<void>).catch(() => {})
    }
  } catch {}
}

export function createActivePoll(tick: () => void | Promise<void>, intervalMs: number): ActivePoll {
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false
  let lastTickAt = 0

  function fire() {
    lastTickAt = Date.now()
    safeTick(tick)
  }

  function arm(skipIfRecent = false) {
    if (timer || !isActive()) return
    if (!skipIfRecent || Date.now() - lastTickAt >= intervalMs / 2) fire()
    timer = setInterval(fire, intervalMs)
  }

  function disarm() {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  function onChange() {
    if (!running) return
    if (isActive()) arm(true)
    else disarm()
  }

  return {
    start() {
      if (running) return
      running = true
      if (hasDom) {
        document.addEventListener('visibilitychange', onChange)
        window.addEventListener('focus', onChange)
        window.addEventListener('blur', onChange)
        arm()
      }
    },
    stop() {
      running = false
      disarm()
      if (hasDom) {
        document.removeEventListener('visibilitychange', onChange)
        window.removeEventListener('focus', onChange)
        window.removeEventListener('blur', onChange)
      }
    },
  }
}
