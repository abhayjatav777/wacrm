import { describe, expect, it } from 'vitest';
import { getCurrentBillingPeriod, FREE_SERVICE_MESSAGES_MONTHLY_LIMIT } from './usage-tracker';

describe('whatsapp/usage-tracker', () => {
  it('formats current billing period as YYYY-MM', () => {
    const period = getCurrentBillingPeriod();
    expect(period).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it('has a default monthly free allowance of 1000', () => {
    expect(FREE_SERVICE_MESSAGES_MONTHLY_LIMIT).toBe(1000);
  });
});
