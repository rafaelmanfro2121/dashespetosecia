import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_EVOLUTION_API_URL = "https://api.applumia.com.br";

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
  if (!phone.startsWith("55") && (phone.length === 10 || phone.length === 11)) {
    phone = "55" + phone;
  }
  return phone;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone, templateId, nome } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const evolutionApiUrl = resolveEvolutionApiUrl(Deno.env.get("EVOLUTION_API_URL"));
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const { data: template, error } = await supabase
      .from("whatsapp_marketing_templates")
      .select("*")
      .eq("id", templateId)
      .single();
    if (error || !template) throw new Error("Template not found");

    const normalized = normalizePhone(phone);
    const message = (template.conteudo || "").replace(/\{nome\}/g, nome || "");
    const steps: any[] = [];

    const sendPresence = async (presence: "composing" | "paused") => {
      try {
        await fetch(`${evolutionApiUrl}/chat/sendPresence/applumia`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
          body: JSON.stringify({ number: normalized, presence }),
        });
      } catch (e) { /* non-fatal */ }
    };

    // Step 1: text
    await sendPresence("composing");
    await new Promise(r => setTimeout(r, randomInt(2000, 4000)));
    const textRes = await fetch(`${evolutionApiUrl}/message/sendText/applumia`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
      body: JSON.stringify({ number: normalized, textMessage: { text: message } }),
    });
    steps.push({ step: "text", status: textRes.status, body: await textRes.text() });

    // Step 2: image
    if (template.image_url) {
      await new Promise(r => setTimeout(r, randomInt(3000, 5000)));
      await sendPresence("composing");
      await new Promise(r => setTimeout(r, randomInt(2000, 4000)));
      const mediaRes = await fetch(`${evolutionApiUrl}/message/sendMedia/applumia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({
          number: normalized,
          mediaMessage: {
            mediatype: "image",
            media: template.image_url,
            fileName: "lumia.jpg",
          },
        }),
      });
      steps.push({ step: "image", status: mediaRes.status, body: await mediaRes.text() });
    }

    // Step 3: pre-link message
    if (template.pre_link_message && template.link_url) {
      await new Promise(r => setTimeout(r, randomInt(3000, 5000)));
      await sendPresence("composing");
      await new Promise(r => setTimeout(r, randomInt(1500, 3000)));
      const preRes = await fetch(`${evolutionApiUrl}/message/sendText/applumia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({
          number: normalized,
          textMessage: { text: template.pre_link_message },
          options: { linkPreview: false },
        }),
      });
      steps.push({ step: "pre_link", status: preRes.status, body: await preRes.text() });
    }

    // Step 4: link (no preview)
    if (template.link_url) {
      await new Promise(r => setTimeout(r, randomInt(2000, 4000)));
      await sendPresence("composing");
      await new Promise(r => setTimeout(r, randomInt(1500, 3000)));
      const linkRes = await fetch(`${evolutionApiUrl}/message/sendText/applumia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({
          number: normalized,
          textMessage: { text: template.link_url },
          options: { linkPreview: false },
        }),
      });
      steps.push({ step: "link", status: linkRes.status, body: await linkRes.text() });
    }

    await sendPresence("paused");

    return new Response(JSON.stringify({ success: true, normalized, template: template.nome, steps }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
