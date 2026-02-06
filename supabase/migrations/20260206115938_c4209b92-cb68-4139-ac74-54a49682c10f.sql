-- Add tier column to tournaments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_tier') THEN
    CREATE TYPE public.tournament_tier AS ENUM ('Major', 'League', 'Mini');
  END IF;
END$$;

ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS tier public.tournament_tier NOT NULL DEFAULT 'League';
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS signup_open_at timestamp with time zone;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS signup_close_at timestamp with time zone;
