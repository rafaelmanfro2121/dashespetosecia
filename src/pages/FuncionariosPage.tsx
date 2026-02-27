import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Trash2, UserCheck, UserX } from 'lucide-react';
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

  return (
    <div>
      <h1 className="page-title mb-6">Funcionários</h1>

      <div className="metric-card mb-6">
        <h3 className="section-label mb-3">Novo Funcionário</h3>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Salário" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
          <Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} />
          <Button type="submit"><Plus size={16} className="mr-1" /> Cadastrar</Button>
        </form>
      </div>

      <div className="metric-card">
        <h3 className="section-label mb-3">Equipe ({employees.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-muted-foreground">Nome</th>
                <th className="pb-2 font-medium text-muted-foreground">Salário</th>
                <th className="pb-2 font-medium text-muted-foreground">Valor/Dia</th>
                <th className="pb-2 font-medium text-muted-foreground">Valor/Hora</th>
                <th className="pb-2 font-medium text-muted-foreground">Admissão</th>
                <th className="pb-2 font-medium text-muted-foreground">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum funcionário cadastrado</td></tr>
              )}
              {employees.map(emp => {
                const daily = Number(emp.salary) / 30;
                const hourly = daily / 8;
                return (
                  <tr key={emp.id} className="border-b border-muted/50 hover:bg-muted/30">
                    <td className="py-2 font-medium">{emp.name}</td>
                    <td className="py-2 font-mono">{formatCurrency(Number(emp.salary))}</td>
                    <td className="py-2 font-mono">{formatCurrency(daily)}</td>
                    <td className="py-2 font-mono">{formatCurrency(hourly)}</td>
                    <td className="py-2">{new Date(emp.hire_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="py-2">
                      <button
                        onClick={() => updateEmployee({ ...emp, status: emp.status === 'ativo' ? 'inativo' : 'ativo' })}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${emp.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
                      >
                        {emp.status === 'ativo' ? <><UserCheck size={12} /> Ativo</> : <><UserX size={12} /> Inativo</>}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => removeEmployee(emp.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
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
