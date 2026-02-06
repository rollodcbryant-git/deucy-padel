-- Allow admins to delete players
CREATE POLICY "Admins can delete players"
ON public.players
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete pledge items
CREATE POLICY "Admins can delete pledge items"
ON public.pledge_items
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete auction lots
CREATE POLICY "Admins can delete auction lots"
ON public.auction_lots
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete credit ledger entries
CREATE POLICY "Admins can delete credit ledger entries"
ON public.credit_ledger_entries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete bids
CREATE POLICY "Admins can delete bids"
ON public.bids
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete escrow holds
CREATE POLICY "Admins can delete escrow holds"
ON public.escrow_holds
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete matches
CREATE POLICY "Admins can delete matches"
ON public.matches
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete rounds
CREATE POLICY "Admins can delete rounds"
ON public.rounds
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete notifications
CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete tournaments
CREATE POLICY "Admins can delete tournaments"
ON public.tournaments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
