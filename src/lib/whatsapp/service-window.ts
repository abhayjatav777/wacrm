import type { SupabaseClient } from '@supabase/supabase-js';
import { SendMessageError } from './send-message';

export interface ServiceWindowStatus {
  isOpen: boolean;
  expiresAt: string | null;
  remainingSeconds: number;
  formattedRemaining: string;
  lastCustomerMessageAt: string | null;
}

/**
 * Pure calculation of the 24-hour customer service window based on UTC timestamps.
 */
export function calculateServiceWindow(
  lastCustomerMessageAt?: string | Date | null
): ServiceWindowStatus {
  if (!lastCustomerMessageAt) {
    return {
      isOpen: false,
      expiresAt: null,
      remainingSeconds: 0,
      formattedRemaining: 'No customer messages yet',
      lastCustomerMessageAt: null,
    };
  }

  const lastAt = new Date(lastCustomerMessageAt).getTime();
  if (isNaN(lastAt)) {
    return {
      isOpen: false,
      expiresAt: null,
      remainingSeconds: 0,
      formattedRemaining: 'Invalid timestamp',
      lastCustomerMessageAt: null,
    };
  }

  const expiresAt = new Date(lastAt + 24 * 60 * 60 * 1000);
  const now = Date.now();
  const diffMs = expiresAt.getTime() - now;
  const remainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const isOpen = remainingSeconds > 0;

  let formattedRemaining = 'Expired';
  if (isOpen) {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    if (hours > 0) {
      formattedRemaining = `${hours}h ${minutes}m remaining`;
    } else {
      formattedRemaining = `${minutes}m remaining`;
    }
  }

  return {
    isOpen,
    expiresAt: expiresAt.toISOString(),
    remainingSeconds,
    formattedRemaining,
    lastCustomerMessageAt: new Date(lastAt).toISOString(),
  };
}

/**
 * Fetch and return the server-authoritative customer service window for a contact/conversation.
 */
export async function getConversationServiceWindow(
  supabase: SupabaseClient,
  params: {
    accountId: string;
    contactId?: string;
    conversationId?: string;
  }
): Promise<ServiceWindowStatus> {
  const { accountId, contactId, conversationId } = params;

  let resolvedContactId = contactId;

  // Resolve contactId from conversation if not directly provided
  if (!resolvedContactId && conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (conv?.contact_id) {
      resolvedContactId = conv.contact_id;
    }
  }

  if (!resolvedContactId) {
    return calculateServiceWindow(null);
  }

  // Check the dedicated tracking table first
  const { data: windowRow } = await supabase
    .from('whatsapp_conversation_window')
    .select('last_customer_message_at, window_expires_at, status')
    .eq('account_id', accountId)
    .eq('contact_id', resolvedContactId)
    .maybeSingle();

  if (windowRow?.last_customer_message_at) {
    return calculateServiceWindow(windowRow.last_customer_message_at);
  }

  // Fallback: query the latest message from customer
  try {
    const builder = supabase
      .from('messages')
      .select('created_at, conversation:conversations!inner(contact_id, account_id)')
      .eq('conversation.account_id', accountId)
      .eq('conversation.contact_id', resolvedContactId)
      .eq('sender_type', 'customer');

    const ordered = 'order' in builder && typeof builder.order === 'function'
      ? builder.order('created_at', { ascending: false })
      : builder;

    const limited = 'limit' in ordered && typeof ordered.limit === 'function'
      ? ordered.limit(1)
      : ordered;

    if ('maybeSingle' in limited && typeof limited.maybeSingle === 'function') {
      const result = await limited.maybeSingle();
      const lastMsg = result?.data as { created_at?: string } | null;
      if (lastMsg?.created_at) {
        return calculateServiceWindow(lastMsg.created_at);
      }
    }
  } catch {
    // query fallback
  }

  return calculateServiceWindow(null);
}

/**
 * Record an inbound customer message, updating the customer service window to 24 hours from now.
 */
export async function recordInboundCustomerMessage(
  supabaseAdmin: SupabaseClient,
  params: {
    accountId: string;
    contactId: string;
    phoneNumberId: string;
    receivedAt: string | Date;
  }
): Promise<void> {
  const { accountId, contactId, phoneNumberId, receivedAt } = params;
  const receivedIso = new Date(receivedAt).toISOString();
  const expiresIso = new Date(new Date(receivedAt).getTime() + 24 * 60 * 60 * 1000).toISOString();

  await supabaseAdmin
    .from('whatsapp_conversation_window')
    .upsert(
      {
        account_id: accountId,
        contact_id: contactId,
        phone_number_id: phoneNumberId,
        last_customer_message_at: receivedIso,
        window_expires_at: expiresIso,
        status: 'open',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,contact_id' }
    );
}

/**
 * Throws a SendMessageError (HTTP 403) if the 24-hour service window is closed.
 */
export async function assertServiceWindowOpen(
  supabase: SupabaseClient,
  params: {
    accountId: string;
    contactId?: string;
    conversationId?: string;
  }
): Promise<ServiceWindowStatus> {
  const windowStatus = await getConversationServiceWindow(supabase, params);
  if (!windowStatus.isOpen) {
    throw new SendMessageError(
      'SERVICE_WINDOW_CLOSED',
      'The 24-hour customer service window has expired. A Meta-approved template is required to re-engage with this customer.',
      403
    );
  }
  return windowStatus;
}
