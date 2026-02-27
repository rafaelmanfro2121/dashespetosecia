import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ValesPage() {
  const { employees, vales, addVale, removeVale } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const activeEmployees = employees.filter(e => e.status === 'ativo');

  const [form, setForm] = useState({ employeeId: '', date: new Date().toISOString().slice(0, 10), amount: '', description: '' });

  const monthVales = vales.filter(v => {
    const d = new Date(v.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId || !form.amount) { toast.error('Preencha todos os campos'); return; }
    addVale({ employeeId: form.employeeId, date: form.date, amount: parseFloat(form.amount), description: form.description });
    setForm({ ...form, amount: '', description: '' });
    toast.success('Vale registrado');
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name || 'Desconhecido';

  return (
    <div>
      <h1 className="page-title mb-1">Vales</h1>
      <p className="text-muted-foreground text-sm mb-6">{getMonthName(month)} de {year}</p>

      <div className="metric-card mb-6">
        <h3 className="section-label mb-3">Registrar Vale</h3>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select value={form.employeeId} onValueChange={v => setForm({ ...form, employeeId: v })}>
            <SelectTrigger><SelectValue placeholder="Funcionário" /></SelectTrigger>
            <SelectContent>{activeEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Valor" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <Input placeholder="Descrição (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Button type="submit"><Plus size={16} className="mr-1" /> Registrar</Button>
        </form>
      </div>

      <div className="metric-card">
        <h3 className="section-label mb-3">Vales do Mês</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium text-muted-foreground">Funcionário</th>
              <th className="pb-2 font-medium text-muted-foreground">Data</th>
              <th className="pb-2 font-medium text-muted-foreground">Descrição</th>
              <th className="pb-2 font-medium text-muted-foreground text-right">Valor</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {monthVales.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum vale registrado</td></tr>
            )}
            {monthVales.map(v => (
              <tr key={v.id} className="border-b border-muted/50 hover:bg-muted/30">
                <td className="py-2 font-medium">{getEmpName(v.employeeId)}</td>
                <td className="py-2">{new Date(v.date).toLocaleDateString('pt-BR')}</td>
                <td className="py-2 text-muted-foreground">{v.description || '—'}</td>
                <td className="py-2 text-right font-mono font-medium">{formatCurrency(v.amount)}</td>
                <td className="py-2 text-right">
                  <button onClick={() => removeVale(v.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
