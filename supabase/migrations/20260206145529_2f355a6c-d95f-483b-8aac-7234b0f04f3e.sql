
-- Add delivery fields + duration to auctions
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS delivery_location text;
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS delivery_maps_url text;
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS delivery_deadline timestamp with time zone;
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS duration_hours integer NOT NULL DEFAULT 24;

-- Allow the edge function (service role) to insert auction lots
CREATE POLICY "Service can insert auction lots"
ON public.auction_lots
FOR INSERT
WITH CHECK (true);
