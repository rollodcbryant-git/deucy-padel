ALTER TABLE public.pledge_items ALTER COLUMN status SET DEFAULT 'Approved'::pledge_status;
ALTER TABLE public.pledge_items ALTER COLUMN approved SET DEFAULT true;