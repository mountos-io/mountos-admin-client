export interface ConfirmState {
  open: boolean
  title: string
  desc: string
  variant: 'default' | 'destructive'
  confirmLabel: string
  action: () => Promise<void>
}

const INITIAL: ConfirmState = { open: false, title: '', desc: '', variant: 'default', confirmLabel: 'Confirm', action: async () => {} }

export function useConfirmDialog(afterAction?: () => void) {
  let state = $state<ConfirmState>({ ...INITIAL })

  function confirm(title: string, desc: string, action: () => Promise<void>, variant: 'default' | 'destructive' = 'default', confirmLabel = 'Confirm') {
    state = {
      open: true, title, desc, variant, confirmLabel,
      action: async () => { await action(); afterAction?.() },
    }
  }

  return {
    get open() { return state.open },
    set open(v: boolean) { state.open = v },
    get title() { return state.title },
    get desc() { return state.desc },
    get variant() { return state.variant },
    get confirmLabel() { return state.confirmLabel },
    get action() { return state.action },
    confirm,
  }
}
