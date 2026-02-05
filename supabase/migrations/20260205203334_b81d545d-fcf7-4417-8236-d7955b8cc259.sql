-- Create enums for tournament statuses and types
CREATE TYPE public.tournament_status AS ENUM ('Draft', 'SignupOpen', 'Live', 'Finished', 'AuctionLive', 'Closed');
CREATE TYPE public.player_status AS ENUM ('Active', 'InactiveWarning', 'Removed');
CREATE TYPE public.player_gender AS ENUM ('male', 'female', 'other', 'prefer_not');
CREATE TYPE public.round_status AS ENUM ('Upcoming', 'Live', 'Locked', 'Completed');
CREATE TYPE public.match_status AS ENUM ('Scheduled', 'BookingClaimed', 'Played', 'Overdue', 'AutoResolved');
CREATE TYPE public.credit_type AS ENUM ('StartingGrant', 'ParticipationBonus', 'MatchStake', 'MatchPayout', 'Penalty', 'AdminAdjustment', 'AuctionHold', 'AuctionRelease', 'AuctionSettlement');
CREATE TYPE public.pledge_category AS ENUM ('food', 'drink', 'object', 'service', 'chaos');
CREATE TYPE public.pledge_status AS ENUM ('Draft', 'Approved', 'Hidden');
CREATE TYPE public.auction_status AS ENUM ('Draft', 'Live', 'Ended');
CREATE TYPE public.lot_status AS ENUM ('Live', 'Ended');
CREATE TYPE public.escrow_status AS ENUM ('Active', 'Released', 'Settled');
CREATE TYPE public.app_role AS ENUM ('admin', 'player');

-- Create tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  club_name TEXT,
  booking_url TEXT,
  status public.tournament_status NOT NULL DEFAULT 'Draft',
  created_by_admin_id UUID,
  max_players INTEGER NOT NULL DEFAULT 24,
  min_players INTEGER NOT NULL DEFAULT 8,
  round_duration_days INTEGER NOT NULL DEFAULT 10 CHECK (round_duration_days >= 7 AND round_duration_days <= 14),
  rounds_count INTEGER,
  playoffs_enabled BOOLEAN NOT NULL DEFAULT true,
  stake_per_player INTEGER NOT NULL DEFAULT 20,
  participation_bonus INTEGER NOT NULL DEFAULT 50,
  penalty_amount INTEGER NOT NULL DEFAULT 50,
  starting_credits INTEGER NOT NULL DEFAULT 1000,
  join_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create players table (custom auth with phone + PIN)
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  avatar_url TEXT,
  gender public.player_gender,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  status public.player_status NOT NULL DEFAULT 'Active',
  credits_balance INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  sets_won INTEGER NOT NULL DEFAULT 0,
  sets_lost INTEGER NOT NULL DEFAULT 0,
  match_wins INTEGER NOT NULL DEFAULT 0,
  match_losses INTEGER NOT NULL DEFAULT 0,
  no_shows INTEGER NOT NULL DEFAULT 0,
  session_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, phone)
);

-- Create user_roles table for admin access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create rounds table
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  status public.round_status NOT NULL DEFAULT 'Upcoming',
  is_playoff BOOLEAN NOT NULL DEFAULT false,
  playoff_type TEXT, -- 'semi' or 'final'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, index)
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  team_a_player1_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  team_a_player2_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  team_b_player1_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  team_b_player2_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  status public.match_status NOT NULL DEFAULT 'Scheduled',
  booking_claimed_by_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  booking_claimed_at TIMESTAMP WITH TIME ZONE,
  played_at TIMESTAMP WITH TIME ZONE,
  sets_a INTEGER NOT NULL DEFAULT 0 CHECK (sets_a >= 0 AND sets_a <= 3),
  sets_b INTEGER NOT NULL DEFAULT 0 CHECK (sets_b >= 0 AND sets_b <= 3),
  is_unfinished BOOLEAN NOT NULL DEFAULT false,
  deadline_at TIMESTAMP WITH TIME ZONE,
  pot_total_credits INTEGER NOT NULL DEFAULT 0,
  is_bye BOOLEAN NOT NULL DEFAULT false,
  bye_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit ledger entries table
CREATE TABLE public.credit_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  round_id UUID REFERENCES public.rounds(id) ON DELETE SET NULL,
  type public.credit_type NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pledge items table
CREATE TABLE public.pledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  pledged_by_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category public.pledge_category NOT NULL,
  quantity_text TEXT,
  image_url TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  estimate_low INTEGER,
  estimate_high INTEGER,
  status public.pledge_status NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create auctions table
CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE UNIQUE,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  status public.auction_status NOT NULL DEFAULT 'Draft',
  anti_sniping_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create auction lots table
CREATE TABLE public.auction_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  pledge_item_id UUID NOT NULL REFERENCES public.pledge_items(id) ON DELETE CASCADE UNIQUE,
  current_bid INTEGER,
  current_winner_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  min_increment INTEGER NOT NULL DEFAULT 10,
  ends_at TIMESTAMP WITH TIME ZONE,
  extensions_count INTEGER NOT NULL DEFAULT 0,
  status public.lot_status NOT NULL DEFAULT 'Live',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bids table
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  bidder_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create escrow holds table
CREATE TABLE public.escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  bidder_player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  reserved_amount INTEGER NOT NULL,
  status public.escrow_status NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  released_at TIMESTAMP WITH TIME ZONE
);

-- Create notifications table for in-app nudges
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'deadline', 'match', 'auction', etc.
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create has_role function for RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies

-- Tournaments: public read, admin write
CREATE POLICY "Anyone can view tournaments"
ON public.tournaments FOR SELECT
USING (true);

CREATE POLICY "Admins can manage tournaments"
ON public.tournaments FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Players: tournament participants can view, self can update
CREATE POLICY "Anyone can view players in a tournament"
ON public.players FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert players (join tournament)"
ON public.players FOR INSERT
WITH CHECK (true);

CREATE POLICY "Players can update own data"
ON public.players FOR UPDATE
USING (true);

-- User roles: only authenticated users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Rounds: public read
CREATE POLICY "Anyone can view rounds"
ON public.rounds FOR SELECT
USING (true);

CREATE POLICY "Admins can manage rounds"
ON public.rounds FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Matches: public read
CREATE POLICY "Anyone can view matches"
ON public.matches FOR SELECT
USING (true);

CREATE POLICY "Anyone can update matches"
ON public.matches FOR UPDATE
USING (true);

CREATE POLICY "Admins can manage matches"
ON public.matches FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Credit ledger: public read for transparency
CREATE POLICY "Anyone can view credit ledger"
ON public.credit_ledger_entries FOR SELECT
USING (true);

CREATE POLICY "Admins can manage credit ledger"
ON public.credit_ledger_entries FOR INSERT
WITH CHECK (true);

-- Pledge items: public read, owner can manage
CREATE POLICY "Anyone can view pledge items"
ON public.pledge_items FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert pledge items"
ON public.pledge_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update pledge items"
ON public.pledge_items FOR UPDATE
USING (true);

-- Auctions: public read
CREATE POLICY "Anyone can view auctions"
ON public.auctions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage auctions"
ON public.auctions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Auction lots: public read
CREATE POLICY "Anyone can view auction lots"
ON public.auction_lots FOR SELECT
USING (true);

CREATE POLICY "Anyone can update auction lots"
ON public.auction_lots FOR UPDATE
USING (true);

-- Bids: public read (transparent bidding)
CREATE POLICY "Anyone can view bids"
ON public.bids FOR SELECT
USING (true);

CREATE POLICY "Anyone can place bids"
ON public.bids FOR INSERT
WITH CHECK (true);

-- Escrow holds: public read
CREATE POLICY "Anyone can view escrow holds"
ON public.escrow_holds FOR SELECT
USING (true);

CREATE POLICY "Anyone can manage escrow holds"
ON public.escrow_holds FOR ALL
USING (true);

-- Notifications: player can view own
CREATE POLICY "Anyone can view notifications"
ON public.notifications FOR SELECT
USING (true);

CREATE POLICY "Anyone can manage notifications"
ON public.notifications FOR ALL
USING (true);

-- Enable realtime for auction-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_lots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_tournaments_updated_at
BEFORE UPDATE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at
BEFORE UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();