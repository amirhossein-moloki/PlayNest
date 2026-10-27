import { describe, it, expect } from 'vitest'
import { ALL_ARTICLE_BLOCKS, EmbedBlock, MapBlock } from '../blocks/index.js'
import { EventsCollection } from '../collections/Events.js'
import { ArticlesCollection } from '../collections/Articles.js'
import { collectHeadings } from '../components/ArticleRenderer.js'

describe('PlayNest Article Content Builder Unit Tests', () => {
  describe('Block Definitions Schema & Registration', () => {
    it('should define exactly 24 blocks in ALL_ARTICLE_BLOCKS', () => {
      expect(ALL_ARTICLE_BLOCKS).toHaveLength(24)
    })

    it('should ensure all block slugs are unique and follow camelCase block naming', () => {
      const slugs = ALL_ARTICLE_BLOCKS.map((b) => b.slug)
      const uniqueSlugs = new Set(slugs)
      expect(uniqueSlugs.size).toBe(24)
      for (const slug of slugs) {
        expect(slug).toMatch(/Block$/)
      }
    })

    it('should configure ArticlesCollection content editor with ALL_ARTICLE_BLOCKS', () => {
      const contentField = ArticlesCollection.fields.find((f: any) => f.name === 'content') as any
      expect(contentField).toBeDefined()
      expect(contentField.type).toBe('richText')
      expect(contentField.editor).toBeDefined()
    })
  })

  describe('EventsCollection Configuration & Validation', () => {
    it('should define events collection slug and required fields', () => {
      expect(EventsCollection.slug).toBe('events')
      const titleField = EventsCollection.fields.find((f: any) => f.name === 'title') as any
      expect(titleField.required).toBe(true)
      const slugField = EventsCollection.fields.find((f: any) => f.name === 'slug') as any
      expect(slugField.unique).toBe(true)
    })

    it('read access control should restrict anonymous users to published events', () => {
      const readAccess = EventsCollection.access?.read as any
      expect(readAccess({ req: { user: { id: 'admin' } } })).toBe(true)
      expect(readAccess({ req: { user: null } })).toEqual({
        status: { equals: 'published' },
      })
    })

    it('should validate startDateTime and endDateTime range', () => {
      const endDateField = EventsCollection.fields.find((f: any) => f.name === 'endDateTime') as any
      expect(endDateField.validate).toBeDefined()

      const validResult = endDateField.validate('2026-06-02T12:00:00Z', {
        siblingData: { startDateTime: '2026-06-01T12:00:00Z' },
      })
      expect(validResult).toBe(true)

      const invalidResult = endDateField.validate('2026-05-30T12:00:00Z', {
        siblingData: { startDateTime: '2026-06-01T12:00:00Z' },
      })
      expect(invalidResult).toBe('End date and time cannot be earlier than start date and time.')
    })

    it('should validate latitude and longitude ranges', () => {
      const latField = EventsCollection.fields.find((f: any) => f.name === 'latitude') as any
      const lonField = EventsCollection.fields.find((f: any) => f.name === 'longitude') as any

      expect(latField.validate(35.6892)).toBe(true)
      expect(latField.validate(100)).toBe('Latitude must be a valid number between -90 and 90.')

      expect(lonField.validate(51.389)).toBe(true)
      expect(lonField.validate(-200)).toBe('Longitude must be a valid number between -180 and 180.')
    })

    it('should validate registration URLs', () => {
      const urlField = EventsCollection.fields.find((f: any) => f.name === 'registrationUrl') as any
      expect(urlField.validate('https://playenest.com/register')).toBe(true)
      expect(urlField.validate('ftp://invalid-url')).toBe('Registration URL must use http or https protocol.')
      expect(urlField.validate('not-a-url')).toBe('Registration URL must be a valid URL.')
    })
  })

  describe('Block Specific Field Validations', () => {
    it('MapBlock should validate latitude and longitude bounds', () => {
      const latField = MapBlock.fields.find((f: any) => f.name === 'latitude') as any
      const lonField = MapBlock.fields.find((f: any) => f.name === 'longitude') as any

      expect(latField.validate(35.7)).toBe(true)
      expect(latField.validate(-95)).toBe('Latitude must be between -90 and 90')

      expect(lonField.validate(51.4)).toBe(true)
      expect(lonField.validate(190)).toBe('Longitude must be between -180 and 180')
    })

    it('EmbedBlock should enforce provider allowlist and validate URLs', () => {
      const urlField = EmbedBlock.fields.find((f: any) => f.name === 'url') as any

      expect(
        urlField.validate('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
          siblingData: { provider: 'youtube' },
        })
      ).toBe(true)

      expect(
        urlField.validate('https://vimeo.com/12345678', {
          siblingData: { provider: 'vimeo' },
        })
      ).toBe(true)

      expect(
        urlField.validate('https://vimeo.com/12345678', {
          siblingData: { provider: 'youtube' },
        })
      ).toBe('Invalid YouTube URL')

      expect(
        urlField.validate('not-a-valid-url', {
          siblingData: { provider: 'youtube' },
        })
      ).toBe('Invalid URL format')
    })
  })

  describe('Table of Contents Heading Extraction', () => {
    it('should extract H2, H3, H4 headings and generate stable unique IDs', () => {
      const mockChildren = [
        { type: 'heading', tag: 'h2', children: [{ text: 'Introduction' }] },
        { type: 'paragraph', children: [{ text: 'Some body paragraph' }] },
        { type: 'heading', tag: 'h3', children: [{ text: 'Venue Overview' }] },
        { type: 'heading', tag: 'h2', children: [{ text: 'Introduction' }] },
      ]

      const headings = collectHeadings(mockChildren)
      expect(headings).toHaveLength(3)
      expect(headings[0]).toEqual({ id: 'introduction', text: 'Introduction', level: 'h2' })
      expect(headings[1]).toEqual({ id: 'venue-overview', text: 'Venue Overview', level: 'h3' })
      expect(headings[2]).toEqual({ id: 'introduction-1', text: 'Introduction', level: 'h2' })
    })
  })
})
