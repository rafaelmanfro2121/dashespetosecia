
-- Table to track material purchases for price evolution and alerts
CREATE TABLE public.material_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.material_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read material_purchases" ON public.material_purchases FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert material_purchases" ON public.material_purchases FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update material_purchases" ON public.material_purchases FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete material_purchases" ON public.material_purchases FOR DELETE USING (true);

-- Enable realtime for material_purchases
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_purchases;
