CREATE TABLE public.wallet_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  access_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  tx_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, wallet_address, access_date)
);

GRANT SELECT, INSERT ON public.wallet_access TO authenticated;
GRANT ALL ON public.wallet_access TO service_role;

ALTER TABLE public.wallet_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet access" ON public.wallet_access
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users create own wallet access" ON public.wallet_access
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX wallet_access_user_date_idx ON public.wallet_access (user_id, access_date);