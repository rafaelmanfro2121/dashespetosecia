-- Espetos & Cia: cria todas as tabelas, regras de segurança e pastas de arquivos.
-- Cole tudo no SQL Editor do Supabase (New query) e clique em Run. Rode só uma vez.


-- ===== 20260227220625_bab43d71-c9ba-4567-8175-5d7393705959.sql =====

-- Profiles table with role
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'employee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Categories
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Seed default categories
INSERT INTO public.categories (name) VALUES
  ('Alimentação'), ('Bebidas'), ('Carne'), ('Funcionários'), ('Energia'),
  ('Água'), ('Aluguel'), ('Manutenção'), ('Materiais'), ('Vendas'), ('Outros');

-- Transactions
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.categories(id),
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  payment_method TEXT NOT NULL DEFAULT 'Dinheiro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Employees
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  salary NUMERIC(12,2) NOT NULL DEFAULT 3000,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Attendance
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  presence_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('presente', 'falta', 'meio-periodo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, presence_date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Vales (advances)
CREATE TABLE public.vales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  vale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vales ENABLE ROW LEVEL SECURITY;

-- Monthly closings (historical)
CREATE TABLE public.monthly_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closing_month INT NOT NULL CHECK (closing_month BETWEEN 0 AND 11),
  closing_year INT NOT NULL,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_salaries NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_vales NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(12,2) NOT NULL DEFAULT 0,
  margin NUMERIC(5,2) NOT NULL DEFAULT 0,
  employee_details JSONB,
  ai_report TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(closing_month, closing_year)
);
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All tables require authenticated user (internal system)
-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Categories: any authenticated user can read, admins can manage
CREATE POLICY "Authenticated can read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE TO authenticated USING (public.is_admin());

-- Transactions: any authenticated can CRUD (internal system, all are trusted)
CREATE POLICY "Authenticated can read transactions" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated can update transactions" ON public.transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete transactions" ON public.transactions FOR DELETE TO authenticated USING (true);

-- Employees: any authenticated
CREATE POLICY "Authenticated can read employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update employees" ON public.employees FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete employees" ON public.employees FOR DELETE TO authenticated USING (true);

-- Attendance
CREATE POLICY "Authenticated can read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update attendance" ON public.attendance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete attendance" ON public.attendance FOR DELETE TO authenticated USING (true);

-- Vales
CREATE POLICY "Authenticated can read vales" ON public.vales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vales" ON public.vales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update vales" ON public.vales FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete vales" ON public.vales FOR DELETE TO authenticated USING (true);

-- Monthly closings
CREATE POLICY "Authenticated can read closings" ON public.monthly_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert closings" ON public.monthly_closings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update closings" ON public.monthly_closings FOR UPDATE TO authenticated USING (true);


-- ===== 20260227221441_b1d6325e-a16c-4170-871e-b8318e068f5e.sql =====

-- Products/Models table for churrasqueiras
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_costs NUMERIC(12,2) NOT NULL DEFAULT 0,
  units_sold INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete products" ON public.products FOR DELETE TO authenticated USING (true);


-- ===== 20260227221958_61cc72c3-8170-4513-84db-b697ff37ff8c.sql =====

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


-- ===== 20260228121100_305cac9c-11c9-4647-82f1-eef7650962e8.sql =====

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


-- ===== 20260301113439_05b7abb5-b4ea-4068-90b5-282caf7087b7.sql =====

-- Add new columns to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS job_function text DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS contract_url text;

-- Create storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for contracts bucket
CREATE POLICY "Authenticated can upload contracts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can read contracts"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete contracts"
ON storage.objects FOR DELETE
USING (bucket_id = 'contracts' AND auth.role() = 'authenticated');


-- ===== 20260301114047_358086de-1568-495e-80bc-b70e909c17c6.sql =====

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cpf text DEFAULT '';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pix_key text DEFAULT '';


-- ===== 20260301115745_db8713b5-0051-4ad5-a8fb-4be0e08fd966.sql =====

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


-- ===== 20260301121329_e4564b4c-8e11-4c4d-b77a-207f661c9979.sql =====
ALTER TABLE public.employees ADD COLUMN payment_type text NOT NULL DEFAULT 'mensal';
COMMENT ON COLUMN public.employees.payment_type IS 'mensal = fixed monthly salary, diaria = daily rate';

-- ===== 20260301122619_ab9d528e-cb20-43b5-912a-14aaa4bc977a.sql =====

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


-- ===== 20260301124730_0f0a31eb-f079-48b4-9ffa-a342e1ed2bb5.sql =====

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


-- ===== 20260301130018_1469f5c5-5d65-4e36-b971-c23eab17a7fb.sql =====
ALTER TABLE public.service_orders ADD COLUMN cliente_email text DEFAULT '';

-- ===== 20260303142843_f9a942ff-8078-49e5-88ea-e6541c76b5d3.sql =====

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


-- ===== 20260303143819_9c2518f0-cd92-4960-b841-c6c34022a3b6.sql =====
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendente';

-- ===== 20260303144310_51621340-2220-428a-95d9-8eae826e3538.sql =====
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS payment_method_client text NOT NULL DEFAULT '';

-- ===== 20260304134327_0f8dd3b4-3455-48e4-909d-fe86d72dd5c0.sql =====
ALTER TABLE public.service_orders ADD COLUMN os_tecnica_salva boolean NOT NULL DEFAULT false;

-- ===== 20260306184948_d0d5ba6d-b3c9-44df-9bd8-a0ea23385b65.sql =====
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS os_tecnica_data jsonb DEFAULT NULL;

-- ===== 20260406203852_047005c0-8be8-4e0d-a39d-83d0e750b634.sql =====
ALTER TABLE public.attendance ADD COLUMN late_hours numeric NOT NULL DEFAULT 0;

-- ===== 20260406204243_e995c05f-36b9-42a3-8346-abb9f60c4853.sql =====
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

-- ===== 20260512145507_74585f83-0470-41c6-add4-ebdb00656962.sql =====

-- ============================================================
-- 1) APP ROLES + has_role()
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

DO $$ BEGIN
  CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2) update_updated_at_column()
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3) EMAIL MARKETING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  assunto TEXT NOT NULL,
  conteudo_html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_marketing_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  template_id UUID REFERENCES public.email_marketing_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  limite_diario INT NOT NULL DEFAULT 35,
  horario_inicio TEXT NOT NULL DEFAULT '08:00',
  horario_fim TEXT NOT NULL DEFAULT '18:00',
  enviados_hoje INT NOT NULL DEFAULT 0,
  ultimo_envio_dia DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_marketing_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_marketing_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ,
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, email)
);
ALTER TABLE public.email_marketing_recipients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage email_marketing_templates" ON public.email_marketing_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage email_marketing_campaigns" ON public.email_marketing_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage email_marketing_recipients" ON public.email_marketing_recipients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_email_marketing_templates_updated ON public.email_marketing_templates;
CREATE TRIGGER trg_email_marketing_templates_updated BEFORE UPDATE ON public.email_marketing_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_email_marketing_campaigns_updated ON public.email_marketing_campaigns;
CREATE TRIGGER trg_email_marketing_campaigns_updated BEFORE UPDATE ON public.email_marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) WHATSAPP MARKETING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  pre_link_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_marketing_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.whatsapp_marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  template_id UUID REFERENCES public.whatsapp_marketing_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho',
  limite_diario INTEGER NOT NULL DEFAULT 35,
  horario_inicio TEXT NOT NULL DEFAULT '08:00',
  horario_fim TEXT NOT NULL DEFAULT '18:00',
  enviados_hoje INTEGER NOT NULL DEFAULT 0,
  ultimo_envio_dia DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.whatsapp_marketing_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_marketing_campaigns(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  nome TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ,
  erro_mensagem TEXT,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  whatsapp_exists BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, telefone)
);
ALTER TABLE public.whatsapp_marketing_recipients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage whatsapp_marketing_templates" ON public.whatsapp_marketing_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage whatsapp_marketing_campaigns" ON public.whatsapp_marketing_campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage whatsapp_marketing_recipients" ON public.whatsapp_marketing_recipients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_whatsapp_marketing_templates_updated ON public.whatsapp_marketing_templates;
CREATE TRIGGER trg_whatsapp_marketing_templates_updated BEFORE UPDATE ON public.whatsapp_marketing_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_whatsapp_marketing_campaigns_updated ON public.whatsapp_marketing_campaigns;
CREATE TRIGGER trg_whatsapp_marketing_campaigns_updated BEFORE UPDATE ON public.whatsapp_marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) MARKETING SHARED — log + schedule settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_enviados_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  nome TEXT,
  template_usado TEXT,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_enviados_unique ON public.marketing_enviados_log (tipo, destinatario);
ALTER TABLE public.marketing_enviados_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins manage marketing_enviados_log" ON public.marketing_enviados_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.marketing_schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  daily_limit INTEGER NOT NULL DEFAULT 35,
  hourly_limit INTEGER NOT NULL DEFAULT 20,
  interval_seconds INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel)
);
ALTER TABLE public.marketing_schedule_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins manage marketing_schedule_settings" ON public.marketing_schedule_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.marketing_schedule_settings (channel, start_time, end_time, is_active, daily_limit, hourly_limit, interval_seconds)
VALUES ('email', '08:00', '18:00', true, 35, 20, 2),
       ('whatsapp', '08:00', '18:00', true, 40, 5, 300)
ON CONFLICT (channel) DO NOTHING;

-- ============================================================
-- 6) EMAIL AUTOMATION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_trigger INTEGER NOT NULL,
  assunto TEXT NOT NULL,
  conteudo_html TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dia_trigger)
);
ALTER TABLE public.email_automation_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_automation_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  nome TEXT,
  data_cadastro TIMESTAMPTZ NOT NULL,
  automacao_ativa BOOLEAN NOT NULL DEFAULT true,
  usuario_ativado BOOLEAN NOT NULL DEFAULT false,
  pausado BOOLEAN NOT NULL DEFAULT false,
  pacientes_cadastrados INTEGER NOT NULL DEFAULT 0,
  sessoes_registradas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.email_automation_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.email_automation_templates(id),
  dia_trigger INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  erro_mensagem TEXT,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_automation_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage email_automation_templates" ON public.email_automation_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage email_automation_users" ON public.email_automation_users FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage email_automation_logs" ON public.email_automation_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_email_automation_templates_updated ON public.email_automation_templates;
CREATE TRIGGER trg_email_automation_templates_updated BEFORE UPDATE ON public.email_automation_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_email_automation_users_updated ON public.email_automation_users;
CREATE TRIGGER trg_email_automation_users_updated BEFORE UPDATE ON public.email_automation_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_automation_templates (dia_trigger, assunto, conteudo_html) VALUES
(0, '🎉 Bem-vindo à Espetos & Cia! Seu período de teste começou', '<h2>Bem-vindo!</h2><p>Olá, {nome}! Que bom ter você por aqui.</p><p><a href="{dashboard_url}">Acessar minha conta →</a></p>'),
(1, '📋 Comece a usar a Espetos & Cia', '<h2>Hora de começar!</h2><p>Olá, {nome}! Cadastre seus primeiros itens para aproveitar a plataforma.</p><p><a href="{dashboard_url}">Acessar →</a></p>'),
(3, '🎯 Registre sua primeira operação', '<h2>Mãos à obra!</h2><p>Olá, {nome}! Registre sua primeira operação para sentir o valor da plataforma.</p><p><a href="{dashboard_url}">Registrar →</a></p>'),
(5, '⏰ Seu período de teste está avançando', '<h2>Faltam apenas 2 dias!</h2><p>Olá, {nome}! Aproveite os recursos avançados antes do fim do trial.</p><p><a href="{dashboard_url}">Acessar →</a></p>'),
(6, '⚠️ Último dia do seu período de teste', '<h2>Último dia!</h2><p>Olá, {nome}! Amanhã encerra seu período de teste.</p><p><a href="{dashboard_url}">Ver planos →</a></p>'),
(7, '🔒 Seu período de teste encerrou', '<h2>Trial encerrado</h2><p>Olá, {nome}! Ative seu plano para continuar.</p><p><a href="{dashboard_url}">Ativar plano →</a></p>'),
(9, '💬 Podemos te ajudar?', '<h2>Sentimos sua falta!</h2><p>Olá, {nome}! Notamos que você ainda não ativou seu plano. Conte conosco se precisar de ajuda.</p><p><a href="{dashboard_url}">Falar conosco →</a></p>')
ON CONFLICT (dia_trigger) DO NOTHING;

-- ============================================================
-- 7) LEAD FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'exit_intent',
  page_path TEXT,
  reason TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lead_feedback_created_at ON public.lead_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_feedback_source ON public.lead_feedback (source);

DO $$ BEGIN
  CREATE POLICY "Anyone can submit lead feedback" ON public.lead_feedback FOR INSERT TO anon, authenticated WITH CHECK (char_length(reason) BETWEEN 1 AND 500 AND char_length(source) <= 50);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins view lead_feedback" ON public.lead_feedback FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 8) STORAGE BUCKET email-assets
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Email assets are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'email-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins upload email-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins update email-assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins delete email-assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'email-assets' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 9) GRANT ADMIN to manfrotgn@gmail.com
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'manfrotgn@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- 10) Cron extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ===== 20260512164324_a0ae29fb-63b1-4581-8f6a-2e3943c3a0c7.sql =====

-- Replace admin-only policies with authenticated-user policies for marketing tables

-- email_marketing_templates
DROP POLICY IF EXISTS "Admins manage email_marketing_templates" ON public.email_marketing_templates;
CREATE POLICY "Authenticated manage email_marketing_templates" ON public.email_marketing_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- email_marketing_campaigns
DROP POLICY IF EXISTS "Admins manage email_marketing_campaigns" ON public.email_marketing_campaigns;
CREATE POLICY "Authenticated manage email_marketing_campaigns" ON public.email_marketing_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- email_marketing_recipients
DROP POLICY IF EXISTS "Admins manage email_marketing_recipients" ON public.email_marketing_recipients;
CREATE POLICY "Authenticated manage email_marketing_recipients" ON public.email_marketing_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- whatsapp_marketing_templates
DROP POLICY IF EXISTS "Admins manage whatsapp_marketing_templates" ON public.whatsapp_marketing_templates;
CREATE POLICY "Authenticated manage whatsapp_marketing_templates" ON public.whatsapp_marketing_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- whatsapp_marketing_campaigns
DROP POLICY IF EXISTS "Admins manage whatsapp_marketing_campaigns" ON public.whatsapp_marketing_campaigns;
CREATE POLICY "Authenticated manage whatsapp_marketing_campaigns" ON public.whatsapp_marketing_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- whatsapp_marketing_recipients
DROP POLICY IF EXISTS "Admins manage whatsapp_marketing_recipients" ON public.whatsapp_marketing_recipients;
CREATE POLICY "Authenticated manage whatsapp_marketing_recipients" ON public.whatsapp_marketing_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- email_automation_templates
DROP POLICY IF EXISTS "Admins manage email_automation_templates" ON public.email_automation_templates;
CREATE POLICY "Authenticated manage email_automation_templates" ON public.email_automation_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- email_automation_users
DROP POLICY IF EXISTS "Admins manage email_automation_users" ON public.email_automation_users;
CREATE POLICY "Authenticated manage email_automation_users" ON public.email_automation_users FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- email_automation_logs
DROP POLICY IF EXISTS "Admins manage email_automation_logs" ON public.email_automation_logs;
CREATE POLICY "Authenticated manage email_automation_logs" ON public.email_automation_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- marketing_enviados_log
DROP POLICY IF EXISTS "Admins manage marketing_enviados_log" ON public.marketing_enviados_log;
CREATE POLICY "Authenticated manage marketing_enviados_log" ON public.marketing_enviados_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- marketing_schedule_settings
DROP POLICY IF EXISTS "Admins manage marketing_schedule_settings" ON public.marketing_schedule_settings;
CREATE POLICY "Authenticated manage marketing_schedule_settings" ON public.marketing_schedule_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- lead_feedback (allow all authenticated to view)
DROP POLICY IF EXISTS "Admins view lead_feedback" ON public.lead_feedback;
CREATE POLICY "Authenticated view lead_feedback" ON public.lead_feedback FOR SELECT TO authenticated USING (true);


-- ===== 20261015120000_protege_tabelas_e_arquivos.sql =====
-- Segurança: estoque e compras de material só para usuários logados.
-- As policies antigas não tinham "TO authenticated" e valiam também para visitantes sem login.
DROP POLICY IF EXISTS "Authenticated can read inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated can delete inventory" ON public.inventory;
CREATE POLICY "Authenticated can read inventory" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert inventory" ON public.inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update inventory" ON public.inventory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete inventory" ON public.inventory FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read material_purchases" ON public.material_purchases;
DROP POLICY IF EXISTS "Authenticated can insert material_purchases" ON public.material_purchases;
DROP POLICY IF EXISTS "Authenticated can update material_purchases" ON public.material_purchases;
DROP POLICY IF EXISTS "Authenticated can delete material_purchases" ON public.material_purchases;
CREATE POLICY "Authenticated can read material_purchases" ON public.material_purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert material_purchases" ON public.material_purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update material_purchases" ON public.material_purchases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete material_purchases" ON public.material_purchases FOR DELETE TO authenticated USING (true);

-- Arquivos: visitantes sem login não podem mais LISTAR as notas fiscais nem as imagens de e-mail.
-- Os links já salvos continuam abrindo (os buckets seguem públicos para quem tem o link exato).
DROP POLICY IF EXISTS "Public can read invoices" ON storage.objects;
DROP POLICY IF EXISTS "Email assets are publicly accessible" ON storage.objects;

