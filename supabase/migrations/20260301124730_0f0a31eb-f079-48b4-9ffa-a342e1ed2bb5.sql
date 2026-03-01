
-- Service Orders table
CREATE TABLE public.service_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  os_number text NOT NULL DEFAULT '',
  empresa_nome text NOT NULL DEFAULT '',
  empresa_cnpj text DEFAULT '',
  empresa_telefone text DEFAULT '',
  empresa_endereco text DEFAULT '',
  empresa_email text DEFAULT '',
  cliente_nome text NOT NULL DEFAULT '',
  cliente_telefone text DEFAULT '',
  cliente_cpf_cnpj text DEFAULT '',
  cliente_contato text DEFAULT '',
  vendedor text DEFAULT '',
  atendimento_data date NOT NULL DEFAULT CURRENT_DATE,
  atendimento_hora text DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  forma_pagamento text DEFAULT '',
  descricao_pagamento text DEFAULT '',
  observacoes text DEFAULT '',
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read service_orders" ON public.service_orders FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert service_orders" ON public.service_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can update service_orders" ON public.service_orders FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete service_orders" ON public.service_orders FOR DELETE USING (true);
