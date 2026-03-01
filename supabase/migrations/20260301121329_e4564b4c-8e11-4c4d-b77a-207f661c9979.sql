ALTER TABLE public.employees ADD COLUMN payment_type text NOT NULL DEFAULT 'mensal';
COMMENT ON COLUMN public.employees.payment_type IS 'mensal = fixed monthly salary, diaria = daily rate';