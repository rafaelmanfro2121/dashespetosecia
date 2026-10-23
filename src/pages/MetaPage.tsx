import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { runMetaCapi, exportMetaCustomersCsv, type CapiSummary } from '@/lib/meta';
import type { ExportStats } from '../../supabase/functions/_shared/meta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Send, RefreshCw, Download, Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface StatusCounts { pendente: number; enviado: number; erro: number }
interface ErrorRow { id: string; os_number: string; meta_capi_error: string | null; meta_capi_attempted_at: string | null }

export default function MetaPage() {
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [setupMissing, setSetupMissing] = useState(false);
  const [running, setRunning] = useState<'process' | 'reprocess' | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [lastRun, setLastRun] = useState<CapiSummary | null>(null);

  const load = useCallback(async () => {
    const statuses = ['pendente', 'enviado', 'erro'] as const;
    const results = await Promise.all(statuses.map(s =>
      supabase.from('service_orders').select('id', { count: 'exact', head: true }).eq('meta_capi_status', s),
    ));
    if (results.some(r => r.error)) { setSetupMissing(true); return; }
    setSetupMissing(false);
    setCounts({ pendente: results[0].count ?? 0, enviado: results[1].count ?? 0, erro: results[2].count ?? 0 });
    const { data } = await supabase
      .from('service_orders')
      .select('id, os_number, meta_capi_error, meta_capi_attempted_at')
      .in('meta_capi_status', ['erro', 'pendente'])
      .not('meta_capi_error', 'is', null)
      .order('meta_capi_attempted_at', { ascending: false })
      .limit(20);
    setErrors((data as ErrorRow[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (action: 'process' | 'reprocess') => {
    setRunning(action);
    try {
      const r = await runMetaCapi(action);
      setLastRun(r);
      if (r.found === 0) toast.info('Nenhuma venda na fila');
      else toast.success(`${r.sent} enviada(s)${r.errors ? `, ${r.errors} com erro` : ''}${r.pending ? `, ${r.pending} para tentar de novo` : ''}${r.test ? ' (modo teste)' : ''}`);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao enviar para a Meta');
    } finally {
      setRunning(null);
      load();
    }
  };

  const exportCsv = async () => {
    if (from && to && from > to) { toast.error('A data inicial é depois da final'); return; }
    setExporting(true);
    try {
      const s = await exportMetaCustomersCsv({ from: from || undefined, to: to || undefined });
      setStats(s);
      toast.success(`CSV baixado: ${s.customers} clientes`);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Target size={22} className="text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="page-title">Meta Ads</h1>
          <p className="text-muted-foreground text-xs">Envia as vendas fechadas para a Meta e exporta clientes para públicos</p>
        </div>
      </div>

      {/* Parte 1 */}
      <section className="metric-card mb-6">
        <h2 className="text-sm font-bold mb-1">Envio automático de vendas (Conversions API)</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Cada venda que sai de "pendente" (entrada ou pagamento total) entra na fila e é enviada automaticamente.
          Vendas antigas não são enviadas: o histórico vai pela exportação abaixo.
        </p>

        {setupMissing ? (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
            <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" aria-hidden="true" />
            <span>A integração ainda não foi instalada no banco. Rode o arquivo <code>supabase/setup/4-meta-capi.sql</code> no SQL Editor do Supabase.</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Na fila', value: counts?.pendente, icon: Clock, cls: 'text-warning' },
                { label: 'Enviadas', value: counts?.enviado, icon: CheckCircle2, cls: 'text-success' },
                { label: 'Com erro', value: counts?.erro, icon: AlertTriangle, cls: 'text-destructive' },
              ].map(c => (
                <div key={c.label} className="rounded-xl border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><c.icon size={14} className={c.cls} aria-hidden="true" /> {c.label}</div>
                  <p className="text-xl font-bold tabular-nums mt-1">{c.value ?? '–'}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run('process')} disabled={!!running} className="rounded-xl">
                {running === 'process' ? <Loader2 className="animate-spin" /> : <Send />} Enviar fila agora
              </Button>
              <Button variant="outline" onClick={() => run('reprocess')} disabled={!!running} className="rounded-xl">
                {running === 'reprocess' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Reenviar também as com erro
              </Button>
            </div>
            {lastRun && (
              <div className="mt-4 rounded-xl border bg-muted/30 p-3 text-xs space-y-1" aria-live="polite">
                <p className="font-semibold text-sm">Último envio</p>
                <p>Vendas na fila: {lastRun.found} · enviadas: {lastRun.sent} · com erro: {lastRun.errors} · para tentar de novo: {lastRun.pending}</p>
                {lastRun.sent > 0 && <p>A Meta confirmou o recebimento de <strong>{lastRun.metaEventsReceived ?? 0}</strong> evento(s).</p>}
                <p>Modo: <strong>{lastRun.test ? 'TESTE (aparece só em Eventos de teste)' : 'PRODUÇÃO'}</strong> · origem: {lastRun.actionSource ?? '–'}</p>
                {lastRun.fbtraceId && <p className="text-muted-foreground">Código de rastreio da Meta: {lastRun.fbtraceId}</p>}
              </div>
            )}
            {errors.length > 0 && (
              <div className="mt-5">
                <h3 className="section-label mb-2">Últimos problemas</h3>
                <ul className="divide-y rounded-xl border text-sm">
                  {errors.map(e => (
                    <li key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2">
                      <span className="font-medium tabular-nums shrink-0">Pedido {e.os_number}</span>
                      <span className="text-muted-foreground flex-1 break-words">{e.meta_capi_error}</span>
                      {e.meta_capi_attempted_at && <span className="text-xs text-muted-foreground shrink-0">{new Date(e.meta_capi_attempted_at).toLocaleString('pt-BR')}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Parte 2 */}
      <section className="metric-card">
        <h2 className="text-sm font-bold mb-1">Exportar clientes para públicos (CSV)</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Uma linha por cliente, com a soma de tudo o que ele comprou (valor do cliente). O arquivo é baixado no seu computador
          para você subir no Gerenciador de Anúncios. Deixe as datas vazias para exportar todo o histórico.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="meta-from" className="text-xs font-medium text-muted-foreground mb-1.5 block">De</label>
            <Input id="meta-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-xl w-44" />
          </div>
          <div>
            <label htmlFor="meta-to" className="text-xs font-medium text-muted-foreground mb-1.5 block">Até</label>
            <Input id="meta-to" type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-xl w-44" />
          </div>
          <Button onClick={exportCsv} disabled={exporting} className="rounded-xl">
            {exporting ? <Loader2 className="animate-spin" /> : <Download />} Exportar CSV
          </Button>
        </div>

        {stats && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {[
              ['Clientes únicos', String(stats.customers)],
              ['Faturamento somado', formatCurrency(stats.revenue)],
              ['Vendas', String(stats.sales)],
              ['Clientes com e-mail', String(stats.withEmail)],
              ['Descartados (telefone inválido)', String(stats.discardedInvalidPhone)],
              ['Ticket médio', formatCurrency(stats.averageTicket)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
            <div className="col-span-2 md:col-span-3 rounded-xl border p-3">
              <p className="text-xs text-muted-foreground mb-2">Por ano</p>
              <ul className="space-y-1">
                {stats.byYear.map(y => (
                  <li key={y.year} className="flex justify-between tabular-nums">
                    <span>{y.year}</span><span>{y.sales} vendas · {formatCurrency(y.revenue)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
