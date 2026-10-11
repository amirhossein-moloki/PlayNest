import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VenueProfilesCollection } from '../collections/VenueProfiles.js'
import { ArticlesCollection } from '../collections/Articles.js'
import { CityLandingPagesCollection } from '../collections/CityLandingPages.js'

describe('Payload CMS Collections & Sayra Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('VenueProfilesCollection', () => {
    it('should have correct slug and required sayraVenueId field', () => {
      expect(VenueProfilesCollection.slug).toBe('venue-profiles')
      const sayraField = VenueProfilesCollection.fields.find(
        (f: any) => f.name === 'sayraVenueId'
      ) as any
      expect(sayraField).toBeDefined()
      expect(sayraField.type).toBe('text')
      expect(sayraField.required).toBe(true)
      expect(sayraField.unique).toBe(true)
    })

    it('beforeValidate hook should pass for valid Sayra venue ID', async () => {
      const hooks = VenueProfilesCollection.hooks?.beforeValidate
      expect(hooks).toBeDefined()
      expect(hooks?.length).toBeGreaterThan(0)

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'cuid_123', name: 'Test Venue' }),
      } as Response)

      const hook = hooks![0]!
      const data = { sayraVenueId: 'cuid_123', editorialTitle: 'Test Title' }
      const result = await hook({ data } as any)
      expect(result).toEqual(data)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/gamingCenters/cuid_123'),
        expect.anything()
      )
    })

    it('beforeValidate hook should throw error when Sayra returns 404', async () => {
      const hooks = VenueProfilesCollection.hooks?.beforeValidate
      const hook = hooks![0]!

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)

      const data = { sayraVenueId: 'invalid_cuid' }
      await expect(hook({ data } as any)).rejects.toThrow(
        "Invalid Sayra Venue ID: Gaming center 'invalid_cuid' does not exist in Sayra."
      )
    })

    it('beforeValidate hook should gracefully log warning on network failure without throwing', async () => {
      const hooks = VenueProfilesCollection.hooks?.beforeValidate
      const hook = hooks![0]!

      global.fetch = vi.fn().mockRejectedValue(new Error('Connection timed out'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const data = { sayraVenueId: 'cuid_123' }
      const result = await hook({ data } as any)
      expect(result).toEqual(data)
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('ArticlesCollection', () => {
    it('should configure published status read access rule correctly', () => {
      expect(ArticlesCollection.slug).toBe('articles')
      const readAccess = ArticlesCollection.access?.read as any
      expect(readAccess).toBeDefined()

      // When user is logged in
      expect(readAccess({ req: { user: { id: 'admin1' } } })).toBe(true)

      // When anonymous
      expect(readAccess({ req: { user: null } })).toEqual({
        status: { equals: 'published' },
      })
    })
  })

  describe('CityLandingPagesCollection', () => {
    it('should configure citySlug as unique required text field', () => {
      expect(CityLandingPagesCollection.slug).toBe('city-landing-pages')
      const citySlugField = CityLandingPagesCollection.fields.find(
        (f: any) => f.name === 'citySlug'
      ) as any
      expect(citySlugField).toBeDefined()
      expect(citySlugField.required).toBe(true)
      expect(citySlugField.unique).toBe(true)
    })
  })
})
