import type { Component } from 'svelte'

export interface VendorSettingsTab {
  id: string
  label: string
  icon: Component
  component: Component
}

export const vendorSettingsTabs: VendorSettingsTab[] = []
export const vendorSettingsModalSize: { maxWidth?: string; minHeight?: string } | undefined = undefined
