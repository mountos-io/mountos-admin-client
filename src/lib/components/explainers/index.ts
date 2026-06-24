import type { Component } from 'svelte'
import BlockStorageExplainer from './BlockStorageExplainer.svelte'
import StorageTypeExplainer from './StorageTypeExplainer.svelte'
import RegionExplainer from './RegionExplainer.svelte'

// Single source for the "How it works" explainers, reused by the desktop modal
// (HowItWorks.svelte) and the mobile static page (/how-it-works/[topic]).
export type ExplainerTopic = 'block-storage' | 'storage-type' | 'region'

export const EXPLAINERS: Record<ExplainerTopic, { title: string; description: string; component: Component }> = {
  'block-storage': {
    title: 'How block storage works',
    description: 'A block storage is up to three active-active members, each a blockserv node with its own block volume, for high availability.',
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
