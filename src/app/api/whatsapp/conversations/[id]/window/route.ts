import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { getConversationServiceWindow } from '@/lib/whatsapp/service-window'
import { isUuid } from '@/lib/api/v1/pagination'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const { accountId } = await getCurrentAccount()

    if (!isUuid(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
    }

    const windowInfo = await getConversationServiceWindow(
      supabaseAdmin(),
      {
        accountId,
        conversationId,
      }
    )

    if (!windowInfo) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ window: windowInfo })
  } catch (err) {
    return toErrorResponse(err)
  }
}
