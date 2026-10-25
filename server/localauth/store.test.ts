import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { PortalStore } from './store'

const fakePool = (rows: unknown[] = []) => {
  const query = vi.fn(async () => ({ rows }))
  return { pool: { query } as unknown as Pool, query }
}

describe('PortalStore.findById', () => {
  it('answers a non-uuid subject without querying', async () => {
    const { pool, query } = fakePool()
    const store = new PortalStore(pool)

    await expect(store.findById('user_1')).resolves.toBeNull()
    expect(query).not.toHaveBeenCalled()
  })

  it('queries a uuid subject', async () => {
    const { pool, query } = fakePool()
    const store = new PortalStore(pool)
    const id = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c'

    await expect(store.findById(id)).resolves.toBeNull()
    expect(query).toHaveBeenCalledWith('SELECT * FROM portal_users WHERE id = $1', [id])
  })
})
