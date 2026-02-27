import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import { Brain, Loader2, FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function RelatorioIAPage() {
  const { getMonthlyClosing, getMonthTransactions, employees, categories } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const closing = getMonthlyClosing(month, year);
  const monthTx = getMonthTransactions(month, year);

  const [report, setReport] = useState('');
  const [dailyReport, setDailyReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);

  const hasData = monthTx.length > 0;

  // Category analysis
  const categoryMap: Record<string, number> = {};
  monthTx.filter(t => t.type === 'saida').forEach(t => {
    categoryMap[t.category_name || 'Outros'] = (categoryMap[t.category_name || 'Outros'] || 0) + Number(t.amount);
  });
  const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  const streamReport = async (type: 'monthly' | 'daily', setContent: (s: string) => void, setIsLoading: (b: boolean) => void) => {
    setIsLoading(true);
    setContent('');

    let financialData: any;
    if (type === 'daily') {
      const today = new Date().toISOString().slice(0, 10);
      const todayTx = monthTx.filter(t => t.transaction_date === today);
      financialData = {
        date: today,
        transactions: todayTx.map(t => ({ description: t.description, amount: Number(t.amount), type: t.type, category: t.category_name })),
        totalIn: todayTx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0),
        totalOut: todayTx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.amount), 0),
      };
    } else {
      financialData = {
        month: getMonthName(month),
        year,
        closing,
        categoryBreakdown: categoryMap,
        employeeCount: employees.filter(e => e.status === 'ativo').length,
        topExpenseCategories: sortedCategories.slice(0, 5),
        transactionCount: monthTx.length,
        entriesCount: monthTx.filter(t => t.type === 'entrada').length,
        exitsCount: monthTx.filter(t => t.type === 'saida').length,
      };
    }

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ financialData, type }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        toast.error(err.error || 'Erro ao gerar relatório');
        setIsLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setIsLoading(false); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setContent(fullText);
            }
          } catch { /* partial */ }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar relatório');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Brain size={28} className="text-secondary" />
        <h1 className="page-title">Relatório Inteligente</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">{getMonthName(month)} de {year} — Powered by Lovable AI</p>

      {!hasData ? (
        <div className="metric-card text-center py-12 text-muted-foreground">
          <Brain size={48} className="mx-auto mb-4 opacity-30" />
          <p>Registre movimentações financeiras para gerar análises inteligentes.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="metric-card">
            <h3 className="section-label mb-3">📊 Resumo do Mês</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Faturamento:</span> <strong className="text-success">{formatCurrency(closing.totalRevenue)}</strong></div>
              <div><span className="text-muted-foreground">Despesas:</span> <strong className="text-destructive">{formatCurrency(closing.totalExpenses)}</strong></div>
              <div><span className="text-muted-foreground">Lucro Líquido:</span> <strong className={closing.netProfit >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(closing.netProfit)}</strong></div>
              <div><span className="text-muted-foreground">Margem:</span> <strong>{formatPercent(closing.margin)}</strong></div>
            </div>
          </div>

          {/* Top expenses */}
          {sortedCategories.length > 0 && (
            <div className="metric-card">
              <h3 className="section-label mb-3">💸 Maiores Despesas por Categoria</h3>
              <div className="space-y-2">
                {sortedCategories.slice(0, 5).map(([cat, val]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span>{cat}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(val / sortedCategories[0][1]) * 100}%` }} />
                      </div>
                      <span className="font-mono w-28 text-right">{formatCurrency(val)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="metric-card">
              <h3 className="section-label mb-3 flex items-center gap-2"><Calendar size={14} /> Relatório do Dia</h3>
              <Button onClick={() => streamReport('daily', setDailyReport, setDailyLoading)} disabled={dailyLoading} className="w-full mb-3">
                {dailyLoading ? <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando...</> : <><Brain size={16} className="mr-2" /> Gerar Relatório do Dia</>}
              </Button>
              {dailyReport && (
                <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap bg-muted/30 rounded p-4">
                  {dailyReport}
                </div>
              )}
            </div>

            <div className="metric-card">
              <h3 className="section-label mb-3 flex items-center gap-2"><FileText size={14} /> Relatório Mensal Estratégico</h3>
              <Button onClick={() => streamReport('monthly', setReport, setLoading)} disabled={loading} className="w-full mb-3">
                {loading ? <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando...</> : <><Brain size={16} className="mr-2" /> Gerar Relatório Mensal</>}
              </Button>
              {report && (
                <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap bg-muted/30 rounded p-4">
                  {report}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
