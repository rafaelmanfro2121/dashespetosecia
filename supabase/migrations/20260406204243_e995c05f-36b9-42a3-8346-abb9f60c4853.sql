CREATE TABLE public.salary_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  payment_month integer NOT NULL,
  payment_year integer NOT NULL,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(employee_id, payment_month, payment_year)
);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read salary_payments" ON public.salary_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert salary_payments" ON public.salary_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update salary_payments" ON public.salary_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete salary_payments" ON public.salary_payments FOR DELETE TO authenticated USING (true);