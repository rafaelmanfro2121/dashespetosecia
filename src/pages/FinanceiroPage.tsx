import { useState, useMemo, useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Search, Filter, DollarSign, Sparkles, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears, format, isWithinInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = 'diario' | 'semanal' | 'mensal' | 'anual';

function getPeriodRange(period: Period, offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  let ref: Date;
  let start: Date, end: Date, label: string;

  switch (period) {
    case 'diario':
      ref = subDays(now, -offset);
      start = startOfDay(ref);
      end = endOfDay(ref);
      label = format(ref, "dd 'de' MMMM, yyyy", { locale: ptBR });
      break;
    case 'semanal':
      ref = subWeeks(now, -offset);
      start = startOfWeek(ref, { weekStartsOn: 1 });
      end = endOfWeek(ref, { weekStartsOn: 1 });
      label = `${format(start, 'dd/MM')} a ${format(end, 'dd/MM/yyyy')}`;
      break;
    case 'mensal':
      ref = subMonths(now, -offset);
      start = startOfMonth(ref);
      end = endOfMonth(ref);
      label = format(ref, "MMMM 'de' yyyy", { locale: ptBR });
      break;
    case 'anual':
      ref = subYears(now, -offset);
      start = startOfYear(ref);
      end = endOfYear(ref);
      label = format(ref, 'yyyy');
      break;
  }

  return { start, end, label };
}

export default function FinanceiroPage() {
  const { transactions, categories, addTransaction, removeTransaction, addCategory, removeCategory } = useFinance();
  const { user } = useAuth();

  const [period, setPeriod] = useState<Period>('diario');
  const [offset, setOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'entrada' | 'saida'>('todos');

  const { start, end, label: periodLabel } = useMemo(() => getPeriodRange(period, offset), [period, offset]);

  const periodTx = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.transaction_date + 'T12:00:00');
      return isWithinInterval(d, { start, end });
    }),
    [transactions, start, end]
  );

  const filteredTx = periodTx.filter(t => {
    const matchesSearch = !searchTerm || t.description.toLowerCase().includes(searchTerm.toLowerCase()) || (t.category_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'todos' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalIn = periodTx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = periodTx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.amount), 0);

  // Material cost from sold products in service orders
  const [materialCost, setMaterialCost] = useState(0);

  useEffect(() => {
    const calcMaterialCost = async () => {
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // Fetch paid service orders in period + products with their materials
      const [osRes, prodRes, matRes] = await Promise.all([
        supabase.from('service_orders').select('items, payment_status').gte('atendimento_data', startStr).lte('atendimento_data', endStr).neq('payment_status', 'pendente'),
        supabase.from('products').select('id, name'),
        supabase.from('product_materials').select('product_id, quantity_per_unit'),
      ]);

      if (!osRes.data || !prodRes.data || !matRes.data) { setMaterialCost(0); return; }

      // Build cost map: product name (lowercase) -> sum of material values (quantity_per_unit = R$)
      const productIdMap = new Map<string, string>(); // name -> id
      prodRes.data.forEach(p => productIdMap.set(p.name.toLowerCase(), p.id));

      const costByProductId = new Map<string, number>();
      matRes.data.forEach(m => {
        costByProductId.set(m.product_id, (costByProductId.get(m.product_id) || 0) + Number(m.quantity_per_unit));
      });

      let total = 0;
      osRes.data.forEach(os => {
        const items = os.items as Array<{ name?: string; quantity?: number }> | null;
        if (!items || !Array.isArray(items)) return;
        items.forEach(item => {
          if (!item.name) return;
          const prodId = productIdMap.get(item.name.toLowerCase());
          if (prodId) {
            const matCost = costByProductId.get(prodId) || 0;
            total += matCost * (Number(item.quantity) || 1);
          }
        });
      });

      setMaterialCost(total);
    };
    calcMaterialCost();
  }, [start, end]);

  const [form, setForm] = useState({ transaction_date: new Date().toISOString().slice(0, 10), description: '', category_id: '', type: 'saida' as 'entrada' | 'saida', amount: '', payment_method: 'Dinheiro' });
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [newCat, setNewCat] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.category_id || !form.amount) { toast.error('Preencha todos os campos'); return; }
    try {
      await addTransaction({ ...form, amount: parseFloat(form.amount), category_id: form.category_id || null });
      setForm({ ...form, description: '', amount: '' });
      toast.success('Movimentação registrada');
    } catch (err: any) { console.error('[Financeiro] Submit error:', err); toast.error(err.message || 'Erro ao salvar'); }
  };

  const handleAI = async () => {
    if (!aiInput.trim() || !user) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-report', {
        body: { financialData: { message: aiInput }, type: 'parse' },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); setAiLoading(false); return; }

      const result = data.result;
      if (!result) { toast.error('Não consegui interpretar'); setAiLoading(false); return; }

      const cat = categories.find(c => c.name.toLowerCase() === (result.category || '').toLowerCase());

      await addTransaction({
        transaction_date: new Date().toISOString().slice(0, 10),
        description: result.description || aiInput,
        category_id: cat?.id || null,
        type: result.type || 'saida',
        amount: result.amount || 0,
        payment_method: result.payment_method || 'Não especificado',
      });

      // If it's a material purchase, trigger cost recalculation
      if (result.is_material_purchase && result.material_name) {
        try {
          await supabase.functions.invoke('ai-report', {
            body: {
              type: 'recalculate-costs',
              financialData: {
                materialName: result.material_name,
                newCost: result.amount,
                quantity: result.quantity || 1,
              },
            },
          });
          toast.info('🔄 Custos dos produtos recalculados com base na nova compra de material');
        } catch {
          // Non-critical, don't block
        }
      }

      setAiInput('');
      toast.success(`IA: ${result.type === 'entrada' ? 'Entrada' : 'Saída'} de ${formatCurrency(result.amount)}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar');
    } finally {
      setAiLoading(false);
    }
  };

  const periodLabels: Record<Period, string> = {
    diario: 'Diário',
    semanal: 'Semanal',
    mensal: 'Mensal',
    anual: 'Anual',
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <DollarSign size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="text-muted-foreground text-xs capitalize">{periodLabel}</p>
        </div>
      </div>

      <div className="h-6" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6">
        <MetricCard label="Entradas" value={totalIn} icon={TrendingUp} variant="success" />
        <MetricCard label="Saídas" value={totalOut} icon={TrendingDown} variant="danger" />
        <MetricCard label="Custo Matéria-Prima" value={materialCost} icon={Package} variant="warning" />
        <MetricCard label="Saldo" value={totalIn - totalOut} icon={DollarSign} variant={totalIn - totalOut >= 0 ? 'info' : 'danger'} />
      </div>

      {/* AI Input */}
      <div className="metric-card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Registro Inteligente</h3>
          <span className="badge-info text-[10px] ml-auto">Powered by IA</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          💡 Ao registrar compra de material (ex: "comprei 5 chapas de inox por R$800"), a IA recalcula automaticamente o custo dos produtos.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder='Ex: "Comprei 5 chapas de inox por 800 reais" ou "Entrou 12.500 da venda de churrasqueira"'
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAI()}
            className="flex-1 h-11 rounded-xl"
            disabled={aiLoading}
          />
          <Button onClick={handleAI} disabled={aiLoading} className="h-11 rounded-xl px-5">
            {aiLoading ? 'Processando...' : <><Sparkles size={14} className="mr-1.5" /> Registrar</>}
          </Button>
        </div>
      </div>

      {/* Manual Form */}
      <div className="metric-card mb-6">
        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Nova Movimentação Manual</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input type="date" value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })} className="rounded-xl" />
          <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl" />
          <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>{categories.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.type} onValueChange={(v: 'entrada' | 'saida') => setForm({ ...form, type: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" step="0.01" placeholder="Valor" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="rounded-xl" />
          <Button type="submit" className="rounded-xl"><Plus size={16} className="mr-1" /> Adicionar</Button>
        </form>
      </div>

      {/* Categories */}
      <div className="metric-card mb-6">
        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Categorias</h3>
        <div className="flex gap-2 flex-wrap mb-3">
          {categories.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1.5 bg-muted/50 text-foreground text-xs px-3 py-1.5 rounded-full font-medium">
              {c.name}
              <button onClick={() => removeCategory(c.id)} className="hover:text-destructive transition-colors"><Trash2 size={11} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Nova categoria" value={newCat} onChange={e => setNewCat(e.target.value)} className="max-w-xs rounded-xl" />
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { if (newCat.trim()) { addCategory(newCat.trim()); setNewCat(''); } }}>Adicionar</Button>
        </div>
      </div>

      {/* Period Filters */}
      <div className="metric-card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Period selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Período</label>
            <div className="flex rounded-xl overflow-hidden border border-border">
              {(['diario', 'semanal', 'mensal', 'anual'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); setOffset(0); }}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${period === p ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation + type filter */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Navegação</label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOffset(o => o - 1)}>← Anterior</Button>
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Calendar size={13} className="text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">{periodLabel}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}>Próximo →</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Select value={filterType} onValueChange={(v: 'todos' | 'entrada' | 'saida') => setFilterType(v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="metric-card">
        <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Movimentações ({filteredTx.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium text-muted-foreground text-xs">Data</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Descrição</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Categoria</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Tipo</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Valor</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma movimentação encontrada</td></tr>
              )}
              {filteredTx.map(t => (
                <tr key={t.id} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                  <td className="py-3 text-muted-foreground">{new Date(t.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="py-3 font-medium">{t.description}</td>
                  <td className="py-3"><span className="bg-muted/50 text-xs px-2.5 py-1 rounded-full font-medium">{t.category_name || 'Sem categoria'}</span></td>
                  <td className="py-3">
                    <span className={t.type === 'entrada' ? 'badge-success' : 'badge-danger'}>
                      {t.type === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono font-bold">{formatCurrency(Number(t.amount))}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => removeTransaction(t.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
