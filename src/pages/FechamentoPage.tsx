import { useState, useEffect, useRef, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, TrendingDown, Users, Banknote, Target, Percent, Download, CalendarCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type PeriodType = 'diario' | 'semanal' | 'mensal' | 'anual';

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeeksInMonth(month: number, year: number): { label: string; start: Date; end: Date }[] {
  const weeks: { label: string; start: Date; end: Date }[] = [];
  const seen = new Set<string>();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const { start, end } = getWeekRange(date);
    const key = start.toISOString();
    if (!seen.has(key)) {
      seen.add(key);
      const startDay = start.getDate();
      const endDay = end.getDate();
      const startMonth = start.getMonth();
      const endMonth = end.getMonth();
      const label = startMonth === endMonth
        ? `${startDay} - ${endDay} ${getMonthName(startMonth).slice(0, 3)}`
        : `${startDay} ${getMonthName(startMonth).slice(0, 3)} - ${endDay} ${getMonthName(endMonth).slice(0, 3)}`;
      weeks.push({ label, start, end });
    }
  }
  return weeks;
}

export default function FechamentoPage() {
  const { transactions, employees, attendance, vales, getMonthlyClosing, refreshData } = useFinance();
  const [period, setPeriod] = useState<PeriodType>('mensal');
  const [month, setMonth] = useState(getCurrentMonth());
  const [year, setYear] = useState(getCurrentYear());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { refreshData(); }, [refreshData]);

  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = [getCurrentYear() - 2, getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weeks = useMemo(() => getWeeksInMonth(month, year), [month, year]);

  // Compute closing data based on period
  const closingData = useMemo(() => {
    if (period === 'mensal') {
      return getMonthlyClosing(month, year);
    }

    let filteredTx = transactions;
    let filteredAtt = attendance;
    let filteredVales = vales;

    if (period === 'diario') {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      filteredTx = transactions.filter(t => t.transaction_date === dateStr);
      filteredAtt = attendance.filter(a => a.presence_date === dateStr);
      filteredVales = vales.filter(v => v.vale_date === dateStr);
    } else if (period === 'semanal') {
      const week = weeks[selectedWeekIdx];
      if (week) {
        filteredTx = transactions.filter(t => {
          const d = new Date(t.transaction_date + 'T12:00:00');
          return d >= week.start && d <= week.end;
        });
        filteredAtt = attendance.filter(a => {
          const d = new Date(a.presence_date + 'T12:00:00');
          return d >= week.start && d <= week.end;
        });
        filteredVales = vales.filter(v => {
          const d = new Date(v.vale_date + 'T12:00:00');
          return d >= week.start && d <= week.end;
        });
      }
    } else if (period === 'anual') {
      filteredTx = transactions.filter(t => {
        const d = new Date(t.transaction_date + 'T12:00:00');
        return d.getFullYear() === year;
      });
      filteredAtt = attendance.filter(a => {
        const d = new Date(a.presence_date + 'T12:00:00');
        return d.getFullYear() === year;
      });
      filteredVales = vales.filter(v => {
        const d = new Date(v.vale_date + 'T12:00:00');
        return d.getFullYear() === year;
      });
    }

    const totalRevenue = filteredTx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = filteredTx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.amount), 0);

    const activeEmployees = employees.filter(e => e.status === 'ativo');
    const employeeDetails = activeEmployees.map(emp => {
      const empAtt = filteredAtt.filter(a => a.employee_id === emp.id);
      const absences = empAtt.filter(a => a.status === 'falta').length;
      const halfDays = empAtt.filter(a => a.status === 'meio-periodo').length;
      const presences = empAtt.filter(a => a.status === 'presente').length;
      const empVales = filteredVales.filter(v => v.employee_id === emp.id);
      const valesTotal = empVales.reduce((s, v) => s + Number(v.amount), 0);
      const baseSalary = Number(emp.salary);
      const paymentType = (emp as any).payment_type || 'mensal';

      let absenceDiscount = 0;
      let finalSalary = 0;

      if (period === 'diario') {
        if (paymentType === 'diaria') {
          finalSalary = presences > 0 ? baseSalary : halfDays > 0 ? baseSalary * 0.5 : 0;
        } else {
          finalSalary = 0; // Monthly salary not applicable per day
        }
        finalSalary = Math.max(0, finalSalary - valesTotal);
      } else if (paymentType === 'diaria') {
        const earned = (presences + halfDays * 0.5) * baseSalary;
        finalSalary = Math.max(0, earned - valesTotal);
      } else {
        // For weekly/annual of monthly employees, prorate
        if (period === 'anual') {
          absenceDiscount = 0; // Simplified for annual
          finalSalary = baseSalary * 12 - valesTotal;
        } else {
          // weekly
          absenceDiscount = 0;
          finalSalary = (baseSalary / 4) - valesTotal;
        }
        finalSalary = Math.max(0, finalSalary);
      }

      return { employeeId: emp.id, employeeName: emp.name, baseSalary, absences, halfDays, absenceDiscount, valesTotal, finalSalary };
    });

    const totalSalaries = employeeDetails.reduce((s, e) => s + e.finalSalary, 0);
    const totalVales = employeeDetails.reduce((s, e) => s + e.valesTotal, 0);
    const netProfit = totalRevenue - totalExpenses - totalSalaries;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { month, year, totalRevenue, totalExpenses, totalSalaries, totalVales, netProfit, margin, employeeDetails };
  }, [period, month, year, selectedDay, selectedWeekIdx, weeks, transactions, employees, attendance, vales, getMonthlyClosing]);

  const periodLabel = useMemo(() => {
    if (period === 'diario') return `${selectedDay}/${month + 1}/${year}`;
    if (period === 'semanal') return weeks[selectedWeekIdx]?.label || '';
    if (period === 'mensal') return `${getMonthName(month)} ${year}`;
    return `${year}`;
  }, [period, selectedDay, month, year, selectedWeekIdx, weeks]);

  const exportPDF = async () => {
    if (!reportRef.current) return;
    toast.info('Gerando PDF...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      reportRef.current.classList.add('pdf-export');
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      reportRef.current.classList.remove('pdf-export');
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const maxHeight = pdf.internal.pageSize.getHeight();
      if (pdfHeight > maxHeight) {
        const scale = maxHeight / pdfHeight;
        const scaledWidth = pdfWidth * scale;
        const offsetX = (pdfWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', offsetX, 0, scaledWidth, maxHeight);
      } else {
        pdf.addImage(imgData, 'PNG', 0, 5, pdfWidth, pdfHeight);
      }
      pdf.save(`fechamento_${periodLabel.replace(/\//g, '-')}.pdf`);
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
            <CalendarCheck size={22} className="text-primary" />
          </div>
          <h1 className="page-title">Fechamento</h1>
        </div>
        <Button onClick={exportPDF} variant="outline" size="sm" className="rounded-xl">
          <Download size={14} className="mr-2" /> PDF
        </Button>
      </div>

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodType)} className="mt-4 mb-4">
        <TabsList className="rounded-xl w-full grid grid-cols-4">
          <TabsTrigger value="diario" className="rounded-xl text-xs sm:text-sm">Diário</TabsTrigger>
          <TabsTrigger value="semanal" className="rounded-xl text-xs sm:text-sm">Semanal</TabsTrigger>
          <TabsTrigger value="mensal" className="rounded-xl text-xs sm:text-sm">Mensal</TabsTrigger>
          <TabsTrigger value="anual" className="rounded-xl text-xs sm:text-sm">Anual</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {period !== 'anual' && (
          <>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>)}</SelectContent>
            </Select>
          </>
        )}
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        {period === 'diario' && (
          <Select value={String(selectedDay)} onValueChange={v => setSelectedDay(Number(v))}>
            <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{days.map(d => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {period === 'semanal' && (
          <Select value={String(selectedWeekIdx)} onValueChange={v => setSelectedWeekIdx(Number(v))}>
            <SelectTrigger className="w-52 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{weeks.map((w, i) => <SelectItem key={i} value={String(i)}>{w.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <div ref={reportRef} className="pdf-report-container">
        {/* PDF Header */}
        <div className="pdf-header hidden">
          <div className="text-center mb-6 pb-4 border-b-2 border-primary">
            <img src="/logo-pdf.png" alt="Espetos & Cia" className="h-16 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mt-1">Relatório de Fechamento — {period === 'diario' ? 'Diário' : period === 'semanal' ? 'Semanal' : period === 'mensal' ? 'Mensal' : 'Anual'}</p>
            <p className="text-lg font-semibold mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {periodLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8">
          <MetricCard label="Faturamento" value={closingData.totalRevenue} icon={TrendingUp} variant="success" />
          <MetricCard label="Despesas" value={closingData.totalExpenses} icon={TrendingDown} variant="danger" />
          <MetricCard label="Salários" value={closingData.totalSalaries} icon={Users} />
          <MetricCard label="Vales" value={closingData.totalVales} icon={Banknote} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 mb-8">
          <MetricCard label="Lucro Líquido" value={closingData.netProfit} icon={Target} variant={closingData.netProfit >= 0 ? 'success' : 'danger'} />
          <MetricCard label="Margem Final" value={closingData.margin} icon={Percent} isCurrency={false} isPercent variant="info" />
        </div>

        {/* Summary bar */}
        <div className="rounded-2xl border p-5 mb-8 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Receita Total</p>
              <p className="text-xl font-bold font-mono text-success">{formatCurrency(closingData.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Custos Totais</p>
              <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(closingData.totalExpenses + closingData.totalSalaries)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Resultado</p>
              <p className={`text-xl font-bold font-mono ${closingData.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(closingData.netProfit)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Margem</p>
              <p className={`text-xl font-bold font-mono ${closingData.margin >= 20 ? 'text-success' : 'text-destructive'}`}>
                {formatPercent(closingData.margin)}
              </p>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>👥 Detalhamento por Funcionário</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/20 text-left">
                  <th className="pb-3 font-semibold text-foreground text-xs uppercase tracking-wider">Funcionário</th>
                  <th className="pb-3 font-semibold text-foreground text-xs uppercase tracking-wider text-right">Salário Base</th>
                  <th className="pb-3 font-semibold text-foreground text-xs uppercase tracking-wider text-center">Faltas</th>
                  <th className="pb-3 font-semibold text-foreground text-xs uppercase tracking-wider text-center">½ Período</th>
                  <th className="pb-3 font-semibold text-foreground text-xs uppercase tracking-wider text-right">Desc. Faltas</th>
                  <th className="pb-3 font-semibold text-foreground text-xs uppercase tracking-wider text-right">Vales</th>
                  <th className="pb-3 font-semibold text-foreground text-xs uppercase tracking-wider text-right">Salário Final</th>
                </tr>
              </thead>
              <tbody>
                {closingData.employeeDetails.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum funcionário ativo</td></tr>
                )}
                {closingData.employeeDetails.map((emp, i) => (
                  <tr key={emp.employeeId} className={`border-b border-muted/40 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? 'bg-muted/5' : ''}`}>
                    <td className="py-3 font-medium">{emp.employeeName}</td>
                    <td className="py-3 text-right font-mono">{formatCurrency(emp.baseSalary)}</td>
                    <td className="py-3 text-center">
                      <span className={emp.absences > 0 ? 'badge-danger' : 'text-muted-foreground'}>{emp.absences}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={emp.halfDays > 0 ? 'badge-warning' : 'text-muted-foreground'}>{emp.halfDays}</span>
                    </td>
                    <td className="py-3 text-right font-mono text-destructive">{emp.absenceDiscount > 0 ? `-${formatCurrency(emp.absenceDiscount)}` : '—'}</td>
                    <td className="py-3 text-right font-mono text-destructive">{emp.valesTotal > 0 ? `-${formatCurrency(emp.valesTotal)}` : '—'}</td>
                    <td className="py-3 text-right font-mono font-bold text-lg">{formatCurrency(emp.finalSalary)}</td>
                  </tr>
                ))}
                {closingData.employeeDetails.length > 0 && (
                  <tr className="border-t-2 border-primary/20 bg-primary/5">
                    <td className="py-3 font-bold">TOTAL</td>
                    <td className="py-3 text-right font-mono font-bold">{formatCurrency(closingData.employeeDetails.reduce((s, e) => s + e.baseSalary, 0))}</td>
                    <td className="py-3 text-center font-bold">{closingData.employeeDetails.reduce((s, e) => s + e.absences, 0)}</td>
                    <td className="py-3 text-center font-bold">{closingData.employeeDetails.reduce((s, e) => s + e.halfDays, 0)}</td>
                    <td className="py-3 text-right font-mono font-bold text-destructive">-{formatCurrency(closingData.employeeDetails.reduce((s, e) => s + e.absenceDiscount, 0))}</td>
                    <td className="py-3 text-right font-mono font-bold text-destructive">-{formatCurrency(closingData.totalVales)}</td>
                    <td className="py-3 text-right font-mono font-bold text-lg">{formatCurrency(closingData.totalSalaries)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PDF Footer */}
        <div className="pdf-footer hidden mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
          <p>Espetos & Cia — Relatório gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}
