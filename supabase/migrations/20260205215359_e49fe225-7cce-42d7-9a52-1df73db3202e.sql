
-- Add admin_note and updated_at to pledge_items
ALTER TABLE public.pledge_items ADD COLUMN IF NOT EXISTS admin_note text;
ALTER TABLE public.pledge_items ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Create trigger for updated_at on pledge_items
CREATE TRIGGER update_pledge_items_updated_at
  BEFORE UPDATE ON public.pledge_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for pledge images
INSERT INTO storage.buckets (id, name, public) VALUES ('pledge-images', 'pledge-images', true);

-- Storage policies for pledge images
CREATE POLICY "Anyone can view pledge images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pledge-images');

CREATE POLICY "Anyone can upload pledge images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pledge-images');

CREATE POLICY "Anyone can update pledge images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'pledge-images');
