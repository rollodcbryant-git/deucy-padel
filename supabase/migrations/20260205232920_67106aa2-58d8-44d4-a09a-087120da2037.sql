
-- Add series/queue grouping to tournaments
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS series_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS series_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.tournaments.series_id IS 'Groups tournaments into a rolling queue/series';
COMMENT ON COLUMN public.tournaments.series_order IS 'Order within the series queue (0-indexed)';
COMMENT ON COLUMN public.tournaments.started_at IS 'When the tournament went Live';
COMMENT ON COLUMN public.tournaments.ended_at IS 'When the tournament finished';

-- Create index for efficient series queries
CREATE INDEX IF NOT EXISTS idx_tournaments_series ON public.tournaments(series_id, series_order);
