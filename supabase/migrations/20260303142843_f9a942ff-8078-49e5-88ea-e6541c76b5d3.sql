
-- Add order status and invoice URL columns to service_orders
ALTER TABLE public.service_orders 
  ADD COLUMN IF NOT EXISTS order_status text NOT NULL DEFAULT 'em_producao',
  ADD COLUMN IF NOT EXISTS nota_fiscal_url text NULL DEFAULT '';

-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for invoices bucket
CREATE POLICY "Authenticated can upload invoices" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Authenticated can read invoices" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated can delete invoices" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'invoices');

CREATE POLICY "Public can read invoices" ON storage.objects
FOR SELECT TO anon USING (bucket_id = 'invoices');
