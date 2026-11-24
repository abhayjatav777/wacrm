import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import {
  sendMessageToConversation,
  resolveTargetConversation,
  SendMessageError,
  MEDIA_KINDS,
} from '@/lib/whatsapp/send-message'
import { uploadMediaToWhatsApp, type MediaKind } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    const limit = checkRateLimit(`send:${userId}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const contentType = request.headers.get('content-type') || ''
    let conversation_id: string | null = null
    let contact_id: string | null = null
    let message_type: MediaKind = 'image'
    let content_text: string | undefined = undefined
    let media_url: string | undefined = undefined
    let media_id: string | undefined = undefined
    let filename: string | undefined = undefined
    let reply_to_message_id: string | undefined = undefined

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      conversation_id = (formData.get('conversation_id') as string) || null
      contact_id = (formData.get('contact_id') as string) || null
      const kindInput = (formData.get('message_type') as string) || 'image'
      message_type = (MEDIA_KINDS.includes(kindInput as MediaKind) ? kindInput : 'image') as MediaKind
      content_text = (formData.get('caption') as string) || (formData.get('content_text') as string) || undefined
      media_url = (formData.get('media_url') as string) || undefined
      media_id = (formData.get('media_id') as string) || undefined
      filename = (formData.get('filename') as string) || undefined
      reply_to_message_id = (formData.get('reply_to_message_id') as string) || undefined

      const file = formData.get('file')
      if (file && file instanceof File) {
        filename = filename || file.name

        // Fetch WhatsApp config to upload directly to Meta /media endpoint
        const { data: config, error: configError } = await supabase
          .from('whatsapp_config')
          .select('phone_number_id, access_token')
          .eq('account_id', accountId)
          .single()

        if (configError || !config) {
          return NextResponse.json(
            { error: 'WhatsApp is not configured for this account' },
            { status: 400 }
          )
        }

        const decryptedToken = decrypt(config.access_token)
        const fileBuffer = await file.arrayBuffer()

        try {
          const uploadRes = await uploadMediaToWhatsApp({
            phoneNumberId: config.phone_number_id,
            accessToken: decryptedToken,
            file: Buffer.from(fileBuffer),
            mimeType: file.type || 'application/octet-stream',
            filename,
          })
          media_id = uploadRes.mediaId
        } catch (uploadErr) {
          console.error('[media-send] Meta upload failed:', uploadErr)
          return NextResponse.json(
            { error: uploadErr instanceof Error ? uploadErr.message : 'Failed to upload media to WhatsApp' },
            { status: 502 }
          )
        }
      }
    } else {
      const body = await request.json().catch(() => null)
      if (!body) {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
      }
      conversation_id = body.conversation_id || null
      contact_id = body.contact_id || null
      const kindInput = body.message_type || 'image'
      message_type = (MEDIA_KINDS.includes(kindInput as MediaKind) ? kindInput : 'image') as MediaKind
      content_text = body.caption || body.content_text || undefined
      media_url = body.media_url || undefined
      media_id = body.media_id || undefined
      filename = body.filename || undefined
      reply_to_message_id = body.reply_to_message_id || undefined
    }

    if (!conversation_id && !contact_id) {
      return NextResponse.json(
        { error: 'Either conversation_id or contact_id is required' },
        { status: 400 }
      )
    }

    if (!media_url && !media_id) {
      return NextResponse.json(
        { error: 'media_url, media_id, or uploaded file is required' },
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
        messageType: message_type,
        contentText: content_text,
        mediaUrl: media_url,
        mediaId: media_id,
        filename,
        replyToMessageId: reply_to_message_id,
        senderId: userId,
      })

      return NextResponse.json({
        success: true,
        message_id: result.messageId,
        whatsapp_message_id: result.whatsappMessageId,
        media_id: media_id ?? null,
      })
    } catch (err) {
      if (err instanceof SendMessageError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }
  } catch (error) {
    console.error('Error in /api/whatsapp/messages/media POST:', error)
    return toErrorResponse(error)
  }
}
