ALTER TABLE public.blitz_tournaments
  ADD COLUMN IF NOT EXISTS timer_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS timer_paused_remaining integer DEFAULT NULL;