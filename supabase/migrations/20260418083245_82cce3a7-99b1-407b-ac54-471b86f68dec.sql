ALTER TABLE public.blitz_tournaments REPLICA IDENTITY FULL;
ALTER TABLE public.blitz_rounds REPLICA IDENTITY FULL;
ALTER TABLE public.blitz_bets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blitz_tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blitz_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blitz_bets;