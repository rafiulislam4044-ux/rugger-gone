
-- Snipe wallets watchlist (up to 8 wallets)
CREATE TABLE public.snipe_wallets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  added_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.snipe_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on snipe_wallets" ON public.snipe_wallets FOR ALL USING (true) WITH CHECK (true);

-- Snipe config (singleton row, id=1)
CREATE TABLE public.snipe_config (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY,
  buy_amount_eth text NOT NULL DEFAULT '0.01',
  profit_take_percent integer NOT NULL DEFAULT 100,
  profit_sell_percent integer NOT NULL DEFAULT 50,
  stop_loss_percent integer NOT NULL DEFAULT 50,
  is_enabled boolean NOT NULL DEFAULT false,
  watch_timeout_hours integer NOT NULL DEFAULT 24,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.snipe_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on snipe_config" ON public.snipe_config FOR ALL USING (true) WITH CHECK (true);

-- Insert default config
INSERT INTO public.snipe_config (id) VALUES (1);

-- Snipe buys log
CREATE TABLE public.snipe_buys (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_wallet text NOT NULL,
  funded_wallet text NOT NULL,
  token_address text NOT NULL,
  token_name text,
  token_symbol text,
  buy_amount_eth text,
  buy_tx_hash text,
  buy_price_eth text,
  current_price_eth text,
  pnl_percent numeric,
  status text NOT NULL DEFAULT 'pending',
  profit_taken boolean DEFAULT false,
  stop_loss_triggered boolean DEFAULT false,
  auto_monitor_started boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.snipe_buys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on snipe_buys" ON public.snipe_buys FOR ALL USING (true) WITH CHECK (true);

-- Watched wallets (Layer 2 - funded wallets being watched for token creation)
CREATE TABLE public.snipe_watched_wallets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_wallet text NOT NULL,
  funded_wallet text NOT NULL,
  eth_amount text,
  funding_tx_hash text,
  token_created text,
  is_active boolean NOT NULL DEFAULT true,
  detected_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);

ALTER TABLE public.snipe_watched_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on snipe_watched_wallets" ON public.snipe_watched_wallets FOR ALL USING (true) WITH CHECK (true);

-- Snipe activity log (all wallet activity feed)
CREATE TABLE public.snipe_activity_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address text NOT NULL,
  event_type text NOT NULL,
  description text,
  tx_hash text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.snipe_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on snipe_activity_log" ON public.snipe_activity_log FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for snipe tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.snipe_buys;
ALTER PUBLICATION supabase_realtime ADD TABLE public.snipe_watched_wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.snipe_activity_log;
