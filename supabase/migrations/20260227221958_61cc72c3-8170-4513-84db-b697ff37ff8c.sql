
-- Create inventory table for raw materials
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  last_purchase_date DATE,
  last_purchase_price NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert inventory" ON public.inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update inventory" ON public.inventory FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete inventory" ON public.inventory FOR DELETE USING (true);
