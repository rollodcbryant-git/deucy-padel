
-- Add round_id to pledge_items (nullable, existing pledges will be linked to round 1 via data update)
ALTER TABLE public.pledge_items
  ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES public.rounds(id);

-- Add pledge gate settings to tournaments
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS pledge_gate_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pledge_deadline_hours integer NOT NULL DEFAULT 48;
