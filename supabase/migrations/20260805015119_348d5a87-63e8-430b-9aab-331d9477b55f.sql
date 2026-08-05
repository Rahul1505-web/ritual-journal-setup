CREATE TABLE IF NOT EXISTS public.daily_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  wallet_address text NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  tx_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.daily_access TO authenticated;
GRANT ALL ON public.daily_access TO service_role;

ALTER TABLE public.daily_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own daily access"
  ON public.daily_access FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Access records contain only wallet addresses and timestamps (no personal data).
-- Readable by any signed-in user so the on-chain access check and the owner
-- dashboard can aggregate daily unlocks.
CREATE POLICY "Signed-in users can read access records"
  ON public.daily_access FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS daily_access_wallet_paid_idx
  ON public.daily_access (wallet_address, paid_at DESC);