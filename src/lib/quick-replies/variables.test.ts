import { describe, expect, it } from 'vitest';
import { interpolateVariables, extractVariableNames } from './variables';

describe('quick-replies/variables', () => {
  describe('extractVariableNames', () => {
    it('extracts unique variable names from template text', () => {
      const text = 'Hello {{name}}, welcome to {{company}}! Please call {{phone}} or reply {{name}}.';
      expect(extractVariableNames(text)).toEqual(['name', 'company', 'phone']);
    });

    it('returns empty array if no variables', () => {
      expect(extractVariableNames('Hello world!')).toEqual([]);
      expect(extractVariableNames('')).toEqual([]);
    });
  });

  describe('interpolateVariables', () => {
    it('replaces standard contact variables', () => {
      const template = 'Hello {{name}}, your company {{company}} and phone {{phone}} are registered.';
      const result = interpolateVariables(template, {
        name: 'Alice',
        company: 'FallInTech',
        phone: '+1234567890',
      });
      expect(result).toBe('Hello Alice, your company FallInTech and phone +1234567890 are registered.');
    });

    it('handles case-insensitive variable names', () => {
      const template = 'Hi {{NAME}}, welcome to {{Company}}!';
      const result = interpolateVariables(template, {
        name: 'Bob',
        company: 'Acme Corp',
      });
      expect(result).toBe('Hi Bob, welcome to Acme Corp!');
    });

    it('preserves unsupplied variables by default and supports custom fallbacks', () => {
      const template = 'Hello {{name}} from {{company}}!';
      const result = interpolateVariables(template, { name: 'Charlie' });
      expect(result).toBe('Hello Charlie from {{company}}!');

      const withEmptyFallback = interpolateVariables(template, { name: 'Charlie' }, '');
      expect(withEmptyFallback).toBe('Hello Charlie from !');

      const withCustomFallback = interpolateVariables(template, { name: 'Charlie' }, '[N/A]');
      expect(withCustomFallback).toBe('Hello Charlie from [N/A]!');
    });

    it('handles empty or blank templates safely', () => {
      expect(interpolateVariables('', { name: 'Test' })).toBe('');
    });
  });
});
