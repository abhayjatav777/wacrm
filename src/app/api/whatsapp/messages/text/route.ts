import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import {
  sendMessageToConversation,
  resolveTargetConversation,
  SendMessageError,
} from '@/lib/whatsapp/send-message'

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    const limit = checkRateLimit(`send:${userId}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const {
      conversation_id,
      contact_id,
      content_text,
      reply_to_message_id,
    } = body

    if ((!conversation_id && !contact_id) || !content_text || typeof content_text !== 'string' || !content_text.trim()) {
      return NextResponse.json(
        { error: 'conversation_id or contact_id and non-empty content_text are required' },
        { status: 400 }
      )
    }

    let conversationId: string
    try {
      conversationId = await resolveTargetConversation(supabase, accountId, userId, {
        conversationId: conversation_id,
        contactId: contact_id,
      })
    } catch (err) {
      if (err instanceof SendMessageError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }

    try {
      const result = await sendMessageToConversation(supabase, accountId, {
        conversationId,
        messageType: 'text',
        contentText: content_text.trim(),
        replyToMessageId: reply_to_message_id,
        senderId: userId,
      })

      return NextResponse.json({
        success: true,
        message_id: result.messageId,
        whatsapp_message_id: result.whatsappMessageId,
      })
    } catch (err) {
      if (err instanceof SendMessageError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }
  } catch (error) {
    console.error('Error in /api/whatsapp/messages/text POST:', error)
    return toErrorResponse(error)
  }
}
