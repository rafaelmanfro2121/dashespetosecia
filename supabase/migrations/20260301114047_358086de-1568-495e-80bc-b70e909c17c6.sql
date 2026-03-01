
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cpf text DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pix_key text DEFAULT '';
