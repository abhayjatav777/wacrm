import type { SupabaseClient } from '@supabase/supabase-js';

export interface MonthlyUsageReport {
  billingPeriod: string;
  phoneNumberId: string;
  freeAllowance: number;
  deliveredServiceMessages: number;
  billableServiceMessages: number;
  remainingFreeMessages: number;
  isAllowanceExhausted: boolean;
  history?: Array<{
    period: string;
    delivered: number;
    billable: number;
  }>;
}

export const FREE_SERVICE_MESSAGES_MONTHLY_LIMIT = 1000;

export function getCurrentBillingPeriod(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Fetch monthly usage for a WhatsApp business phone number.
 */
export async function getMonthlyUsage(
  supabase: SupabaseClient,
  params: {
    accountId: string;
    phoneNumberId?: string;
    billingPeriod?: string;
  }
): Promise<MonthlyUsageReport> {
  const { accountId } = params;
  let phoneNumberId = params.phoneNumberId;

  if (!phoneNumberId) {
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id')
      .eq('account_id', accountId)
      .maybeSingle();

    phoneNumberId = config?.phone_number_id ?? 'unknown';
  }

  const currentPeriod = params.billingPeriod || getCurrentBillingPeriod();

  // Load current period row
  const { data: row } = await supabase
    .from('whatsapp_message_usage')
    .select('*')
    .eq('account_id', accountId)
    .eq('phone_number_id', phoneNumberId)
    .eq('billing_period', currentPeriod)
    .maybeSingle();

  const freeAllowance = row?.free_allowance ?? 1000;
  const delivered = row?.delivered_service_messages ?? 0;
  const billable = row?.billable_service_messages ?? 0;
  const remaining = Math.max(0, freeAllowance - delivered);

  // Load historical usage
  const { data: historyRows } = await supabase
    .from('whatsapp_message_usage')
    .select('billing_period, delivered_service_messages, billable_service_messages')
    .eq('account_id', accountId)
    .eq('phone_number_id', phoneNumberId)
    .order('billing_period', { ascending: false })
    .limit(6);

  const history = (historyRows ?? []).map((h) => ({
    period: h.billing_period,
    delivered: h.delivered_service_messages,
    billable: h.billable_service_messages,
  }));

  return {
    billingPeriod: currentPeriod,
    phoneNumberId: phoneNumberId || 'unknown',
    freeAllowance,
    deliveredServiceMessages: delivered,
    billableServiceMessages: billable,
    remainingFreeMessages: remaining,
    isAllowanceExhausted: remaining === 0,
    history,
  };
}

/**
 * Record a service message send / delivery. If usage exceeds 1,000, increments billable_service_messages.
 */
export async function recordDeliveredServiceMessage(
  supabaseAdmin: SupabaseClient,
  params: {
    accountId: string;
    phoneNumberId: string;
  }
): Promise<{ isBillable: boolean; currentRemaining: number }> {
  const { accountId, phoneNumberId } = params;
  const period = getCurrentBillingPeriod();

  try {
    const table = supabaseAdmin.from('whatsapp_message_usage');
    if (!table || typeof table.select !== 'function') {
      return { isBillable: false, currentRemaining: 1000 };
    }

    // Fetch or insert
    const { data: existing } = await table
      .select('*')
      .eq('account_id', accountId)
      .eq('phone_number_id', phoneNumberId)
      .eq('billing_period', period)
      .maybeSingle();

    const freeAllowance = existing?.free_allowance ?? 1000;
    let delivered = existing?.delivered_service_messages ?? 0;
    let billable = existing?.billable_service_messages ?? 0;

    let isBillable = false;
    if (delivered < freeAllowance) {
      delivered += 1;
    } else {
      billable += 1;
      isBillable = true;
    }

    if (typeof table.upsert === 'function') {
      await table.upsert(
        {
          account_id: accountId,
          phone_number_id: phoneNumberId,
          billing_period: period,
          free_allowance: freeAllowance,
          delivered_service_messages: delivered,
          billable_service_messages: billable,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,phone_number_id,billing_period' }
      );
    }

    return {
      isBillable,
      currentRemaining: Math.max(0, freeAllowance - delivered),
    };
  } catch {
    return { isBillable: false, currentRemaining: 1000 };
  }
}
