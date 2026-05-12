
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
