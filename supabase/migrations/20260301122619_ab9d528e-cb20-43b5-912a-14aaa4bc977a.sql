
-- Table for warranty/replacement costs
CREATE TABLE public.warranty_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  part_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  warranty_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.warranty_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read warranty_costs" ON public.warranty_costs FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert warranty_costs" ON public.warranty_costs FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update warranty_costs" ON public.warranty_costs FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete warranty_costs" ON public.warranty_costs FOR DELETE USING (true);
