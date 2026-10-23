-- Vendas antigas lidas das notas fiscais (DANFE em PDF). Usadas só na exportação de públicos da Meta;
-- não entram no Dashboard nem no Financeiro.
CREATE TABLE IF NOT EXISTS public.historical_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nf_key text NOT NULL UNIQUE,          -- chave de acesso da NF-e (44 dígitos)
  nf_number text,
  issued_at date,
  natureza text,
  cliente_nome text,
  cliente_documento text,
  cliente_telefone text,
  cliente_email text,
  endereco text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  total numeric NOT NULL DEFAULT 0,
  source_file text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historical_sales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated can read historical_sales" ON public.historical_sales FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can insert historical_sales" ON public.historical_sales FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can update historical_sales" ON public.historical_sales FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can delete historical_sales" ON public.historical_sales FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
