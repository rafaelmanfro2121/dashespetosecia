
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
