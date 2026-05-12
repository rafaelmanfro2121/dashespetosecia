import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_EVOLUTION_API_URL = "https://api.dashespetosecia.lovable.app";

// ══════════════════════════════════════════════════════════
// HARD LIMITS — These CANNOT be changed by the user
// ══════════════════════════════════════════════════════════
const HARD_HOURLY_LIMIT = 5;           // Max 5 messages per hour
const HARD_DAILY_LIMIT = 40;           // Max 40 messages per day (5/h × 8h window)
const MIN_INTERVAL_SECONDS = 180;      // Minimum 3 minutes between messages
const MAX_INTERVAL_SECONDS = 720;      // Maximum 12 minutes between messages
const MIN_TYPING_MS = 3000;            // Minimum typing indicator
const MAX_TYPING_MS = 18000;           // Maximum typing indicator
// ══════════════════════════════════════════════════════════

function resolveEvolutionApiUrl(rawUrl?: string | null): string {
  const cleaned = rawUrl?.trim().replace(/\/+$/, "");
  if (!cleaned || cleaned.includes("/functions/v1/") || cleaned.includes("supabase.co") || cleaned.includes("lovableproject.com")) {
    return DEFAULT_EVOLUTION_API_URL;
  }
  return cleaned;
}

function normalizePhone(raw: string): string {
  let phone = raw.replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  while (phone.startsWith("55") && phone.length > 13) {
    const candidate = phone.slice(2);
    if (candidate.length < 10 || candidate.length > 13) break;
    phone = candidate;
  }
  if (!phone.startsWith("55") && (phone.length === 10 || phone.length === 11)) {
    phone = "55" + phone;
  }
  return phone;
}

/** Cryptographically random integer in [min, max] */
function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return min + (array[0] % range);
}

/** Generate a truly random delay between MIN and MAX interval */
function randomDelay(): number {
  return randomInt(MIN_INTERVAL_SECONDS, MAX_INTERVAL_SECONDS) * 1000;
}

/** Random typing duration proportional to message length */
function randomTypingDuration(messageLength: number): number {
  // Base: ~40-80ms per char, clamped to [MIN_TYPING, MAX_TYPING]
  const charRate = randomInt(40, 80);
  const raw = messageLength * charRate;
  return Math.max(MIN_TYPING_MS, Math.min(raw, MAX_TYPING_MS));
}

/** Apply subtle text variations to avoid identical messages */
function varyText(text: string): string {
  let t = text;
  const variations = [
    () => { if (Math.random() > 0.5 && t.includes("!")) t = t.replace(/!(?=[^\s])/, "! "); },
    () => { if (Math.random() > 0.5) t = t.replace(/\n\n/g, Math.random() > 0.5 ? "\n\n" : "\n \n"); },
    () => { if (Math.random() > 0.6) t = t + " "; },
    () => { if (Math.random() > 0.7 && t.includes("😊")) t = t.replace("😊", ["😄", "🙂", "☺️"][randomInt(0, 2)]); },
    () => { if (Math.random() > 0.7 && t.includes("🚀")) t = t.replace("🚀", ["💫", "⭐", "✨"][randomInt(0, 2)]); },
    () => { if (Math.random() > 0.7 && t.includes("👋")) t = t.replace("👋", ["🤝", "✋", "🖐️"][randomInt(0, 2)]); },
    () => { if (Math.random() > 0.5 && t.endsWith("!")) t = t.slice(0, -1) + "."; },
    () => { if (Math.random() > 0.6) t = t.replace(/\.\.\./g, "…"); },
  ];
  for (const v of variations) v();
  return t;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Brasília time helpers */
function getBrasiliaTime() {
  const now = new Date();
  const offset = -3 * 60;
  return new Date(now.getTime() + (now.getTimezoneOffset() + offset) * 60000);
}

function getBrasiliaTimeStr(dt: Date) {
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function getBrasiliaDateStr(dt: Date) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function isSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /No sessions/i.test(message);
}

// ── Main handler ─────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionApiUrl = resolveEvolutionApiUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Evolution API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Check pause state ──
    const { data: scheduleSettings } = await supabase
      .from("marketing_schedule_settings")
      .select("is_active, start_time, end_time")
      .eq("channel", "whatsapp")
      .single();

    const startTime = scheduleSettings?.start_time?.substring(0, 5) || "08:00";
    const endTime = scheduleSettings?.end_time?.substring(0, 5) || "18:00";
    const isActive = scheduleSettings?.is_active ?? true;

    if (!isActive) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "WhatsApp marketing is paused" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Time checks ──
    const brasiliaTime = getBrasiliaTime();
    const currentTimeStr = getBrasiliaTimeStr(brasiliaTime);

    let force = false;
    try { const body = await req.json(); force = body?.force === true; } catch { /* no body */ }

    if (!force && (currentTimeStr < startTime || currentTimeStr > endTime)) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: `Outside hours (${startTime}-${endTime}). Now: ${currentTimeStr}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── HARD daily limit (ignores DB settings) ──
    const todayStr = getBrasiliaDateStr(brasiliaTime);
    const dayStart = `${todayStr}T00:00:00-03:00`;
    const dayEnd = `${todayStr}T23:59:59-03:00`;

    const { count: sentToday } = await supabase
      .from("marketing_enviados_log")
      .select("*", { count: "exact", head: true })
      .eq("tipo", "whatsapp")
      .gte("enviado_em", dayStart)
      .lte("enviado_em", dayEnd);

    const alreadySentToday = sentToday ?? 0;
    if (alreadySentToday >= HARD_DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: `Daily limit reached (${alreadySentToday}/${HARD_DAILY_LIMIT})` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── HARD hourly limit ──
    const currentHour = brasiliaTime.getHours();
    const hourStart = `${todayStr}T${String(currentHour).padStart(2, "0")}:00:00-03:00`;
    const hourEnd = `${todayStr}T${String(currentHour).padStart(2, "0")}:59:59-03:00`;

    const { count: sentThisHour } = await supabase
      .from("marketing_enviados_log")
      .select("*", { count: "exact", head: true })
      .eq("tipo", "whatsapp")
      .gte("enviado_em", hourStart)
      .lte("enviado_em", hourEnd);

    const alreadySentHour = sentThisHour ?? 0;
    if (alreadySentHour >= HARD_HOURLY_LIMIT) {
      console.log(`[ANTI-BLOCK] Hourly limit hit: ${alreadySentHour}/${HARD_HOURLY_LIMIT}. Skipping.`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: `Hourly limit reached (${alreadySentHour}/${HARD_HOURLY_LIMIT})` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Check time since last sent message (enforce minimum gap) ──
    const { data: lastSent } = await supabase
      .from("marketing_enviados_log")
      .select("enviado_em")
      .eq("tipo", "whatsapp")
      .order("enviado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSent) {
      const lastSentTime = new Date(lastSent.enviado_em).getTime();
      const nowMs = Date.now();
      const elapsedSeconds = (nowMs - lastSentTime) / 1000;

      if (elapsedSeconds < MIN_INTERVAL_SECONDS) {
        const waitMore = Math.ceil(MIN_INTERVAL_SECONDS - elapsedSeconds);
        console.log(`[ANTI-BLOCK] Last message sent ${Math.round(elapsedSeconds)}s ago. Need ${MIN_INTERVAL_SECONDS}s gap. Waiting.`);
        return new Response(
          JSON.stringify({ success: true, sent: 0, message: `Minimum interval not met. Wait ${waitMore}s more.` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Templates ──
    const { data: allTemplates } = await supabase
      .from("whatsapp_marketing_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (!allTemplates || allTemplates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No templates configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick a random template
    const shuffledTemplates = shuffle([...allTemplates]);
    const currentTemplate = shuffledTemplates[0];

    // ── Get ONE validated recipient ──
    const { data: recipients, error: recError } = await supabase
      .from("whatsapp_marketing_recipients")
      .select("*")
      .eq("status", "pendente")
      .eq("is_validated", true)
      .eq("whatsapp_exists", true)
      .limit(1);

    if (recError || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No validated pending recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipient = recipients[0];

    try {
      // Build message with name + variation
      let message = currentTemplate.conteudo.replace(/\{nome\}/g, recipient.nome || "");
      message = varyText(message);

      const phone = normalizePhone(recipient.telefone);
      const imageUrl: string | null = currentTemplate.image_url || null;
      const preLinkMessage: string | null = (currentTemplate.pre_link_message || "").trim() || null;
      const linkUrl: string | null = currentTemplate.link_url || null;

      // Helper: send presence safely
      const sendPresence = async (presence: "composing" | "paused") => {
        try {
          await fetch(`${evolutionApiUrl}/chat/sendPresence/espetos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
            body: JSON.stringify({ number: phone, presence }),
          });
        } catch (e) { console.warn("Presence error (non-fatal):", e); }
      };

      // ── Random pre-send delay (simulates "opening the chat") ──
      const preSendDelay = randomInt(2000, 8000);
      console.log(`[ANTI-BLOCK] Pre-send delay: ${Math.round(preSendDelay / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, preSendDelay));

      // ── STEP 1: Typing + send TEXT message ──
      const typingMs = randomTypingDuration(message.length);
      console.log(`[ANTI-BLOCK] Typing for text: ${Math.round(typingMs / 1000)}s`);
      await sendPresence("composing");
      await new Promise(resolve => setTimeout(resolve, typingMs));

      // Sometimes pause typing then resume (human behavior)
      if (Math.random() > 0.6) {
        await sendPresence("paused");
        await new Promise(resolve => setTimeout(resolve, randomInt(1500, 4000)));
        await sendPresence("composing");
        await new Promise(resolve => setTimeout(resolve, randomInt(2000, 5000)));
      }

      const textResponse = await fetch(`${evolutionApiUrl}/message/sendText/espetos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({ number: phone, textMessage: { text: message } }),
      });

      if (!textResponse.ok) {
        const errText = await textResponse.text();
        throw new Error(`Evolution API (text) ${textResponse.status}: ${errText}`);
      }
      await textResponse.json();
      console.log(`[SEQ] Text sent to ${phone}`);

      // ── STEP 2: Image (optional) ──
      if (imageUrl) {
        // Human pause between text and image (reading time)
        await new Promise(resolve => setTimeout(resolve, randomInt(4000, 10000)));
        await sendPresence("composing");
        // "Selecting/uploading image" pause
        await new Promise(resolve => setTimeout(resolve, randomInt(3500, 7000)));

        const mediaResp = await fetch(`${evolutionApiUrl}/message/sendMedia/espetos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
          body: JSON.stringify({
            number: phone,
            mediaMessage: {
              mediatype: "image",
              media: imageUrl,
              fileName: "espetos.jpg",
            },
          }),
        });
        if (!mediaResp.ok) {
          const errText = await mediaResp.text();
          // Non-fatal: log but continue (we already sent the text)
          console.warn(`[SEQ] Image send failed (non-fatal) ${mediaResp.status}: ${errText}`);
        } else {
          await mediaResp.json().catch(() => null);
          console.log(`[SEQ] Image sent to ${phone}`);
        }
      }

      // ── STEP 3: Pre-link message (optional) ──
      if (preLinkMessage && linkUrl) {
        await new Promise(resolve => setTimeout(resolve, randomInt(3500, 7000)));
        await sendPresence("composing");
        const preTyping = randomTypingDuration(preLinkMessage.length);
        await new Promise(resolve => setTimeout(resolve, preTyping));

        const preResp = await fetch(`${evolutionApiUrl}/message/sendText/espetos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
          body: JSON.stringify({
            number: phone,
            textMessage: { text: varyText(preLinkMessage) },
            options: { linkPreview: false },
          }),
        });
        if (!preResp.ok) {
          console.warn(`[SEQ] Pre-link msg failed (non-fatal) ${preResp.status}: ${await preResp.text()}`);
        } else {
          await preResp.json().catch(() => null);
          console.log(`[SEQ] Pre-link msg sent to ${phone}`);
        }
      }

      // ── STEP 4: Link (optional, separate message, NO preview) ──
      if (linkUrl) {
        await new Promise(resolve => setTimeout(resolve, randomInt(2500, 5000)));
        await sendPresence("composing");
        await new Promise(resolve => setTimeout(resolve, randomInt(1500, 3500)));

        const linkResp = await fetch(`${evolutionApiUrl}/message/sendText/espetos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
          body: JSON.stringify({
            number: phone,
            textMessage: { text: linkUrl },
            options: { linkPreview: false },
          }),
        });
        if (!linkResp.ok) {
          const errText = await linkResp.text();
          console.warn(`[SEQ] Link send failed (non-fatal) ${linkResp.status}: ${errText}`);
        } else {
          await linkResp.json().catch(() => null);
          console.log(`[SEQ] Link sent to ${phone}`);
        }
      }

      await sendPresence("paused");

      // Log success
      await supabase.from("marketing_enviados_log").insert({
        tipo: "whatsapp",
        destinatario: phone,
        nome: recipient.nome,
        template_usado: currentTemplate.nome,
        enviado_em: new Date().toISOString(),
      });

      // Remove from queue
      await supabase.from("whatsapp_marketing_recipients").delete().eq("id", recipient.id);

      const nextDelay = randomDelay();
      console.log(`[ANTI-BLOCK] Message sent to ${phone}. Next eligible in ~${Math.round(nextDelay / 60000)}min`);

      return new Response(
        JSON.stringify({
          success: true,
          sent: 1,
          errors: 0,
          dailyUsage: `${alreadySentToday + 1}/${HARD_DAILY_LIMIT}`,
          hourlyUsage: `${alreadySentHour + 1}/${HARD_HOURLY_LIMIT}`,
          nextEligibleIn: `${Math.round(nextDelay / 1000)}s`,
          schedule: `${startTime}-${endTime} Brasília`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (sendError) {
      if (isSessionError(sendError)) {
        console.error("[ANTI-BLOCK] Session error — stopping:", sendError);
        return new Response(
          JSON.stringify({
            success: false, sent: 0, errors: 1,
            error: "Instância do WhatsApp sem sessão ativa. Contatos mantidos na fila.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error(`Error sending to ${recipient.telefone}:`, sendError);
      await supabase.from("whatsapp_marketing_recipients").update({
        status: "erro",
        erro_mensagem: sendError instanceof Error ? sendError.message.substring(0, 500) : "Unknown error",
      }).eq("id", recipient.id);

      return new Response(
        JSON.stringify({ success: true, sent: 0, errors: 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("WhatsApp Marketing error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
