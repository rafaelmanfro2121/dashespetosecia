import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency } from '@/lib/formatters';
import { Transaction } from '@/types/finance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export default function FinanceiroPage() {
  const { transactions, categories, addTransaction, removeTransaction, addCategory, removeCategory, getMonthTransactions } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const monthTx = getMonthTransactions(month, year);

  const totalIn = monthTx.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0);
  const totalOut = monthTx.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0);

  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: '', category: '', type: 'saida' as 'entrada' | 'saida', amount: '', paymentMethod: 'Dinheiro' });
  const [aiInput, setAiInput] = useState('');
  const [newCat, setNewCat] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.category || !form.amount) { toast.error('Preencha todos os campos'); return; }
    addTransaction({ ...form, amount: parseFloat(form.amount) });
    setForm({ ...form, description: '', amount: '' });
    toast.success('Movimentação registrada');
  };

  const handleAI = () => {
    if (!aiInput.trim()) return;
    const text = aiInput.toLowerCase();
    // Simple NLP parser
    const valueMatch = text.match(/(\d+[\.,]?\d*)/);
    if (!valueMatch) { toast.error('Não encontrei um valor na mensagem'); return; }
    const amount = parseFloat(valueMatch[1].replace(',', '.'));

    const isEntry = /entrou|receb|vend|faturou|ganhou|receita/.test(text);
    const type: 'entrada' | 'saida' = isEntry ? 'entrada' : 'saida';

    let category = 'Outros';
    if (/carne|picanha|alcatra|frango|proteina/.test(text)) category = 'Carne';
    else if (/bebida|cerveja|refri|suco|água mineral/.test(text)) category = 'Bebidas';
    else if (/energia|luz|eletric/.test(text)) category = 'Energia';
    else if (/água|saneamento/.test(text)) category = 'Água';
    else if (/aluguel|locação/.test(text)) category = 'Aluguel';
    else if (/funcionário|salário/.test(text)) category = 'Funcionários';
    else if (/manutenção|conserto|reparo/.test(text)) category = 'Manutenção';
    else if (/material|descartável|embalagem/.test(text)) category = 'Materiais';
    else if (/vend|fatur/.test(text)) category = 'Vendas';

    addTransaction({
      date: new Date().toISOString().slice(0, 10),
      description: aiInput.trim(),
      category,
      type,
      amount,
      paymentMethod: 'Não especificado',
    });
    setAiInput('');
    toast.success(`IA registrou: ${type === 'entrada' ? 'Entrada' : 'Saída'} de ${formatCurrency(amount)} em ${category}`);
  };

  return (
    <div>
      <h1 className="page-title mb-1">Financeiro</h1>
      <p className="text-muted-foreground text-sm mb-6">{getMonthName(month)} de {year}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Entradas" value={totalIn} icon={TrendingUp} variant="success" />
        <MetricCard label="Saídas" value={totalOut} icon={TrendingDown} variant="danger" />
        <MetricCard label="Saldo" value={totalIn - totalOut} icon={DollarSign} variant={totalIn - totalOut >= 0 ? 'info' : 'danger'} />
      </div>

      {/* AI Input */}
      <div className="metric-card mb-6">
        <h3 className="section-label mb-3 flex items-center gap-2"><MessageSquare size={14} /> Registrar movimentação por mensagem</h3>
        <div className="flex gap-2">
          <Input
            placeholder='Ex: "Comprei 800 reais de carne" ou "Entrou 5200 no caixa"'
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAI()}
            className="flex-1"
          />
          <Button onClick={handleAI} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Registrar</Button>
        </div>
      </div>

      {/* Form */}
      <div className="metric-card mb-6">
        <h3 className="section-label mb-3">Nova Movimentação</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.type} onValueChange={(v: 'entrada' | 'saida') => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" step="0.01" placeholder="Valor" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <Button type="submit"><Plus size={16} className="mr-1" /> Adicionar</Button>
        </form>
      </div>

      {/* Category Manager */}
      <div className="metric-card mb-6">
        <h3 className="section-label mb-3">Categorias</h3>
        <div className="flex gap-2 flex-wrap mb-2">
          {categories.map(c => (
            <span key={c} className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full">
              {c}
              <button onClick={() => removeCategory(c)} className="hover:text-destructive"><Trash2 size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Nova categoria" value={newCat} onChange={e => setNewCat(e.target.value)} className="max-w-xs" />
          <Button variant="outline" size="sm" onClick={() => { if (newCat.trim()) { addCategory(newCat.trim()); setNewCat(''); } }}>Adicionar</Button>
        </div>
      </div>

      {/* Transactions table */}
      <div className="metric-card">
        <h3 className="section-label mb-3">Movimentações do Mês</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-muted-foreground">Data</th>
                <th className="pb-2 font-medium text-muted-foreground">Descrição</th>
                <th className="pb-2 font-medium text-muted-foreground">Categoria</th>
                <th className="pb-2 font-medium text-muted-foreground">Tipo</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Valor</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {monthTx.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma movimentação</td></tr>
              )}
              {monthTx.map(t => (
                <tr key={t.id} className="border-b border-muted/50 hover:bg-muted/30">
                  <td className="py-2">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                  <td className="py-2">{t.description}</td>
                  <td className="py-2"><span className="bg-muted text-xs px-2 py-0.5 rounded">{t.category}</span></td>
                  <td className="py-2">
                    <span className={t.type === 'entrada' ? 'text-success font-medium' : 'text-destructive font-medium'}>
                      {t.type === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono font-medium">{formatCurrency(t.amount)}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => removeTransaction(t.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
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
