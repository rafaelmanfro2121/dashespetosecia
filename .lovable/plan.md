## Objetivo

Trazer do projeto **Lumia** os 5 componentes de marketing + 4 edge functions + schema completo do banco + cron jobs, integrando ao menu lateral do Espetos & Cia. Visual será adaptado à paleta atual do Espetos (sem trazer cores do Lumia). Toda a estrutura ficará pronta — só faltará configurar as chaves `RESEND_API_KEY` e `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` depois.

## Escopo da migração

### 1. Schema do banco (1 migration grande)

Tabelas a criar:

- `app_role` enum (`admin`, `user`) + `user_roles` + função `has_role()`
- `update_updated_at_column()` (caso ainda não exista)
- `email_marketing_templates`, `email_marketing_campaigns`, `email_marketing_recipients`
- `whatsapp_marketing_templates`, `whatsapp_marketing_campaigns`, `whatsapp_marketing_recipients` (+ colunas extras: `is_validated`, `whatsapp_exists`)
- `marketing_enviados_log` (com índice único `tipo+destinatario`)
- `marketing_schedule_settings` (com colunas extras `hourly_limit`)
- `email_automation_templates`, `email_automation_users`, `email_automation_logs`
- `lead_feedback`
- Storage bucket público `email-assets`
- Seed inicial dos 7 templates de automação (dia 0/1/3/5/6/7/9) com conteúdo placeholder

RLS: tudo `has_role(auth.uid(), 'admin')`. Manfrotgn ganha role admin via insert.

### 2. Edge functions (4)

Cópia integral de `supabase/functions/`:
- `send-marketing-emails` (usa Resend)
- `send-whatsapp-marketing` (usa Evolution API + anti-block)
- `validate-whatsapp-numbers` (Evolution API)
- `test-whatsapp-marketing-send`

`config.toml` ganha blocos `[functions.<nome>] verify_jwt = false` para os crons.

### 3. Cron jobs

Via `supabase--insert` (não migration, conforme guideline de URLs/anon keys):
- `pg_cron` + `pg_net` extensions
- Job a cada 5 min chamando `send-marketing-emails`
- Job a cada 5 min chamando `send-whatsapp-marketing`

### 4. Frontend

Cópia dos 5 componentes para `src/components/admin/`:
- `EmailMarketing.tsx` (~1114 linhas)
- `EmailAutomation.tsx` (~628 linhas)
- `WhatsAppMarketing.tsx` (~973 linhas)
- `MarketingSchedule.tsx` (313 linhas)
- `LeadFeedbacks.tsx` (182 linhas)

Adaptações mínimas:
- Trocar referências `LUMIA`/`applumia.com.br` por **Espetos & Cia** / `dashespetosecia.lovable.app`
- Manter classes Tailwind semânticas — onde houver cor hard-coded (ex: `bg-emerald-500`, `text-sky-500`), trocar por tokens do Espetos (`primary`, `accent`, `muted`)
- CTA padrão dos emails apontará para o site do Espetos

Nova página `src/pages/Marketing.tsx` com Tabs: Email Marketing | WhatsApp Marketing | Automações de Email | Configurações de Envio | Feedbacks.

### 5. Navegação

Adicionar item "Marketing" (ícone `Megaphone`) no `AppLayout.tsx`. Rota `/marketing` no `App.tsx`. Como sistema é interno, basta autenticação (sem gating por role no frontend — RLS no banco já protege).

## Arquivos novos / modificados

```text
supabase/migrations/<timestamp>_marketing_module.sql        (novo)
supabase/config.toml                                        (add 4 blocos)
supabase/functions/send-marketing-emails/index.ts           (novo)
supabase/functions/send-whatsapp-marketing/index.ts         (novo)
supabase/functions/validate-whatsapp-numbers/index.ts       (novo)
supabase/functions/test-whatsapp-marketing-send/index.ts    (novo)
src/components/admin/EmailMarketing.tsx                     (novo)
src/components/admin/EmailAutomation.tsx                    (novo)
src/components/admin/WhatsAppMarketing.tsx                  (novo)
src/components/admin/MarketingSchedule.tsx                  (novo)
src/components/admin/LeadFeedbacks.tsx                      (novo)
src/pages/Marketing.tsx                                     (novo)
src/App.tsx                                                 (rota)
src/components/AppLayout.tsx                                (item de menu)
```

## O que NÃO faz parte

- Configurar `RESEND_API_KEY` / `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` — você fará via tela de secrets quando quiser começar a disparar de fato.
- Mudar paleta de cores do Espetos.
- Reescrever lógica dos componentes (vão ser cópias diretas do Lumia para garantir paridade total de funcionalidade).

## Riscos

- Os componentes do Lumia referenciam algumas tabelas/funções específicas (ex.: `email-assets` bucket). A migration cobre todas elas.
- O bucket de upload de imagens precisa existir antes do primeiro template ser salvo — incluso na migration.
- A migration é grande (~400 linhas). Se algo falhar no apply, eu corrijo e re-aplico em uma migration de patch.

## Confirmação

Posso prosseguir com essa execução completa? É uma operação grande — confirmando, executo migration → deploy edges → cron jobs → componentes → menu, em sequência.
