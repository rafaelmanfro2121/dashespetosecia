import { useState, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, getCurrentMonth, getCurrentYear, getMonthName, getDaysInMonth } from '@/lib/formatters';
import { Plus, Trash2, UserCheck, UserX, Users, Upload, Download, ClipboardCheck, Banknote, FileText } from 'lucide-react';
import { toast } from 'sonner';

type AttendanceStatus = 'presente' | 'falta' | 'meio-periodo';

const statusColors: Record<AttendanceStatus, string> = {
  'presente': 'bg-success/15 text-success border-success/30',
  'falta': 'bg-destructive/15 text-destructive border-destructive/30',
  'meio-periodo': 'bg-warning/15 text-warning border-warning/30',
};
const statusLabels: Record<AttendanceStatus, string> = {
  'presente': 'P', 'falta': 'F', 'meio-periodo': '½',
};

export default function FuncionariosPage() {
  const { employees, addEmployee, updateEmployee, removeEmployee, attendance, addAttendance, vales, addVale, removeVale } = useFinance();
  const [form, setForm] = useState({
    name: '', age: '', job_function: '', salary: '3000', hire_date: new Date().toISOString().slice(0, 10),
    cpf: '', pix_key: '', payment_type: 'mensal' as 'mensal' | 'diaria',
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  // Vales form
  const [valeForm, setValeForm] = useState({ employee_id: '', vale_date: new Date().toISOString().slice(0, 10), amount: '', description: '' });

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const activeEmployees = employees.filter(e => e.status === 'ativo');
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = [getCurrentYear() - 2, getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1];

  // Attendance helpers
  const getStatus = (empId: string, day: number): AttendanceStatus | null => {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = attendance.find(a => a.employee_id === empId && a.presence_date === dateStr);
    return (record?.status as AttendanceStatus) || null;
  };

  const cycleStatus = (empId: string, day: number) => {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const current = getStatus(empId, day);
    const cycle: AttendanceStatus[] = ['presente', 'falta', 'meio-periodo'];
    const nextIdx = current ? (cycle.indexOf(current) + 1) % cycle.length : 0;
    addAttendance({ employee_id: empId, presence_date: dateStr, status: cycle[nextIdx] });
  };

  // Vales helpers
  const monthVales = vales.filter(v => {
    const d = new Date(v.vale_date + 'T12:00:00');
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });
  const totalVales = monthVales.reduce((s, v) => s + Number(v.amount), 0);

  const handleAddVale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valeForm.employee_id || !valeForm.amount) { toast.error('Preencha todos os campos'); return; }
    try {
      await addVale({ employee_id: valeForm.employee_id, vale_date: valeForm.vale_date, amount: parseFloat(valeForm.amount), description: valeForm.description });
      setValeForm({ ...valeForm, amount: '', description: '' });
      toast.success('Vale registrado');
    } catch { /* handled */ }
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name || 'Desconhecido';

  // CPF mask
  const handleCpfChange = (value: string) => {
    let v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    setForm({ ...form, cpf: v });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Informe o nome'); return; }
    try {
      await addEmployee({
        name: form.name, salary: parseFloat(form.salary), hire_date: form.hire_date, status: 'ativo',
        age: form.age ? parseInt(form.age) : null, job_function: form.job_function || '',
        cpf: form.cpf || '', pix_key: form.pix_key || '', payment_type: form.payment_type,
      });
      setForm({ name: '', age: '', job_function: '', salary: '3000', hire_date: new Date().toISOString().slice(0, 10), cpf: '', pix_key: '', payment_type: 'mensal' });
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
      await supabase.from('employees').update({ contract_url: path }).eq('id', uploadTargetId);
      toast.success('Contrato anexado!');
      const emp = employees.find(emp => emp.id === uploadTargetId);
      if (emp) updateEmployee({ ...emp, contract_url: path } as any);
    } catch (err) {
      toast.error('Erro ao enviar contrato');
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
    a.href = url; a.download = path.split('/').pop() || 'contrato'; a.click();
    URL.revokeObjectURL(url);
  };

  const triggerUpload = (empId: string) => {
    setUploadTargetId(empId);
    fileInputRef.current?.click();
  };

  // Generate salary receipt PDF
  const generateReceipt = async (emp: any) => {
    toast.info('Gerando comprovante...');
    try {
      const jsPDF = (await import('jspdf')).default;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();

      // Employee attendance for the month
      const monthAtt = attendance.filter(a => {
        const d = new Date(a.presence_date + 'T12:00:00');
        return a.employee_id === emp.id && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
      const presences = monthAtt.filter(a => a.status === 'presente').length;
      const absences = monthAtt.filter(a => a.status === 'falta').length;
      const halfDays = monthAtt.filter(a => a.status === 'meio-periodo').length;
      const empVales = vales.filter(v => {
        const d = new Date(v.vale_date + 'T12:00:00');
        return v.employee_id === emp.id && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
      const valesTotal = empVales.reduce((s, v) => s + Number(v.amount), 0);

      const paymentType = emp.payment_type || 'mensal';
      const salaryValue = Number(emp.salary);
      let absenceDiscount = 0;
      let finalSalary = 0;
      let hoursWorked = (presences * 8) + (halfDays * 4);

      if (paymentType === 'diaria') {
        const earned = (presences + halfDays * 0.5) * salaryValue;
        finalSalary = Math.max(0, earned - valesTotal);
      } else {
        const dailyRate = salaryValue / 30;
        absenceDiscount = (absences * dailyRate) + (halfDays * dailyRate * 0.5);
        finalSalary = Math.max(0, salaryValue - absenceDiscount - valesTotal);
      }

      // PDF Content
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('ESPETOS & CIA', pw / 2, 20, { align: 'center' });
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Comprovante de Pagamento de Salário', pw / 2, 28, { align: 'center' });
      pdf.setDrawColor(59, 130, 246);
      pdf.setLineWidth(0.5);
      pdf.line(20, 32, pw - 20, 32);

      pdf.setFontSize(11);
      pdf.text(`Referência: ${getMonthName(selectedMonth)} / ${selectedYear}`, pw / 2, 40, { align: 'center' });

      // Employee info
      let y = 50;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('DADOS DO FUNCIONÁRIO', 20, y);
      y += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const info = [
        ['Nome:', emp.name],
        ['CPF:', emp.cpf || '—'],
        ['Função:', emp.job_function || '—'],
        ['Tipo Pagamento:', paymentType === 'diaria' ? 'Diária' : 'Mensal Fixo'],
        ['Chave PIX:', emp.pix_key || '—'],
        ['Data Admissão:', new Date(emp.hire_date + 'T12:00:00').toLocaleDateString('pt-BR')],
      ];
      info.forEach(([label, val]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, 25, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(val), 65, y);
        y += 5;
      });

      // Attendance summary
      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('FREQUÊNCIA', 20, y);
      y += 6;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const attInfo = [
        ['Dias Presentes:', String(presences)],
        ['Meio Período:', String(halfDays)],
        ['Faltas:', String(absences)],
        ['Horas Trabalhadas:', `${hoursWorked}h`],
      ];
      if (paymentType === 'diaria') {
        attInfo.push(['Valor da Diária:', formatCurrencySimple(salaryValue)]);
        attInfo.push(['Total Bruto (dias):', formatCurrencySimple((presences + halfDays * 0.5) * salaryValue)]);
      } else {
        const hourlyRate = (salaryValue / 30) / 8;
        attInfo.push(['Valor Hora:', formatCurrencySimple(hourlyRate)]);
      }
      attInfo.forEach(([label, val]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, 25, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(val), 75, y);
        y += 5;
      });

      // Payment breakdown
      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('DEMONSTRATIVO DE PAGAMENTO', 20, y);
      y += 7;

      // Table header
      pdf.setFillColor(59, 130, 246);
      pdf.rect(20, y - 4, pw - 40, 7, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text('Descrição', 25, y);
      pdf.text('Valor', pw - 25, y, { align: 'right' });
      pdf.setTextColor(0, 0, 0);
      y += 8;

      const rows: string[][] = [];
      if (paymentType === 'diaria') {
        rows.push(['Diárias Trabalhadas (' + presences + ' dias + ' + halfDays + ' meio)', formatCurrencySimple((presences + halfDays * 0.5) * salaryValue)]);
      } else {
        rows.push(['Salário Base (Mensal)', formatCurrencySimple(salaryValue)]);
        rows.push([`Desconto Faltas (${absences} dias)`, absenceDiscount > 0 ? `- ${formatCurrencySimple(absenceDiscount)}` : '—']);
        if (halfDays > 0) rows.push([`Desconto Meio Período (${halfDays} dias)`, '(incluso acima)']);
      }

      // Add each vale as a row
      empVales.forEach(v => {
        rows.push([`Vale - ${v.description || new Date(v.vale_date + 'T12:00:00').toLocaleDateString('pt-BR')}`, `- ${formatCurrencySimple(Number(v.amount))}`]);
      });

      if (empVales.length === 0) {
        rows.push(['Vales', '—']);
      }

      pdf.setFontSize(9);
      rows.forEach(([desc, val], i) => {
        if (i % 2 === 0) {
          pdf.setFillColor(245, 247, 250);
          pdf.rect(20, y - 4, pw - 40, 6, 'F');
        }
        pdf.setFont('helvetica', 'normal');
        pdf.text(desc, 25, y);
        pdf.text(val, pw - 25, y, { align: 'right' });
        y += 6;
      });

      // Total
      y += 2;
      pdf.setDrawColor(59, 130, 246);
      pdf.setLineWidth(0.5);
      pdf.line(20, y - 3, pw - 20, y - 3);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('VALOR LÍQUIDO:', 25, y + 3);
      pdf.setTextColor(34, 139, 34);
      pdf.text(formatCurrencySimple(finalSalary), pw - 25, y + 3, { align: 'right' });
      pdf.setTextColor(0, 0, 0);

      // Footer
      y += 20;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(120, 120, 120);
      pdf.text('_______________________________', 30, y);
      pdf.text('_______________________________', pw - 30, y, { align: 'right' });
      y += 5;
      pdf.text('Assinatura do Empregador', 30, y);
      pdf.text('Assinatura do Funcionário', pw - 30, y, { align: 'right' });

      y += 15;
      pdf.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pw / 2, y, { align: 'center' });
      pdf.text('Espetos & Cia — Sistema de Gestão', pw / 2, y + 5, { align: 'center' });
      pdf.setTextColor(0, 0, 0);

      pdf.save(`comprovante_${emp.name.replace(/\s/g, '_')}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`);
      toast.success('Comprovante gerado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const active = employees.filter(e => e.status === 'ativo').length;

  return (
    <div>
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleFileUpload} />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">Funcionários</h1>
          <p className="text-muted-foreground text-xs">{active} ativos de {employees.length} total</p>
        </div>
      </div>

      <Tabs defaultValue="equipe" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 rounded-xl">
          <TabsTrigger value="equipe" className="rounded-xl gap-1.5"><Users size={14} /> Equipe</TabsTrigger>
          <TabsTrigger value="presenca" className="rounded-xl gap-1.5"><ClipboardCheck size={14} /> Presença</TabsTrigger>
          <TabsTrigger value="vales" className="rounded-xl gap-1.5"><Banknote size={14} /> Vales</TabsTrigger>
        </TabsList>

        {/* === EQUIPE TAB === */}
        <TabsContent value="equipe">
          <div className="metric-card mb-6">
            <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Novo Funcionário</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <Input placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
                <Input type="number" placeholder="Idade" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} className="rounded-xl" />
                <Input placeholder="Função (ex: Soldador)" value={form.job_function} onChange={e => setForm({ ...form, job_function: e.target.value })} className="rounded-xl" />
                <Select value={form.payment_type} onValueChange={v => setForm({ ...form, payment_type: v as 'mensal' | 'diaria' })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Tipo Pgto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal (fixo)</SelectItem>
                    <SelectItem value="diaria">Diária</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" step="0.01" placeholder={form.payment_type === 'diaria' ? 'Valor da diária' : 'Salário mensal'} value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <Input placeholder="CPF" value={form.cpf} onChange={e => handleCpfChange(e.target.value)} maxLength={14} className="rounded-xl" />
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
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Função</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Tipo</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">CPF</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">PIX</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Valor</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Contrato</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum funcionário cadastrado</td></tr>
                  )}
                  {employees.map(emp => {
                    const empAny = emp as any;
                    return (
                      <tr key={emp.id} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                        <td className="py-3">
                          <span className="font-medium">{emp.name}</span>
                          {empAny.age && <span className="text-xs text-muted-foreground ml-1">({empAny.age}a)</span>}
                        </td>
                        <td className="py-3 text-muted-foreground text-xs">{empAny.job_function || '—'}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${empAny.payment_type === 'diaria' ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'}`}>
                            {empAny.payment_type === 'diaria' ? 'Diária' : 'Mensal'}
                          </span>
                        </td>
                        <td className="py-3 text-muted-foreground font-mono text-xs">{empAny.cpf || '—'}</td>
                        <td className="py-3 text-muted-foreground font-mono text-xs">{empAny.pix_key || '—'}</td>
                        <td className="py-3 font-mono">
                          {formatCurrency(Number(emp.salary))}
                          <span className="text-muted-foreground text-[10px] ml-1">{empAny.payment_type === 'diaria' ? '/dia' : '/mês'}</span>
                        </td>
                        <td className="py-3">
                          {empAny.contract_url ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => downloadContract(empAny.contract_url)} className="badge-info"><Download size={12} /> Baixar</button>
                              <button onClick={() => triggerUpload(emp.id)} className="text-muted-foreground hover:text-foreground"><Upload size={12} /></button>
                            </div>
                          ) : (
                            <button onClick={() => triggerUpload(emp.id)} disabled={uploading === emp.id} className="badge-warning">
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
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => generateReceipt(empAny)} className="text-primary hover:text-primary/80" title="Gerar comprovante de pagamento">
                              <FileText size={14} />
                            </button>
                            <button onClick={() => removeEmployee(emp.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* === PRESENÇA TAB === */}
        <TabsContent value="presenca">
          <div className="flex items-center gap-3 mb-4">
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Clique para alternar: P / F / ½</p>
          </div>
          {activeEmployees.length === 0 ? (
            <div className="metric-card text-center py-12 text-muted-foreground">Cadastre funcionários primeiro</div>
          ) : (
            <div className="metric-card overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-muted-foreground sticky left-0 bg-card min-w-[130px] text-xs">Funcionário</th>
                    {days.map(d => <th key={d} className="pb-3 text-center font-medium text-muted-foreground w-8">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.map(emp => (
                    <tr key={emp.id} className="border-b border-muted/40">
                      <td className="py-2 font-medium sticky left-0 bg-card">{emp.name}</td>
                      {days.map(d => {
                        const status = getStatus(emp.id, d);
                        return (
                          <td key={d} className="py-2 text-center">
                            <button
                              onClick={() => cycleStatus(emp.id, d)}
                              className={`w-7 h-7 rounded-lg text-[10px] font-bold border transition-all duration-150 hover:scale-110 ${status ? statusColors[status] : 'bg-muted/20 text-muted-foreground/30 border-transparent hover:bg-muted/50'}`}
                            >
                              {status ? statusLabels[status] : '·'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* === VALES TAB === */}
        <TabsContent value="vales">
          <div className="flex items-center gap-3 mb-4">
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Total: {formatCurrency(totalVales)}</p>
          </div>

          <div className="metric-card mb-6">
            <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Registrar Vale</h3>
            <form onSubmit={handleAddVale} className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Select value={valeForm.employee_id} onValueChange={v => setValeForm({ ...valeForm, employee_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Funcionário" /></SelectTrigger>
                <SelectContent>{activeEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" value={valeForm.vale_date} onChange={e => setValeForm({ ...valeForm, vale_date: e.target.value })} className="rounded-xl" />
              <Input type="number" step="0.01" placeholder="Valor" value={valeForm.amount} onChange={e => setValeForm({ ...valeForm, amount: e.target.value })} className="rounded-xl" />
              <Input placeholder="Descrição (opcional)" value={valeForm.description} onChange={e => setValeForm({ ...valeForm, description: e.target.value })} className="rounded-xl" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatCurrencySimple(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
