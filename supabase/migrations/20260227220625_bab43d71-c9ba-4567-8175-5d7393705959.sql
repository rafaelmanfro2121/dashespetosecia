
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
