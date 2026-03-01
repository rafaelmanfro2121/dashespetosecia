
-- Add new columns to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS job_function text DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS contract_url text;

-- Create storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for contracts bucket
CREATE POLICY "Authenticated can upload contracts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read contracts"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete contracts"
ON storage.objects FOR DELETE
USING (bucket_id = 'contracts' AND auth.role() = 'authenticated');
