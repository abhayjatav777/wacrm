-- ============================================================
-- 061_whatsapp_messaging_upgrade.sql
--
-- FallInTech CRM WhatsApp Free Messaging & Advanced Composer Upgrade:
--   1. whatsapp_conversation_window: 24h customer service window tracking
--   2. whatsapp_message_usage: monthly free service message usage tracker (1,000 allowance)
--   3. quick_replies: add shortcut, category, media_url, is_active
--   4. messages: add media_id (Cloud API upload ID), caption
-- ============================================================

-- 1. Conversation Service Window ------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_conversation_window (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  last_customer_message_at TIMESTAMPTZ NOT NULL,
  window_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_conversation_window UNIQUE(account_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_window_account_contact
  ON whatsapp_conversation_window(account_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_window_expires
  ON whatsapp_conversation_window(window_expires_at);

ALTER TABLE whatsapp_conversation_window ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_conversation_window_select ON whatsapp_conversation_window;
DROP POLICY IF EXISTS whatsapp_conversation_window_all ON whatsapp_conversation_window;

CREATE POLICY whatsapp_conversation_window_select ON whatsapp_conversation_window
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY whatsapp_conversation_window_all ON whatsapp_conversation_window
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 2. Monthly Service Message Usage Tracker --------------------
CREATE TABLE IF NOT EXISTS whatsapp_message_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  billing_period TEXT NOT NULL, -- Format: YYYY-MM e.g. 2026-11
  free_allowance INTEGER NOT NULL DEFAULT 1000,
  delivered_service_messages INTEGER NOT NULL DEFAULT 0,
  billable_service_messages INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_message_usage UNIQUE(account_id, phone_number_id, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_usage_account_period
  ON whatsapp_message_usage(account_id, phone_number_id, billing_period);

ALTER TABLE whatsapp_message_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_message_usage_select ON whatsapp_message_usage;
DROP POLICY IF EXISTS whatsapp_message_usage_all ON whatsapp_message_usage;

CREATE POLICY whatsapp_message_usage_select ON whatsapp_message_usage
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY whatsapp_message_usage_all ON whatsapp_message_usage
  FOR ALL USING (is_account_member(account_id, 'agent'));

-- 3. Extend quick_replies -------------------------------------
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS shortcut TEXT;
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_quick_replies_shortcut
  ON quick_replies(account_id, shortcut);

-- 4. Extend messages ------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS caption TEXT;

-- 5. Grant access to API roles --------------------------------
GRANT ALL ON whatsapp_conversation_window TO anon, authenticated, service_role;
GRANT ALL ON whatsapp_message_usage TO anon, authenticated, service_role;
GRANT ALL ON quick_replies TO anon, authenticated, service_role;
