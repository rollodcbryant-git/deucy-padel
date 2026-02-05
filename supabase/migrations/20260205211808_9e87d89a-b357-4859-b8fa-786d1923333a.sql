
-- Fix tournaments SELECT policy: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;
CREATE POLICY "Anyone can view tournaments"
ON public.tournaments
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix players SELECT policy
DROP POLICY IF EXISTS "Anyone can view players in a tournament" ON public.players;
CREATE POLICY "Anyone can view players in a tournament"
ON public.players
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix players INSERT policy (for joining)
DROP POLICY IF EXISTS "Anyone can insert players (join tournament)" ON public.players;
CREATE POLICY "Anyone can insert players (join tournament)"
ON public.players
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Fix players UPDATE policy
DROP POLICY IF EXISTS "Players can update own data" ON public.players;
CREATE POLICY "Players can update own data"
ON public.players
AS PERMISSIVE
FOR UPDATE
TO anon, authenticated
USING (true);

-- Fix matches SELECT
DROP POLICY IF EXISTS "Anyone can view matches" ON public.matches;
CREATE POLICY "Anyone can view matches"
ON public.matches
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix rounds SELECT
DROP POLICY IF EXISTS "Anyone can view rounds" ON public.rounds;
CREATE POLICY "Anyone can view rounds"
ON public.rounds
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix auction_lots SELECT
DROP POLICY IF EXISTS "Anyone can view auction lots" ON public.auction_lots;
CREATE POLICY "Anyone can view auction lots"
ON public.auction_lots
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix auctions SELECT
DROP POLICY IF EXISTS "Anyone can view auctions" ON public.auctions;
CREATE POLICY "Anyone can view auctions"
ON public.auctions
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix bids SELECT
DROP POLICY IF EXISTS "Anyone can view bids" ON public.bids;
CREATE POLICY "Anyone can view bids"
ON public.bids
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix credit_ledger SELECT
DROP POLICY IF EXISTS "Anyone can view credit ledger" ON public.credit_ledger_entries;
CREATE POLICY "Anyone can view credit ledger"
ON public.credit_ledger_entries
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix notifications SELECT
DROP POLICY IF EXISTS "Anyone can view notifications" ON public.notifications;
CREATE POLICY "Anyone can view notifications"
ON public.notifications
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix escrow_holds SELECT
DROP POLICY IF EXISTS "Anyone can view escrow holds" ON public.escrow_holds;
CREATE POLICY "Anyone can view escrow holds"
ON public.escrow_holds
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix pledge_items SELECT
DROP POLICY IF EXISTS "Anyone can view pledge items" ON public.pledge_items;
CREATE POLICY "Anyone can view pledge items"
ON public.pledge_items
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

-- Fix remaining write policies to PERMISSIVE
DROP POLICY IF EXISTS "Anyone can update auction lots" ON public.auction_lots;
CREATE POLICY "Anyone can update auction lots"
ON public.auction_lots AS PERMISSIVE FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can place bids" ON public.bids;
CREATE POLICY "Anyone can place bids"
ON public.bids AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage credit ledger" ON public.credit_ledger_entries;
CREATE POLICY "Admins can manage credit ledger"
ON public.credit_ledger_entries AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can manage notifications" ON public.notifications;
CREATE POLICY "Anyone can manage notifications"
ON public.notifications AS PERMISSIVE FOR ALL TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can manage escrow holds" ON public.escrow_holds;
CREATE POLICY "Anyone can manage escrow holds"
ON public.escrow_holds AS PERMISSIVE FOR ALL TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert pledge items" ON public.pledge_items;
CREATE POLICY "Anyone can insert pledge items"
ON public.pledge_items AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update pledge items" ON public.pledge_items;
CREATE POLICY "Anyone can update pledge items"
ON public.pledge_items AS PERMISSIVE FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can update matches" ON public.matches;
CREATE POLICY "Anyone can update matches"
ON public.matches AS PERMISSIVE FOR UPDATE TO anon, authenticated USING (true);
