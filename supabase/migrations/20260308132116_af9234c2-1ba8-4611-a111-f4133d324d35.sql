
-- Create monitor_state table (always 1 row)
CREATE TABLE public.monitor_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_monitoring boolean NOT NULL DEFAULT false,
  token_address text,
  token_name text,
  token_symbol text,
  token_decimals integer,
  total_supply text,
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert the single row
INSERT INTO public.monitor_state (id) VALUES (1);

-- Create danger_transfers table
CREATE TABLE public.danger_transfers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_address text NOT NULL,
  token_name text,
  token_symbol text,
  from_wallet text NOT NULL,
  to_wallet text NOT NULL,
  amount text NOT NULL,
  tx_hash text,
  wallet_position integer,
  transfer_count integer,
  detected_at timestamptz DEFAULT now(),
  sell_triggered boolean DEFAULT false,
  sell_tx_hash text,
  sell_status text DEFAULT 'pending',
  source text DEFAULT 'live'
);

-- Create history_searches table
CREATE TABLE public.history_searches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_address text NOT NULL,
  wallet_address text,
  searched_at timestamptz DEFAULT now(),
  results_count integer DEFAULT 0
);

-- Create sell_log table
CREATE TABLE public.sell_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  danger_transfer_id bigint REFERENCES public.danger_transfers(id) ON DELETE SET NULL,
  token_address text NOT NULL,
  token_name text,
  amount_sold text,
  sell_tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  executed_at timestamptz DEFAULT now()
);

-- Create settings table (always 1 row)
CREATE TABLE public.settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  alchemy_api_key text,
  wallet_private_key text,
  auto_sell_enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.settings (id) VALUES (1);

-- Enable RLS on all tables
ALTER TABLE public.monitor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.danger_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sell_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow public access (no auth required for this tool)
CREATE POLICY "Allow all on monitor_state" ON public.monitor_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on danger_transfers" ON public.danger_transfers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on history_searches" ON public.history_searches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sell_log" ON public.sell_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime on danger_transfers for /manual page
ALTER PUBLICATION supabase_realtime ADD TABLE public.danger_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sell_log;

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_monitor_state_updated_at
  BEFORE UPDATE ON public.monitor_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
