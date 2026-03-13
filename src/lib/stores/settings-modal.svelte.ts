export type SettingsTab = 'appearance' | 'preferences' | 'shortcuts' | 'security' | (string & {})

let open = $state(false)
let tab = $state<SettingsTab>('appearance')

export function useSettingsModal() {
  return {
    get open() { return open },
    set open(v: boolean) { open = v },
    get tab() { return tab },
    set tab(v: SettingsTab) { tab = v },
    show(t: SettingsTab = 'appearance') { tab = t; open = true },
    close() { open = false },
  }
}
