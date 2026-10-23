import { supabase } from '@/integrations/supabase/client';
import { aggregateCustomers, toCsv, type ExportStats, type SaleRow } from '../../supabase/functions/_shared/meta';

export interface CapiSummary {
  found: number;
  sent: number;
  errors: number;
  pending: number;
  test: boolean;
  actionSource?: string;
  metaEventsReceived?: number;
  fbtraceId?: string | null;
  metaError?: string;
  metaMessages?: unknown[];
}

/** Pede à Edge Function para enviar as vendas pendentes (ou também as com erro). */
export async function runMetaCapi(action: 'process' | 'reprocess' | 'test' = 'process'): Promise<CapiSummary> {
  const { data, error } = await supabase.functions.invoke('meta-capi', { body: { action } });
  if (error) {
    // Mostra a mensagem da função (ex.: secret faltando) em vez do erro genérico do HTTP.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as CapiSummary;
}

/** Dispara o envio sem bloquear a tela. Falhas ficam como "pendente" e são reenviadas depois. */
export function runMetaCapiInBackground() {
  runMetaCapi('process').catch(() => {
    // Silencioso de propósito: a venda continua na fila e nada de dado de cliente é logado.
  });
}

/**
 * Exporta os clientes (uma linha por telefone, com a soma das compras) em CSV, em texto claro.
 * O arquivo é baixado no computador; nada é enviado para a Meta.
 */
export async function exportMetaCustomersCsv(range: { from?: string; to?: string }): Promise<ExportStats> {
  const sales: SaleRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('service_orders')
      .select('id, cliente_nome, cliente_telefone, cliente_email, cliente_contato, total, payment_status, order_status, atendimento_data')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    sales.push(...(data as SaleRow[]));
    if (!data || data.length < PAGE) break;
  }

  sales.push(...(await fetchHistoricalSales()));

  const { rows, stats } = aggregateCustomers(sales, range);
  const suffix = range.from || range.to ? `${range.from ?? 'inicio'}_a_${range.to ?? 'hoje'}` : 'historico';
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes-meta-${suffix}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return stats;
}

/** Vendas antigas importadas das notas fiscais, no mesmo formato das vendas do sistema. */
async function fetchHistoricalSales(): Promise<SaleRow[]> {
  const out: SaleRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('historical_sales')
      .select('nf_key, cliente_nome, cliente_telefone, cliente_email, endereco, cep, cidade, uf, total, issued_at')
      .range(from, from + PAGE - 1);
    if (error) return out; // tabela ainda não criada (SQL 7): exporta só as vendas do sistema
    out.push(...(data ?? []).map(h => ({
      id: h.nf_key,
      cliente_nome: h.cliente_nome,
      cliente_telefone: h.cliente_telefone,
      cliente_email: h.cliente_email,
      cliente_contato: [h.endereco, h.cep].filter(Boolean).join(' - '),
      cidade: h.cidade,
      uf: h.uf,
      total: h.total,
      payment_status: 'pago',
      order_status: 'historico',
      atendimento_data: h.issued_at,
    })));
    if (!data || data.length < PAGE) return out;
  }
}

export interface HistoricalNote {
  chave: string; numero: string; emissao: string | null; natureza: string; nome: string; documento: string;
  telefone: string; email: string; endereco: string; bairro: string; cidade: string; uf: string; cep: string;
  total: number; file: string;
}

/** Grava as notas lidas. Nota já importada (mesma chave de acesso) é atualizada com a leitura nova. */
export async function saveHistoricalNotes(notes: HistoricalNote[], onProgress?: (done: number) => void): Promise<number> {
  const CHUNK = 500;
  let saved = 0;
  for (let i = 0; i < notes.length; i += CHUNK) {
    const rows = notes.slice(i, i + CHUNK).map(n => ({
      nf_key: n.chave, nf_number: n.numero, issued_at: n.emissao, natureza: n.natureza,
      cliente_nome: n.nome, cliente_documento: n.documento, cliente_telefone: n.telefone, cliente_email: n.email || null,
      endereco: n.endereco, bairro: n.bairro, cidade: n.cidade, uf: n.uf, cep: n.cep, total: n.total, source_file: n.file,
    }));
    const { error } = await supabase.from('historical_sales').upsert(rows, { onConflict: 'nf_key' });
    if (error) throw error;
    saved += rows.length;
    onProgress?.(saved);
  }
  return saved;
}

/** Remove notas que já tinham sido importadas mas agora ficam de fora (após a data de corte ou não são venda). */
export async function removeHistoricalNotes(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 200) {
    const { error } = await supabase.from('historical_sales').delete().in('nf_key', keys.slice(i, i + 200));
    if (error) throw error;
  }
}

export async function countHistoricalSales(): Promise<number | null> {
  const { count, error } = await supabase.from('historical_sales').select('id', { count: 'exact', head: true });
  return error ? null : count ?? 0;
}

/** Data do primeiro pedido do sistema: notas a partir dela já estão nos pedidos e não são importadas. */
export async function firstOrderDate(): Promise<string | null> {
  const [byDate, byCreated] = await Promise.all([
    supabase.from('service_orders').select('atendimento_data').not('atendimento_data', 'is', null)
      .order('atendimento_data', { ascending: true }).limit(1),
    supabase.from('service_orders').select('created_at').order('created_at', { ascending: true }).limit(1),
  ]);
  const dates = [byDate.data?.[0]?.atendimento_data, byCreated.data?.[0]?.created_at?.slice(0, 10)]
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d))
    .map(d => d.slice(0, 10))
    .sort();
  return dates[0] ?? null;
}
