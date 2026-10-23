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
