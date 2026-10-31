import { describe, it, expect } from 'vitest'
import { UsersCollection } from '../collections/Users.js'

describe('UsersCollection access control', () => {
  it('should restrict delete to platform-admin or isSuperuser', () => {
    const deleteAccess = UsersCollection.access?.delete as any
    expect(deleteAccess).toBeDefined()

    expect(deleteAccess({ req: { user: { role: 'platform-admin' } } })).toBe(true)
    expect(deleteAccess({ req: { user: { isSuperuser: true } } })).toBe(true)
    expect(deleteAccess({ req: { user: { role: 'editor' } } })).toBe(false)
    expect(deleteAccess({ req: { user: null } })).toBe(false)
  })

  it('should restrict create to platform-admin or isSuperuser', () => {
    const createAccess = UsersCollection.access?.create as any
    expect(createAccess).toBeDefined()

    expect(createAccess({ req: { user: { role: 'platform-admin' } } })).toBe(true)
    expect(createAccess({ req: { user: { isSuperuser: true } } })).toBe(true)
    expect(createAccess({ req: { user: { role: 'editor' } } })).toBe(false)
  })
})
