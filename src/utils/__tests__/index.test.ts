import { describe, it, expect, vi } from 'vitest'
import { generateId, formatDate } from '../index'

describe('Utility Functions', () => {
  describe('generateId', () => {
    it('should generate a unique string ID', () => {
      const id1 = generateId()
      const id2 = generateId()
      
      expect(typeof id1).toBe('string')
      expect(typeof id2).toBe('string')
      expect(id1).not.toBe(id2)
      expect(id1.length).toBeGreaterThan(0)
      expect(id2.length).toBeGreaterThan(0)
    })

    it('should generate IDs with consistent format', () => {
      const id = generateId()
      
      // Should contain alphanumeric characters
      expect(id).toMatch(/^[a-z0-9]+$/)
    })

    it('should generate different IDs on subsequent calls', () => {
      const ids = new Set()
      
      // Generate multiple IDs and ensure they're unique
      for (let i = 0; i < 100; i++) {
        ids.add(generateId())
      }
      
      expect(ids.size).toBe(100)
    })
  })

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const testDate = new Date('2024-01-15T14:30:00')
      const formatted = formatDate(testDate)
      
      expect(formatted).toMatch(/Jan 15, 2024/)
      expect(formatted).toMatch(/2:30 PM/)
    })

    it('should handle different dates', () => {
      const testCases = [
        new Date('2023-12-25T09:15:00'),
        new Date('2024-06-01T23:45:00'),
        new Date('2024-02-29T12:00:00') // Leap year
      ]
      
      testCases.forEach(date => {
        const formatted = formatDate(date)
        expect(typeof formatted).toBe('string')
        expect(formatted.length).toBeGreaterThan(0)
        
        // Should contain month, day, year, and time
        expect(formatted).toMatch(/\w+ \d{1,2}, \d{4}/)
        expect(formatted).toMatch(/\d{1,2}:\d{2} [AP]M/)
      })
    })

    it('should use en-US locale format', () => {
      const testDate = new Date('2024-03-10T16:20:00')
      const formatted = formatDate(testDate)
      
      // Should use US format (Mar instead of March, AM/PM instead of 24h)
      expect(formatted).toMatch(/Mar 10, 2024/)
      expect(formatted).toMatch(/4:20 PM/)
    })

    it('should handle edge cases', () => {
      // Test with current date
      const now = new Date()
      const formatted = formatDate(now)
      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
      
      // Test with very old date
      const oldDate = new Date('1900-01-01T00:00:00')
      const formattedOld = formatDate(oldDate)
      expect(formattedOld).toMatch(/Jan 1, 1900/)
      expect(formattedOld).toMatch(/12:00 AM/)
      
      // Test with future date
      const futureDate = new Date('2030-12-31T23:59:00')
      const formattedFuture = formatDate(futureDate)
      expect(formattedFuture).toMatch(/Dec 31, 2030/)
      expect(formattedFuture).toMatch(/11:59 PM/)
    })

    it('should be consistent across multiple calls with same date', () => {
      const testDate = new Date('2024-07-04T12:00:00')
      const formatted1 = formatDate(testDate)
      const formatted2 = formatDate(testDate)
      
      expect(formatted1).toBe(formatted2)
    })
  })
})