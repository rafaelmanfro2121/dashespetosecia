import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function FuncionariosPage() {
  const { employees, addEmployee, updateEmployee, removeEmployee } = useFinance();
  const [form, setForm] = useState({ name: '', salary: '3000', hire_date: new Date().toISOString().slice(0, 10) });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome'); return; }
    try {
      await addEmployee({ name: form.name, salary: parseFloat(form.salary), hire_date: form.hire_date, status: 'ativo' });
      setForm({ name: '', salary: '3000', hire_date: new Date().toISOString().slice(0, 10) });
      toast.success('Funcionário cadastrado');
    } catch { /* handled */ }
  };

  const active = employees.filter(e => e.status === 'ativo').length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">Funcionários</h1>
          <p className="text-muted-foreground text-xs">{active} ativos de {employees.length} total</p>
        </div>
      </div>

      <div className="metric-card mb-6">
        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Novo Funcionário</h3>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
          <Input type="number" step="0.01" placeholder="Salário" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} className="rounded-xl" />
          <Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} className="rounded-xl" />
          <Button type="submit" className="rounded-xl"><Plus size={16} className="mr-1" /> Cadastrar</Button>
        </form>
      </div>

      <div className="metric-card">
        <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Equipe</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium text-muted-foreground text-xs">Nome</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Salário</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Valor/Dia</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Valor/Hora</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Admissão</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum funcionário cadastrado</td></tr>
              )}
              {employees.map(emp => {
                const daily = Number(emp.salary) / 30;
                const hourly = daily / 8;
                return (
                  <tr key={emp.id} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                    <td className="py-3 font-medium">{emp.name}</td>
                    <td className="py-3 font-mono">{formatCurrency(Number(emp.salary))}</td>
                    <td className="py-3 font-mono text-muted-foreground">{formatCurrency(daily)}</td>
                    <td className="py-3 font-mono text-muted-foreground">{formatCurrency(hourly)}</td>
                    <td className="py-3 text-muted-foreground">{new Date(emp.hire_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="py-3">
                      <button
                        onClick={() => updateEmployee({ ...emp, status: emp.status === 'ativo' ? 'inativo' : 'ativo' })}
                        className={emp.status === 'ativo' ? 'badge-success' : 'badge-danger'}
                      >
                        {emp.status === 'ativo' ? <><UserCheck size={12} /> Ativo</> : <><UserX size={12} /> Inativo</>}
                      </button>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => removeEmployee(emp.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
