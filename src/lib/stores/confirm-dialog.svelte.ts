export interface ConfirmState {
  open: boolean
  title: string
  desc: string
  action: () => Promise<void>
}

const INITIAL: ConfirmState = { open: false, title: '', desc: '', action: async () => {} }

export function useConfirmDialog(afterAction?: () => void) {
  let state = $state<ConfirmState>({ ...INITIAL })

  function confirm(title: string, desc: string, action: () => Promise<void>) {
    state = {
      open: true, title, desc,
      action: async () => { await action(); afterAction?.() },
    }
  }

  return {
    get open() { return state.open },
    set open(v: boolean) { state.open = v },
    get title() { return state.title },
    get desc() { return state.desc },
    get action() { return state.action },
    confirm,
  }
}
