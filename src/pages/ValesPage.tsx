import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Banknote } from 'lucide-react';
import { toast } from 'sonner';

export default function ValesPage() {
  const { employees, vales, addVale, removeVale } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const activeEmployees = employees.filter(e => e.status === 'ativo');

  const [form, setForm] = useState({ employee_id: '', vale_date: new Date().toISOString().slice(0, 10), amount: '', description: '' });

  const monthVales = vales.filter(v => {
    const d = new Date(v.vale_date + 'T12:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const totalVales = monthVales.reduce((s, v) => s + Number(v.amount), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id || !form.amount) { toast.error('Preencha todos os campos'); return; }
    try {
      await addVale({ employee_id: form.employee_id, vale_date: form.vale_date, amount: parseFloat(form.amount), description: form.description });
      setForm({ ...form, amount: '', description: '' });
      toast.success('Vale registrado');
    } catch { /* handled */ }
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name || 'Desconhecido';

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Banknote size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">Vales</h1>
          <p className="text-muted-foreground text-xs">{getMonthName(month)} de {year} — Total: {formatCurrency(totalVales)}</p>
        </div>
      </div>

      <div className="h-6" />

      <div className="metric-card mb-6">
        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Registrar Vale</h3>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Funcionário" /></SelectTrigger>
            <SelectContent>{activeEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={form.vale_date} onChange={e => setForm({ ...form, vale_date: e.target.value })} className="rounded-xl" />
          <Input type="number" step="0.01" placeholder="Valor" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="rounded-xl" />
          <Input placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl" />
          <Button type="submit" className="rounded-xl"><Plus size={16} className="mr-1" /> Registrar</Button>
        </form>
      </div>

      <div className="metric-card">
        <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Vales do Mês</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-3 font-medium text-muted-foreground text-xs">Funcionário</th>
              <th className="pb-3 font-medium text-muted-foreground text-xs">Data</th>
              <th className="pb-3 font-medium text-muted-foreground text-xs">Descrição</th>
              <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Valor</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {monthVales.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum vale registrado</td></tr>
            )}
            {monthVales.map(v => (
              <tr key={v.id} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                <td className="py-3 font-medium">{getEmpName(v.employee_id)}</td>
                <td className="py-3 text-muted-foreground">{new Date(v.vale_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="py-3 text-muted-foreground">{v.description || '—'}</td>
                <td className="py-3 text-right font-mono font-bold">{formatCurrency(Number(v.amount))}</td>
                <td className="py-3 text-right">
                  <button onClick={() => removeVale(v.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
