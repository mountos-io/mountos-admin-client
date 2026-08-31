import type { Component } from 'svelte'
import BlockStorageExplainer from './BlockStorageExplainer.svelte'
import StorageTypeExplainer from './StorageTypeExplainer.svelte'
import RegionExplainer from './RegionExplainer.svelte'
import SystemExplainer from './SystemExplainer.svelte'

// Single source for the "How it works" explainers, reused by the desktop modal
// (HowItWorks.svelte) and the mobile static page (/how-it-works/[topic]).
export type ExplainerTopic = 'block-storage' | 'storage-type' | 'region' | 'system'

export const EXPLAINERS: Record<
  ExplainerTopic,
  { title: string; description: string; component: Component; fullPage?: boolean }
> = {
  system: {
    title: 'How it all fits together',
    description: 'Partners and admins drive the HUB, clients discover there once, and all data flows inside the region and its object storage.',
    component: SystemExplainer,
    // the whole-system diagram is too dense for the modal, always show the full page
    fullPage: true,
  },
  'block-storage': {
    title: 'How block storage works',
    description: "A storage's copysets form a shared pool, admin-adjustable in count. Each volume draws its own working set from that pool, so volumes can share copysets.",
    component: BlockStorageExplainer,
  },
  'storage-type': {
    title: 'Object vs block storage',
    description: 'Both use the same S3-compatible object store. Block hides it behind a caching facade.',
    component: StorageTypeExplainer,
  },
  region: {
    title: 'HUB, region, and clusters',
    description: "The global HUB answers discovery. A region owns its database and vault. Clusters partition the region's volume load.",
    component: RegionExplainer,
  },
}

export function isExplainerTopic(t: string): t is ExplainerTopic {
  return t in EXPLAINERS
}

export const explainerHref = (t: ExplainerTopic) => `/how-it-works/${t}`
