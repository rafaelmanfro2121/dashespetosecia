import { useState, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/formatters';
import { Plus, Trash2, UserCheck, UserX, Users, Upload, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function FuncionariosPage() {
  const { employees, addEmployee, updateEmployee, removeEmployee } = useFinance();
  const [form, setForm] = useState({
    name: '', age: '', job_function: '', salary: '3000', hire_date: new Date().toISOString().slice(0, 10),
    cpf: '', pix_key: '',
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome'); return; }
    try {
      await addEmployee({
        name: form.name,
        salary: parseFloat(form.salary),
        hire_date: form.hire_date,
        status: 'ativo',
        age: form.age ? parseInt(form.age) : null,
        job_function: form.job_function || '',
        cpf: form.cpf || '',
        pix_key: form.pix_key || '',
      });
      setForm({ name: '', age: '', job_function: '', salary: '3000', hire_date: new Date().toISOString().slice(0, 10), cpf: '', pix_key: '' });
      toast.success('Funcionário cadastrado');
    } catch { /* handled */ }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;
    setUploading(uploadTargetId);
    try {
      const ext = file.name.split('.').pop();
      const path = `${uploadTargetId}/contrato.${ext}`;
      const { error: uploadError } = await supabase.storage.from('contracts').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path);
      await supabase.from('employees').update({ contract_url: path }).eq('id', uploadTargetId);
      toast.success('Contrato anexado!');
      // Refresh
      const emp = employees.find(emp => emp.id === uploadTargetId);
      if (emp) updateEmployee({ ...emp, contract_url: path } as any);
    } catch (err) {
      toast.error('Erro ao enviar contrato');
      console.error(err);
    } finally {
      setUploading(null);
      setUploadTargetId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadContract = async (path: string) => {
    const { data, error } = await supabase.storage.from('contracts').download(path);
    if (error || !data) { toast.error('Erro ao baixar contrato'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'contrato';
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerUpload = (empId: string) => {
    setUploadTargetId(empId);
    fileInputRef.current?.click();
  };

  const active = employees.filter(e => e.status === 'ativo').length;

  return (
    <div>
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleFileUpload} />

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
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Input placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
            <Input type="number" placeholder="Idade" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} className="rounded-xl" />
            <Input placeholder="Função (ex: Soldador)" value={form.job_function} onChange={e => setForm({ ...form, job_function: e.target.value })} className="rounded-xl" />
            <Input type="number" step="0.01" placeholder="Salário" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} className="rounded-xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Input placeholder="CPF (000.000.000-00)" value={form.cpf} onChange={e => {
              let v = e.target.value.replace(/\D/g, '').slice(0, 11);
              if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
              else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
              else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
              setForm({ ...form, cpf: v });
            }} maxLength={14} className="rounded-xl" />
            <Input placeholder="Chave PIX" value={form.pix_key} onChange={e => setForm({ ...form, pix_key: e.target.value })} className="rounded-xl" />
            <Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} className="rounded-xl" />
            <Button type="submit" className="rounded-xl"><Plus size={16} className="mr-1" /> Cadastrar</Button>
          </div>
        </form>
      </div>

      <div className="metric-card">
        <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Equipe</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium text-muted-foreground text-xs">Nome</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Idade</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Função</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">CPF</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Chave PIX</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Salário</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Admissão</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Contrato</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">Nenhum funcionário cadastrado</td></tr>
              )}
              {employees.map(emp => {
                const empAny = emp as any;
                return (
                  <tr key={emp.id} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                    <td className="py-3 font-medium">{emp.name}</td>
                    <td className="py-3 text-muted-foreground">{empAny.age || '—'}</td>
                    <td className="py-3 text-muted-foreground">{empAny.job_function || '—'}</td>
                    <td className="py-3 text-muted-foreground font-mono text-xs">{empAny.cpf || '—'}</td>
                    <td className="py-3 text-muted-foreground font-mono text-xs">{empAny.pix_key || '—'}</td>
                    <td className="py-3 font-mono">{formatCurrency(Number(emp.salary))}</td>
                    <td className="py-3 text-muted-foreground">{new Date(emp.hire_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="py-3">
                      {empAny.contract_url ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => downloadContract(empAny.contract_url)} className="badge-info">
                            <Download size={12} /> Baixar
                          </button>
                          <button onClick={() => triggerUpload(emp.id)} className="text-muted-foreground hover:text-foreground">
                            <Upload size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => triggerUpload(emp.id)}
                          disabled={uploading === emp.id}
                          className="badge-warning"
                        >
                          {uploading === emp.id ? 'Enviando...' : <><Upload size={12} /> Anexar</>}
                        </button>
                      )}
                    </td>
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
