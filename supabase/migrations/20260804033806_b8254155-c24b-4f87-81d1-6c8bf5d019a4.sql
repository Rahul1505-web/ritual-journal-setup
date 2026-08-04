CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  market_type text NOT NULL,
  direction text NOT NULL,
  entry_price numeric NOT NULL,
  exit_price numeric NOT NULL,
  quantity numeric NOT NULL,
  pnl numeric NOT NULL DEFAULT 0,
  trade_date timestamptz NOT NULL DEFAULT now(),
  trade_type text NOT NULL DEFAULT 'Intraday',
  emotion text NOT NULL DEFAULT 'Neutral',
  mistake_tags text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  chart_urls text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own trades" ON public.trades FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rule_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rules TO authenticated;
GRANT ALL ON public.rules TO service_role;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rules" ON public.rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER rules_updated_at BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.compute_trade_pnl()
RETURNS TRIGGER AS $$
BEGIN
  NEW.pnl = CASE WHEN NEW.direction = 'SELL'
    THEN (NEW.entry_price - NEW.exit_price) * NEW.quantity
    ELSE (NEW.exit_price - NEW.entry_price) * NEW.quantity END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trades_pnl BEFORE INSERT OR UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.compute_trade_pnl();

CREATE INDEX trades_user_date_idx ON public.trades (user_id, trade_date DESC);
CREATE INDEX rules_user_idx ON public.rules (user_id);

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

CREATE POLICY "Users read own trade charts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'trade-charts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own trade charts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trade-charts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own trade charts" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'trade-charts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own trade charts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trade-charts' AND auth.uid()::text = (storage.foldername(name))[1]);