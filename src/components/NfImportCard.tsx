import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { FileArchive, Loader2, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { isSaleNote } from '@/lib/danfe';
import { saveHistoricalNotes, removeHistoricalNotes, countHistoricalSales, firstOrderDate, existingHistoricalKeys } from '@/lib/meta';
import { normalizePhone } from '../../supabase/functions/_shared/meta';
import type { ImportResult, ImportProgress } from '@/lib/nfImport';

const fmtDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '–');

export default function NfImportCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [existing, setExisting] = useState<number | null>(null);
  const [cutoff, setCutoff] = useState('');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());

  useEffect(() => {
    countHistoricalSales().then(setExisting);
    firstOrderDate().then(d => d && setCutoff(d));
  }, []);

  const summary = useMemo(() => {
    if (!result) return null;
    const sales = result.notes.filter(isSaleNote);
    const notSale = result.notes.length - sales.length;
    const beforeCutoff = sales.filter(n => !cutoff || !n.emissao || n.emissao < cutoff);
    const afterCutoff = sales.length - beforeCutoff.length;
    const withPhone = beforeCutoff.filter(n => normalizePhone(n.telefone)).length;
    const total = beforeCutoff.reduce((s, n) => s + n.total, 0);
    const dates = beforeCutoff.map(n => n.emissao).filter(Boolean).sort() as string[];
    const kept = new Set(beforeCutoff.map(n => n.chave));
    const excludedKeys = result.notes.filter(n => !kept.has(n.chave)).map(n => n.chave);
    const newCount = beforeCutoff.filter(n => !known.has(n.chave)).length;
    const toRemove = excludedKeys.filter(k => known.has(k));
    return { toImport: beforeCutoff, newCount, updateCount: beforeCutoff.length - newCount, excludedKeys: toRemove, notSale, afterCutoff, withPhone, total, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
  }, [result, cutoff, known]);

  const read = async (files: FileList | null) => {
    if (!files?.length) return;
    setResult(null);
    setProgress({ done: 0, total: 0, current: 'Abrindo arquivo...' });
    try {
      const { importNotes } = await import('@/lib/nfImport');
      const r = await importNotes([...files], setProgress);
      setKnown(await existingHistoricalKeys());
      setResult(r);
      if (!r.notes.length) toast.error('Nenhuma nota fiscal encontrada nos arquivos');
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao abrir o arquivo');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const save = async () => {
    if (!summary?.toImport.length) return;
    setSaving(true);
    try {
      const n = await saveHistoricalNotes(summary.toImport);
      await removeHistoricalNotes(summary.excludedKeys);
      toast.success(`${n} notas importadas`);
      setResult(null);
      setExisting(await countHistoricalSales());
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao salvar as notas');
    } finally {
      setSaving(false);
    }
  };

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="metric-card mt-6">
      <h2 className="text-sm font-bold mb-1">Importar clientes antigos (notas fiscais)</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Envie o arquivo <strong>.rar</strong> ou <strong>.zip</strong> com os PDFs das notas (DANFE), ou os PDFs soltos.
        A leitura acontece no seu computador; só nome, telefone, cidade, UF, CEP, valor e data vão para o banco.
        Esses clientes entram na exportação CSV acima, sem mudar o Dashboard e o Financeiro.
      </p>

      {existing === null ? (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm mb-4">
          <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" aria-hidden="true" />
          <span>Antes de importar, rode o arquivo <code>supabase/setup/7-vendas-historicas.sql</code> no SQL Editor do Supabase.</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-4">Notas já importadas: <strong className="tabular-nums">{existing}</strong></p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".rar,.zip,.7z,.pdf"
          className="hidden"
          onChange={e => read(e.target.files)}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={!!progress || saving || existing === null} className="rounded-xl">
          {progress ? <Loader2 className="animate-spin" /> : <FileArchive />} Escolher arquivo (.rar, .zip ou PDFs)
        </Button>
        <div>
          <label htmlFor="nf-cutoff" className="text-xs font-medium text-muted-foreground mb-1.5 block">Ignorar notas a partir de</label>
          <Input id="nf-cutoff" type="date" value={cutoff} onChange={e => setCutoff(e.target.value)} className="rounded-xl w-44" />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Notas a partir dessa data (o primeiro pedido do sistema) já estão nos pedidos e ficam de fora, para não contar a mesma venda duas vezes.
      </p>

      {progress && (
        <div className="mt-4 space-y-1.5" aria-live="polite">
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground tabular-nums">
            {progress.total ? `Lendo ${progress.done} de ${progress.total} notas (${pct}%)` : progress.current}
          </p>
        </div>
      )}

      {summary && result && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {[
              ['PDFs no arquivo', `${result.pdfs} (${result.pages} páginas)`],
              ['Notas reconhecidas', String(result.notes.length)],
              ['Novas (ainda não importadas)', String(summary.newCount)],
              ['Já no sistema (serão atualizadas)', String(summary.updateCount)],
              ['Com telefone válido', String(summary.withPhone)],
              ['Valor total', formatCurrency(summary.total)],
              ['Período', `${fmtDate(summary.from)} a ${fmtDate(summary.to)}`],
              ['Já nos pedidos (após a data)', String(summary.afterCutoff)],
              ['Não são venda (devolução, remessa…)', String(summary.notSale)],
              ['Repetidas no arquivo', String(result.duplicates)],
              ['Não lidas: sem texto (escaneada/imagem)', String(result.unreadableReasons.noText.length)],
              ['Não lidas: formato não reconhecido', String(result.unreadableReasons.otherLayout.length)],
              ['Não lidas: erro ao abrir', String(result.unreadableReasons.error.length)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {summary.toImport.length > 0 && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className="text-left font-medium px-3 py-2">Data</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">Cliente</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">Cidade/UF</th>
                    <th scope="col" className="text-left font-medium px-3 py-2">Telefone</th>
                    <th scope="col" className="text-right font-medium px-3 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.toImport.slice(0, 10).map(n => (
                    <tr key={n.chave}>
                      <td className="px-3 py-1.5 tabular-nums">{fmtDate(n.emissao)}</td>
                      <td className="px-3 py-1.5">{n.nome || '–'}</td>
                      <td className="px-3 py-1.5">{[n.cidade, n.uf].filter(Boolean).join('/') || '–'}</td>
                      <td className="px-3 py-1.5">{normalizePhone(n.telefone) ? 'ok' : <span className="text-warning">sem telefone válido</span>}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(n.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary.toImport.length > 10 && (
                <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">Mostrando 10 de {summary.toImport.length}. Confira se os dados estão certos antes de importar.</p>
              )}
            </div>
          )}

          {result.unreadable.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <details>
                <summary className="cursor-pointer text-muted-foreground">Ver arquivos não lidos ({result.unreadable.length})</summary>
                {([
                  ['Sem texto (escaneada/imagem)', result.unreadableReasons.noText],
                  ['Formato não reconhecido', result.unreadableReasons.otherLayout],
                  ['Erro ao abrir', result.unreadableReasons.error],
                ] as const).filter(([, list]) => list.length).map(([label, list]) => (
                  <div key={label} className="mt-2">
                    <p className="font-semibold">{label} ({list.length})</p>
                    <ul className="max-h-40 overflow-auto list-disc pl-5 space-y-0.5">
                      {list.slice(0, 100).map(f => <li key={f} className="break-all">{f}</li>)}
                    </ul>
                  </div>
                ))}
              </details>
              <button type="button" className="text-primary font-medium hover:underline" onClick={() => {
                const r = result.unreadableReasons;
                const txt = [
                  `SEM TEXTO (escaneada/imagem): ${r.noText.length}`, ...r.noText, '',
                  `FORMATO NÃO RECONHECIDO: ${r.otherLayout.length}`, ...r.otherLayout, '',
                  `ERRO AO ABRIR: ${r.error.length}`, ...r.error,
                ].join('\n');
                const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
                const a = document.createElement('a'); a.href = url; a.download = 'notas-nao-lidas.txt'; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}>Baixar lista dos não lidos</button>
            </div>
          )}

          <Button onClick={save} disabled={saving || !summary.toImport.length} className="rounded-xl">
            {saving ? <Loader2 className="animate-spin" /> : summary.toImport.length ? <Upload /> : <CheckCircle2 />}
            {summary.updateCount
              ? `Importar ${summary.newCount} novas e atualizar ${summary.updateCount}`
              : `Importar ${summary.toImport.length} notas`}
          </Button>
        </div>
      )}
    </section>
  );
}
