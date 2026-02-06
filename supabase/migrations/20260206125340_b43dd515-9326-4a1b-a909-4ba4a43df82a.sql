-- Allow players to exist without a tournament (account-only records)
ALTER TABLE public.players ALTER COLUMN tournament_id DROP NOT NULL;