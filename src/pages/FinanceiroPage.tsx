import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, MessageSquare, Search, Filter, DollarSign, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function FinanceiroPage() {
  const { transactions, categories, addTransaction, removeTransaction, addCategory, removeCategory, getMonthTransactions } = useFinance();
  const { user } = useAuth();

  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());
  const [filterYear, setFilterYear] = useState(getCurrentYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'entrada' | 'saida'>('todos');

  const monthTx = getMonthTransactions(filterMonth, filterYear);
  const filteredTx = monthTx.filter(t => {
    const matchesSearch = !searchTerm || t.description.toLowerCase().includes(searchTerm.toLowerCase()) || (t.category_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'todos' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  const totalIn = monthTx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = monthTx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.amount), 0);

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
    } catch { /* handled */ }
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

      setAiInput('');
      toast.success(`IA: ${result.type === 'entrada' ? 'Entrada' : 'Saída'} de ${formatCurrency(result.amount)}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar');
    } finally {
      setAiLoading(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = [getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1];

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <DollarSign size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="text-muted-foreground text-xs">{getMonthName(filterMonth)} de {filterYear}</p>
        </div>
      </div>

      <div className="h-6" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <MetricCard label="Entradas" value={totalIn} icon={TrendingUp} variant="success" />
        <MetricCard label="Saídas" value={totalOut} icon={TrendingDown} variant="danger" />
        <MetricCard label="Saldo" value={totalIn - totalOut} icon={DollarSign} variant={totalIn - totalOut >= 0 ? 'info' : 'danger'} />
      </div>

      {/* AI Input */}
      <div className="metric-card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Registro Inteligente</h3>
          <span className="badge-info text-[10px] ml-auto">Powered by IA</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder='Ex: "Comprei 800 reais de aço" ou "Entrou 12.500 da venda de churrasqueira"'
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
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-6 gap-3">
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

      {/* Filters */}
      <div className="metric-card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Filtros</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(Number(v))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={v => setFilterYear(Number(v))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
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
