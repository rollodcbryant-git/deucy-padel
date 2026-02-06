
-- Create waitlist status enum
CREATE TYPE public.waitlist_status AS ENUM ('waiting', 'invited', 'assigned', 'confirmed', 'removed', 'no_response', 'dropped');

-- Create waitlist_entries table
CREATE TABLE public.waitlist_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  status public.waitlist_status NOT NULL DEFAULT 'waiting',
  priority BOOLEAN NOT NULL DEFAULT false,
  assigned_tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies: anyone can view and insert (custom auth system), admins can manage all
CREATE POLICY "Anyone can view waitlist entries"
  ON public.waitlist_entries FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert waitlist entries"
  ON public.waitlist_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update waitlist entries"
  ON public.waitlist_entries FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete waitlist entries"
  ON public.waitlist_entries FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_waitlist_entries_updated_at
  BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookups
CREATE INDEX idx_waitlist_phone ON public.waitlist_entries(phone);
CREATE INDEX idx_waitlist_tournament ON public.waitlist_entries(tournament_id);
CREATE INDEX idx_waitlist_status ON public.waitlist_entries(status);
