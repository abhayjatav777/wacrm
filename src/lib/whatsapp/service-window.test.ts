import { describe, expect, it } from 'vitest';
import { calculateServiceWindow } from './service-window';

describe('whatsapp/service-window', () => {
  describe('calculateServiceWindow', () => {
    it('returns closed when last customer message is null', () => {
      const res = calculateServiceWindow(null);
      expect(res.isOpen).toBe(false);
      expect(res.remainingSeconds).toBe(0);
      expect(res.formattedRemaining).toBe('No customer messages yet');
      expect(res.expiresAt).toBeNull();
    });

    it('returns open with proper countdown for a message received 2 hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const res = calculateServiceWindow(twoHoursAgo);

      expect(res.isOpen).toBe(true);
      expect(res.remainingSeconds).toBeGreaterThan(21 * 3600);
      expect(res.remainingSeconds).toBeLessThanOrEqual(22 * 3600);
      expect(res.formattedRemaining).toMatch(/\d+h \d+m remaining/);
      expect(res.expiresAt).toBeTruthy();
    });

    it('returns closed for a message received 25 hours ago', () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const res = calculateServiceWindow(twentyFiveHoursAgo);

      expect(res.isOpen).toBe(false);
      expect(res.remainingSeconds).toBe(0);
      expect(res.formattedRemaining).toBe('Expired');
    });

    it('returns closed for an invalid date string', () => {
      const res = calculateServiceWindow('invalid-date');
      expect(res.isOpen).toBe(false);
      expect(res.remainingSeconds).toBe(0);
      expect(res.formattedRemaining).toBe('Invalid timestamp');
    });
  });
});
