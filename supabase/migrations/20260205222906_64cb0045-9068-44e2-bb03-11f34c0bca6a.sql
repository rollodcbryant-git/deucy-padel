
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS has_seen_onboarding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_seen_auction_intro boolean NOT NULL DEFAULT false;
