// Envia as vendas fechadas para a Conversions API da Meta.
// POST { action: "process" }    → envia as vendas com status "pendente"
// POST { action: "reprocess" }  → envia "pendente" e "erro"
// Acesso: usuário logado no sistema (Authorization: Bearer <token da sessão>)
//         ou cabeçalho x-cron-secret igual ao secret CRON_SECRET (para agendamentos).
// Regras: nunca logar dados de cliente nem payload; só o ID interno da venda.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildPurchaseEvent, isClosedSale, type CapiEvent, type SaleRow } from '../_shared/meta.ts';

const PIXEL_ID = '2634272570340582';
const ENDPOINT = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
const BATCH_LIMIT = 1000;
const MAX_ATTEMPTS = 3;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type MetaReply = { events_received?: number; fbtrace_id?: string; messages?: unknown[] };
type SendResult = { ok: true; reply: MetaReply } | { ok: false; retryable: boolean; message: string };

async function postToMeta(events: CapiEvent[], token: string, testCode: string | undefined): Promise<SendResult> {
  const body = JSON.stringify({
    data: events,
    access_token: token,
    ...(testCode ? { test_event_code: testCode } : {}),
  });

  let lastMessage = 'falha de rede';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const payload = await res.json().catch(() => null);
      if (res.ok) return { ok: true, reply: payload ?? {} };
      const metaError = payload?.error;
      const message = `HTTP ${res.status}${metaError?.message ? `: ${String(metaError.message).slice(0, 300)}` : ''}`;
      if (res.status >= 400 && res.status < 500) return { ok: false, retryable: false, message };
      lastMessage = message;
    } catch {
      lastMessage = 'falha de rede';
    }
  }
  return { ok: false, retryable: true, message: lastMessage };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Autorização
  const cronSecret = Deno.env.get('CRON_SECRET');
  let authorized = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
  if (!authorized) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (jwt) {
      const { data } = await admin.auth.getUser(jwt);
      authorized = !!data?.user;
    }
  }
  if (!authorized) return json({ error: 'Não autorizado' }, 401);

  const token = Deno.env.get('META_CAPI_TOKEN');
  if (!token) return json({ error: 'META_CAPI_TOKEN não configurado no Supabase' }, 500);
  const testCode = Deno.env.get('META_TEST_EVENT_CODE') || undefined;
  const actionSource = Deno.env.get('META_ACTION_SOURCE') || 'chat';

  const { action = 'process' } = await req.json().catch(() => ({}));

  // Teste: envia a última venda fechada só para o "Eventos de teste", sem mudar o status dela.
  if (action === 'test') {
    if (!testCode) return json({ error: 'Para testar, crie o secret META_TEST_EVENT_CODE no Supabase.' }, 400);
    const { data: latest } = await admin
      .from('service_orders')
      .select('id, cliente_nome, cliente_telefone, cliente_email, cliente_contato, total, payment_status, order_status, atendimento_data')
      .in('payment_status', ['pago', 'parcial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) return json({ error: 'Nenhuma venda fechada para testar.' }, 404);
    const event = await buildPurchaseEvent(latest as SaleRow, new Date(), actionSource);
    if (!event) return json({ error: 'A última venda não tem telefone nem e-mail válido.' }, 422);
    const result = await postToMeta([event], token, testCode);
    if (!result.ok) {
      console.error(`[meta-capi] teste falhou para a venda ${latest.id}`);
      return json({ test: true, actionSource, sent: 0, found: 1, errors: 1, pending: 0, metaError: result.message });
    }
    return json({
      test: true, actionSource, found: 1, sent: 1, errors: 0, pending: 0,
      metaEventsReceived: result.reply.events_received ?? 0,
      fbtraceId: result.reply.fbtrace_id ?? null,
      metaMessages: result.reply.messages ?? [],
    });
  }
  const statuses = action === 'reprocess' ? ['pendente', 'erro'] : ['pendente'];

  const { data: rows, error } = await admin
    .from('service_orders')
    .select('id, cliente_nome, cliente_telefone, cliente_email, cliente_contato, total, payment_status, order_status, atendimento_data, meta_capi_event_time, created_at')
    .in('meta_capi_status', statuses)
    .order('meta_capi_event_time', { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) return json({ error: 'Erro ao ler vendas' }, 500);

  const now = new Date().toISOString();
  const mark = (ids: string[], fields: Record<string, unknown>) =>
    ids.length ? admin.from('service_orders').update({ ...fields, meta_capi_attempted_at: now }).in('id', ids) : null;

  const events: CapiEvent[] = [];
  const skippedCancelled: string[] = [];
  const noIdentifiers: string[] = [];

  for (const row of rows ?? []) {
    if (!isClosedSale(row as SaleRow)) { skippedCancelled.push(row.id); continue; }
    const eventTime = new Date(row.meta_capi_event_time ?? row.created_at);
    const event = await buildPurchaseEvent(row as SaleRow, eventTime, actionSource);
    if (event) events.push(event); else noIdentifiers.push(row.id);
  }

  await mark(skippedCancelled, { meta_capi_status: null, meta_capi_error: null });
  await mark(noIdentifiers, { meta_capi_status: 'erro', meta_capi_error: 'Sem telefone ou e-mail válido' });

  const summary = {
    found: rows?.length ?? 0, sent: 0, errors: noIdentifiers.length, pending: 0,
    test: !!testCode, actionSource, metaEventsReceived: 0, fbtraceId: null as string | null,
  };
  if (events.length === 0) return json(summary);

  const batch = await postToMeta(events, token, testCode);
  if (batch.ok) {
    await mark(events.map(e => e.event_id), { meta_capi_status: 'enviado', meta_capi_error: null, meta_capi_sent_at: now });
    summary.sent = events.length;
    summary.metaEventsReceived = batch.reply.events_received ?? 0;
    summary.fbtraceId = batch.reply.fbtrace_id ?? null;
    return json(summary);
  }

  if (batch.retryable || events.length === 1) {
    const ids = events.map(e => e.event_id);
    if (batch.retryable) {
      await mark(ids, { meta_capi_status: 'pendente', meta_capi_error: `Falha temporária: ${batch.message}` });
      summary.pending = ids.length;
    } else {
      await mark(ids, { meta_capi_status: 'erro', meta_capi_error: batch.message });
      summary.errors += ids.length;
    }
    console.error(`[meta-capi] falha no envio de ${ids.length} venda(s): ${ids.join(', ')}`);
    return json(summary);
  }

  // A Meta recusou o lote (4xx): envia um a um para achar qual venda tem problema.
  for (const event of events) {
    const one = await postToMeta([event], token, testCode);
    if (one.ok) {
      await mark([event.event_id], { meta_capi_status: 'enviado', meta_capi_error: null, meta_capi_sent_at: now });
      summary.sent++;
      summary.metaEventsReceived += one.reply.events_received ?? 0;
    } else {
      await mark([event.event_id], {
        meta_capi_status: one.retryable ? 'pendente' : 'erro',
        meta_capi_error: one.retryable ? `Falha temporária: ${one.message}` : one.message,
      });
      if (one.retryable) summary.pending++; else summary.errors++;
      console.error(`[meta-capi] falha no envio da venda ${event.event_id}`);
    }
  }
  return json(summary);
});
