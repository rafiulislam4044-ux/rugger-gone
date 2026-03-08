
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS alchemy_api_keys text[] DEFAULT '{}';
