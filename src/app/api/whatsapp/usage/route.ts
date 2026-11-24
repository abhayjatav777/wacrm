import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { getCurrentBillingPeriod, getMonthlyUsage } from '@/lib/whatsapp/usage-tracker'

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { searchParams } = new URL(request.url)
    const billingPeriod = searchParams.get('billing_period') || getCurrentBillingPeriod()
    let phoneNumberId = searchParams.get('phone_number_id')

    if (!phoneNumberId) {
      // Look up account's primary configured phone number id
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('phone_number_id')
        .eq('account_id', accountId)
        .maybeSingle()

      if (config?.phone_number_id) {
        phoneNumberId = config.phone_number_id
      }
    }

    if (!phoneNumberId) {
      return NextResponse.json({
        usage: {
          accountId,
          phoneNumberId: '',
          billingPeriod,
          freeAllowance: 1000,
          deliveredServiceMessages: 0,
          billableServiceMessages: 0,
          remainingFreeMessages: 1000,
          freeMessagesRemaining: 1000,
          isAllowanceExhausted: false,
          isLimitExceeded: false,
          warningTriggered: false,
        },
      })
    }

    const usage = await getMonthlyUsage(supabaseAdmin(), {
      accountId,
      phoneNumberId,
      billingPeriod,
    })

    return NextResponse.json({ usage })
  } catch (err) {
    return toErrorResponse(err)
  }
}
