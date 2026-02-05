
-- Add euro-specific tournament settings
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS euros_per_set_win integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS euros_per_set_loss integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS allow_negative_balance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_decimals boolean NOT NULL DEFAULT false;

-- Update default starting_credits to 2000 (= €20.00)
ALTER TABLE public.tournaments ALTER COLUMN starting_credits SET DEFAULT 2000;

COMMENT ON COLUMN public.tournaments.euros_per_set_win IS 'Cents gained per set won (e.g. 200 = €2.00)';
COMMENT ON COLUMN public.tournaments.euros_per_set_loss IS 'Cents lost per set lost (e.g. 200 = €2.00)';
COMMENT ON COLUMN public.tournaments.starting_credits IS 'Starting balance in cents (e.g. 2000 = €20.00)';
