import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_EVOLUTION_API_URL = 'https://api.applumia.com.br';

function resolveEvolutionApiUrl(rawUrl?: string | null): string {
  const cleaned = rawUrl?.trim().replace(/\/+$/, '');
  if (!cleaned || cleaned.includes('/functions/v1/') || cleaned.includes('supabase.co') || cleaned.includes('lovableproject.com')) {
    return DEFAULT_EVOLUTION_API_URL;
  }
  return cleaned;
}

function normalizePhone(raw: string): string {
  let phone = raw.replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);

  while (phone.startsWith('55') && phone.length > 13) {
    const candidate = phone.slice(2);
    if (candidate.length < 10 || candidate.length > 13) break;
    phone = candidate;
  }

  if (!phone.startsWith('55') && (phone.length === 10 || phone.length === 11)) {
    phone = `55${phone}`;
  }

  return phone;
}

function safeParseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function hasNoSession(rawText: string, payload: unknown): boolean {
  return /No sessions/i.test(`${rawText} ${JSON.stringify(payload ?? null)}`);
}

async function ensureValidationSession(evolutionApiUrl: string, evolutionApiKey: string) {
  const response = await fetch(`${evolutionApiUrl}/chat/whatsappNumbers/applumia`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: evolutionApiKey,
    },
    body: JSON.stringify({ numbers: ['5511999999999'] }),
  });

  const rawText = await response.text();
  const payload = safeParseJson(rawText);

  if ((payload as Record<string, unknown> | null)?.event === 'unknown') {
    return { ok: false, error: 'URL da Evolution inválida' };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: hasNoSession(rawText, payload)
        ? 'Instância do WhatsApp sem sessão ativa'
        : `Falha ao verificar sessão do WhatsApp (${response.status})`,
    };
  }

  return { ok: true, error: null };
}

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

    const sessionCheck = await ensureValidationSession(evolutionApiUrl, evolutionApiKey);
    if (!sessionCheck.ok) {
      return new Response(
        JSON.stringify({ success: false, error: sessionCheck.error }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unvalidated pending recipients
    const { data: recipients, error: recError } = await supabase
      .from("whatsapp_marketing_recipients")
      .select("id, telefone, nome")
      .eq("status", "pendente")
      .eq("is_validated", false)
      .order("created_at", { ascending: true })
      .limit(200);

    if (recError || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, validated: 0, valid: 0, invalid: 0, message: "No numbers to validate" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalValid = 0;
    let totalInvalid = 0;
    const BATCH_SIZE = 20;
    const BATCH_DELAY_MS = 5000;

    // Process in batches of 20
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      // Normalize phones for the batch
      const phones = batch.map(r => normalizePhone(r.telefone));

      try {
        // Call Evolution API to check WhatsApp numbers
        const response = await fetch(`${evolutionApiUrl}/chat/whatsappNumbers/applumia`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionApiKey,
          },
          body: JSON.stringify({ numbers: phones }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Evolution API validation error: ${response.status} - ${errText}`);
          if (hasNoSession(errText, null)) {
            return new Response(
              JSON.stringify({
                success: false,
                validated: totalValid + totalInvalid,
                valid: totalValid,
                invalid: totalInvalid,
                error: 'Instância do WhatsApp sem sessão ativa',
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // DON'T mark as validated on API error - leave for retry
          continue;
        }

        const rawText = await response.text();
        const rawResult = safeParseJson(rawText);
        const rawObject = rawResult && typeof rawResult === "object"
          ? rawResult as Record<string, unknown>
          : null;
        const result = Array.isArray(rawResult)
          ? rawResult
          : Array.isArray(rawObject?.data)
            ? rawObject.data
            : Array.isArray(rawObject?.numbers)
              ? rawObject.numbers
              : [];

        if (result.length === 0) {
          console.error("Unexpected validation payload:", rawResult);
          continue;
        }

        // result is typically an array of { exists: boolean, jid: string, number: string }
        const validNumbers = new Set<string>();
        const invalidNumbers = new Set<string>();

        if (Array.isArray(result)) {
          for (const item of result) {
            const resolvedNumber = typeof item?.number === "string"
              ? normalizePhone(item.number)
              : typeof item?.jid === "string"
                ? normalizePhone(item.jid.split("@")[0])
                : "";

            if (!resolvedNumber) continue;

            if (item?.exists === true || item?.valid === true || item?.isValid === true) {
              validNumbers.add(resolvedNumber);
            } else if (item?.exists === false || item?.valid === false || item?.isValid === false) {
              invalidNumbers.add(resolvedNumber);
            }
          }
        }

        // Update each recipient in the batch
        for (let j = 0; j < batch.length; j++) {
          const phone = phones[j];
          const exists = validNumbers.has(phone);
          const notExists = invalidNumbers.has(phone);

          if (exists) {
            await supabase
              .from("whatsapp_marketing_recipients")
              .update({ is_validated: true, whatsapp_exists: true })
              .eq("id", batch[j].id);
            totalValid++;
          } else if (notExists) {
            await supabase
              .from("whatsapp_marketing_recipients")
              .update({
                is_validated: true,
                whatsapp_exists: false,
                status: "invalido",
                erro_mensagem: "Número não possui WhatsApp",
              })
              .eq("id", batch[j].id);
            totalInvalid++;
          }
        }
      } catch (batchErr) {
        console.error("Batch validation error:", batchErr);
        // DON'T mark as validated on error - leave for retry
        console.log(`Skipping batch due to error, ${batch.length} numbers will be retried`)
      }

      // Delay between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        validated: totalValid + totalInvalid,
        valid: totalValid,
        invalid: totalInvalid,
        pending: recipients.length - (totalValid + totalInvalid),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});