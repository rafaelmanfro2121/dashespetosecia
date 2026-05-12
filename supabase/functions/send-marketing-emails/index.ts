import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, details?: Record<string, unknown>) => {
  console.log(`[MARKETING-EMAILS] ${msg}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Load schedule settings from DB
    const { data: scheduleSettings } = await supabase
      .from("marketing_schedule_settings")
      .select("*")
      .eq("channel", "email")
      .single();

    const startTime = scheduleSettings?.start_time?.substring(0, 5) || "08:00";
    const endTime = scheduleSettings?.end_time?.substring(0, 5) || "18:00";
    const isActive = scheduleSettings?.is_active ?? true;
    const dailyLimit = scheduleSettings?.daily_limit ?? 35;
    const intervalSeconds = scheduleSettings?.interval_seconds ?? 2;

    // Check if dispatching is enabled
    if (!isActive) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Email marketing is paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check Brasília time
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const brasiliaTime = new Date(now.getTime() + (now.getTimezoneOffset() + brasiliaOffset) * 60000);
    const currentHour = brasiliaTime.getHours();
    const currentMinute = brasiliaTime.getMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* ok */ }
    const forceRun = body.force === true;

    // Only send during configured business hours unless forced
    if (!forceRun && (currentTimeStr < startTime || currentTimeStr > endTime)) {
      return new Response(JSON.stringify({ 
        success: true, sent: 0, 
        message: `Outside business hours (${startTime}-${endTime} Brasília). Current: ${currentTimeStr}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // *** DAILY LIMIT CHECK ***
    // Count how many emails were already sent TODAY (Brasília timezone)
    const todayBrasilia = `${brasiliaTime.getFullYear()}-${String(brasiliaTime.getMonth() + 1).padStart(2, "0")}-${String(brasiliaTime.getDate()).padStart(2, "0")}`;
    const startOfDay = `${todayBrasilia}T00:00:00-03:00`;
    const endOfDay = `${todayBrasilia}T23:59:59-03:00`;

    const { count: sentToday } = await supabase
      .from("marketing_enviados_log")
      .select("*", { count: "exact", head: true })
      .eq("tipo", "email")
      .gte("enviado_em", startOfDay)
      .lte("enviado_em", endOfDay);

    const alreadySent = sentToday ?? 0;
    const remaining = Math.max(0, dailyLimit - alreadySent);

    if (remaining <= 0) {
      log("Daily limit reached", { dailyLimit, alreadySent });
      return new Response(JSON.stringify({ 
        success: true, sent: 0, 
        message: `Daily limit reached (${alreadySent}/${dailyLimit})` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resend setup
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "No email provider configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendKey);

    // Load all templates for rotation
    const { data: allTemplates } = await supabase
      .from("email_marketing_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (!allTemplates || allTemplates.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No templates configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pending recipients, limited by REMAINING daily quota
    const { data: recipients, error: recErr } = await supabase
      .from("email_marketing_recipients")
      .select("*")
      .eq("status", "pendente")
      .limit(remaining);

    if (recErr || !recipients || recipients.length === 0) {
      log("No pending recipients");
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No pending recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalErrors = 0;
    let templateIndex = 0;

    for (const recipient of recipients) {
      // Double-check we haven't exceeded the limit during this run
      if (alreadySent + totalSent >= dailyLimit) {
        log("Daily limit reached mid-run", { dailyLimit, sent: totalSent });
        break;
      }

      const currentTemplate = allTemplates[templateIndex % allTemplates.length];
      templateIndex++;

      const recipientName = recipient.nome || recipient.email.split("@")[0];

      const htmlContent = (currentTemplate.conteudo_html as string)
        .replace(/{nome}/g, recipientName)
        .replace(/{email}/g, recipient.email);

      const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#1a9a8a 0%,#22b8a5 100%);padding:30px;border-radius:16px 16px 0 0;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">ESPETOS &amp; CIA</h1>
<p style="color:rgba(255,255,255,0.9);margin:5px 0 0;font-size:13px;">Espetos personalizados</p>
</td></tr>
<tr><td style="padding:35px 30px;">${htmlContent}</td></tr>
<tr><td style="background-color:#f0faf8;padding:25px 30px;border-radius:0 0 16px 16px;text-align:center;">
<p style="color:#7fa8a0;font-size:12px;margin:0;">© ${new Date().getFullYear()} Espetos &amp; Cia · dashespetosecia.lovable.app</p>
</td></tr></table></td></tr></table></body></html>`;

      const subject = (currentTemplate.assunto as string)
        .replace(/{nome}/g, recipientName);

      try {
        await resend.emails.send({
          from: "Espetos &amp; Cia <contato@dashespetosecia.lovable.app>",
          to: [recipient.email],
          subject,
          html: fullHtml,
        });

        // Log in permanent sent log
        await supabase
          .from("marketing_enviados_log")
          .upsert({
            tipo: "email",
            destinatario: recipient.email.toLowerCase(),
            nome: recipient.nome,
            template_usado: currentTemplate.nome,
            enviado_em: new Date().toISOString(),
          }, { onConflict: "tipo,destinatario" });

        // DELETE the recipient after successful send
        await supabase
          .from("email_marketing_recipients")
          .delete()
          .eq("id", recipient.id);

        totalSent++;

        // Configurable delay between sends
        await new Promise(r => setTimeout(r, intervalSeconds * 1000));

      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        totalErrors++;
        await supabase
          .from("email_marketing_recipients")
          .update({ status: "erro", erro_mensagem: errorMsg })
          .eq("id", recipient.id);
        log("Send error", { email: recipient.email, error: errorMsg });
      }
    }

    log("Processing complete", { totalSent, totalErrors, alreadySent, dailyLimit, schedule: `${startTime}-${endTime}` });

    return new Response(JSON.stringify({
      success: true,
      sent: totalSent,
      errors: totalErrors,
      dailyUsage: `${alreadySent + totalSent}/${dailyLimit}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
