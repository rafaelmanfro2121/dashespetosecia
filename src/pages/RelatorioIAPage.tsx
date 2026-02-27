import { useState, useEffect, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import { Brain, Loader2, FileText, Calendar, Download, Sparkles, Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function RelatorioIAPage() {
  const { getMonthlyClosing, getMonthTransactions, employees, categories } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const closing = getMonthlyClosing(month, year);
  const monthTx = getMonthTransactions(month, year);

  const [report, setReport] = useState('');
  const [dailyReport, setDailyReport] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hasData = monthTx.length > 0;

  useEffect(() => {
    supabase.from('products').select('*').then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const categoryMap: Record<string, number> = {};
  monthTx.filter(t => t.type === 'saida').forEach(t => {
    categoryMap[t.category_name || 'Outros'] = (categoryMap[t.category_name || 'Outros'] || 0) + Number(t.amount);
  });
  const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  const buildFinancialContext = () => {
    return {
      month: getMonthName(month),
      year,
      closing,
      categoryBreakdown: categoryMap,
      employeeCount: employees.filter(e => e.status === 'ativo').length,
      topExpenseCategories: sortedCategories.slice(0, 5),
      transactionCount: monthTx.length,
      products: products.map(p => ({
        name: p.name,
        salePrice: Number(p.sale_price),
        materialCost: Number(p.material_cost),
        laborCost: Number(p.labor_cost),
        otherCosts: Number(p.other_costs),
        totalCost: Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs),
        margin: Number(p.sale_price) > 0 ? ((Number(p.sale_price) - Number(p.material_cost) - Number(p.labor_cost) - Number(p.other_costs)) / Number(p.sale_price) * 100) : 0,
        unitsSold: Number(p.units_sold),
      })),
    };
  };

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
      financialData = buildFinancialContext();
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

  // AI Chat for financial consulting
  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    const userMsg = chatMessage.trim();
    setChatMessage('');
    setChatLoading(true);

    const newHistory = [...chatHistory, { role: 'user' as const, content: userMsg }];
    setChatHistory(newHistory);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          financialData: { ...buildFinancialContext(), userQuestion: userMsg, chatHistory: newHistory.slice(-10) },
          type: 'chat',
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        toast.error(err.error || 'Erro na IA');
        setChatLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setChatLoading(false); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);

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
              assistantText += content;
              setChatHistory(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                return updated;
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na IA');
    } finally {
      setChatLoading(false);
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    toast.info('Gerando PDF...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      let position = 0;
      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      } else {
        while (position < pdfHeight) {
          if (position > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -position, pdfWidth, pdfHeight);
          position += pageHeight;
        }
      }
      pdf.save(`relatorio_ia_${getMonthName(month)}_${year}.pdf`);
      toast.success('PDF gerado!');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="page-title">Consultor Financeiro IA</h1>
            <p className="text-muted-foreground text-xs">Análises inteligentes para maximizar seu lucro</p>
          </div>
        </div>
        {(report || dailyReport) && (
          <Button onClick={exportPDF} variant="outline" size="sm" className="rounded-xl">
            <Download size={14} className="mr-2" /> PDF
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-sm mb-6">{getMonthName(month)} de {year}</p>

      {/* AI Chat */}
      <div className="metric-card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={16} className="text-primary" />
          <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Converse com a IA</h3>
          <span className="badge-info text-[10px] ml-auto">Dados financeiros em contexto</span>
        </div>

        {chatHistory.length > 0 && (
          <div className="max-h-80 overflow-y-auto space-y-3 mb-4 p-3 bg-muted/20 rounded-xl">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none"><ReactMarkdown>{msg.content || '...'}</ReactMarkdown></div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Pergunte algo: 'Qual produto dá mais lucro?' ou 'Como reduzir custos?'"
            value={chatMessage}
            onChange={e => setChatMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !chatLoading && handleChat()}
            disabled={chatLoading}
            className="rounded-xl h-11"
          />
          <Button onClick={handleChat} disabled={chatLoading || !chatMessage.trim()} className="rounded-xl h-11 px-5">
            {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>

        {chatHistory.length === 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {['Qual produto dá mais lucro?', 'Como posso reduzir custos?', 'Analise minha margem de lucro', 'Quanto devo cobrar por churrasqueira?'].map(q => (
              <button key={q} onClick={() => { setChatMessage(q); }} className="text-xs bg-muted/50 hover:bg-muted text-muted-foreground px-3 py-1.5 rounded-full transition-colors">
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="metric-card text-center py-16 text-muted-foreground">
          <Brain size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium mb-1">Sem dados financeiros</p>
          <p className="text-sm">Registre movimentações para gerar análises inteligentes.</p>
        </div>
      ) : (
        <div className="space-y-6" ref={reportRef}>
          <div className="metric-card">
            <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Resumo do Mês</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-success/5">
                <span className="text-xs text-muted-foreground">Faturamento</span>
                <p className="font-bold text-success mt-0.5">{formatCurrency(closing.totalRevenue)}</p>
              </div>
              <div className="p-3 rounded-xl bg-destructive/5">
                <span className="text-xs text-muted-foreground">Despesas</span>
                <p className="font-bold text-destructive mt-0.5">{formatCurrency(closing.totalExpenses)}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/5">
                <span className="text-xs text-muted-foreground">Lucro Líquido</span>
                <p className={`font-bold mt-0.5 ${closing.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(closing.netProfit)}</p>
              </div>
              <div className="p-3 rounded-xl bg-info/5">
                <span className="text-xs text-muted-foreground">Margem</span>
                <p className="font-bold text-info mt-0.5">{formatPercent(closing.margin)}</p>
              </div>
            </div>
          </div>

          {sortedCategories.length > 0 && (
            <div className="metric-card">
              <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Maiores Despesas</h3>
              <div className="space-y-3">
                {sortedCategories.slice(0, 5).map(([cat, val]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{cat}</span>
                    <div className="flex items-center gap-3 flex-1 ml-4">
                      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full transition-all duration-500" style={{ width: `${(val / sortedCategories[0][1]) * 100}%` }} />
                      </div>
                      <span className="font-mono text-xs w-28 text-right font-medium">{formatCurrency(val)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-info" />
                <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Relatório do Dia</h3>
              </div>
              <Button onClick={() => streamReport('daily', setDailyReport, setDailyLoading)} disabled={dailyLoading} className="w-full mb-4 rounded-xl h-10">
                {dailyLoading ? <><Loader2 size={16} className="mr-2 animate-spin" /> Analisando...</> : <><Sparkles size={16} className="mr-2" /> Gerar Análise</>}
              </Button>
              {dailyReport && (
                <div className="prose prose-sm max-w-none text-sm bg-muted/20 rounded-xl p-4">
                  <ReactMarkdown>{dailyReport}</ReactMarkdown>
                </div>
              )}
            </div>

            <div className="metric-card">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} className="text-primary" />
                <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Relatório Mensal</h3>
              </div>
              <Button onClick={() => streamReport('monthly', setReport, setLoading)} disabled={loading} className="w-full mb-4 rounded-xl h-10">
                {loading ? <><Loader2 size={16} className="mr-2 animate-spin" /> Analisando...</> : <><Sparkles size={16} className="mr-2" /> Gerar Análise</>}
              </Button>
              {report && (
                <div className="prose prose-sm max-w-none text-sm bg-muted/20 rounded-xl p-4">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
