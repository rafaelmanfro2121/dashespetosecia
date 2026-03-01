
-- Junction table: materials used per product with quantities
CREATE TABLE public.product_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  quantity_per_unit NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product_materials" ON public.product_materials FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert product_materials" ON public.product_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update product_materials" ON public.product_materials FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete product_materials" ON public.product_materials FOR DELETE USING (true);

-- Fixed/overhead costs table (rent, utilities, freight, advertising, etc.)
CREATE TABLE public.fixed_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  monthly_amount NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fixed_costs" ON public.fixed_costs FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert fixed_costs" ON public.fixed_costs FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update fixed_costs" ON public.fixed_costs FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete fixed_costs" ON public.fixed_costs FOR DELETE USING (true);
