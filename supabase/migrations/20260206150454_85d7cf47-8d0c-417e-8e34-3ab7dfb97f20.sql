
-- ============================================================
-- MATCH BETTING SYSTEM
-- ============================================================

-- Add betting settings to tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS betting_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS bank_balance integer NOT NULL DEFAULT 10000;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS per_round_bet_cap integer NOT NULL DEFAULT 500;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS per_bet_max integer NOT NULL DEFAULT 300;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS min_protected_balance integer NOT NULL DEFAULT 200;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS payout_multiplier numeric(3,1) NOT NULL DEFAULT 2.0;

-- Create match_bets table
CREATE TABLE IF NOT EXISTS public.match_bets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  predicted_winner text NOT NULL CHECK (predicted_winner IN ('team_a', 'team_b')),
  stake integer NOT NULL CHECK (stake > 0),
  payout integer,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Won', 'Lost', 'Cancelled')),
  settled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_bets ENABLE ROW LEVEL SECURITY;

-- RLS policies for match_bets
CREATE POLICY "Anyone can view match bets"
ON public.match_bets FOR SELECT USING (true);

CREATE POLICY "Anyone can place match bets"
ON public.match_bets FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update match bets"
ON public.match_bets FOR UPDATE USING (true);

CREATE POLICY "Admins can delete match bets"
ON public.match_bets FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add credit type for betting
-- Note: We'll use 'BetStake' and 'BetPayout' as note prefixes on existing types
-- Actually, let's add proper enum values
ALTER TYPE public.credit_type ADD VALUE IF NOT EXISTS 'BetStake';
ALTER TYPE public.credit_type ADD VALUE IF NOT EXISTS 'BetPayout';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_match_bets_match_id ON public.match_bets(match_id);
CREATE INDEX IF NOT EXISTS idx_match_bets_player_round ON public.match_bets(player_id, round_id);
CREATE INDEX IF NOT EXISTS idx_match_bets_tournament ON public.match_bets(tournament_id);
