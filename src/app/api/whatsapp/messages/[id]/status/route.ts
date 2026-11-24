import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { isUuid } from '@/lib/api/v1/pagination'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params
    const { supabase, accountId } = await getCurrentAccount()

    if (!isUuid(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 })
    }

    // Query messages table joining conversations to ensure account boundary
    const { data: message, error } = await supabase
      .from('messages')
      .select(`
        id,
        message_id,
        content_type,
        status,
        created_at,
        error_code,
        error_title,
        error_details,
        conversation:conversations!inner(account_id)
      `)
      .eq('id', messageId)
      .eq('conversation.account_id', accountId)
      .maybeSingle()

    if (error || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: {
        id: message.id,
        whatsapp_message_id: message.message_id,
        content_type: message.content_type,
        status: message.status,
        sent_at: message.created_at,
        error_code: message.error_code,
        error_title: message.error_title,
        error_details: message.error_details,
      },
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
