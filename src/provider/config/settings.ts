import type { Component } from 'svelte'

export interface ProviderSettingsTab {
  id: string
  label: string
  icon: Component
  component: Component
}

export const providerSettingsTabs: ProviderSettingsTab[] = []
export const providerSettingsModalSize: { maxWidth?: string; height?: string } | undefined = undefined
