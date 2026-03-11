import { useState, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import MetricCard from '@/components/MetricCard';
import { DollarSign, TrendingUp, TrendingDown, Users, Banknote, Target, Percent, Download, CalendarCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function FechamentoPage() {
  const { getMonthlyClosing } = useFinance();
  const [month, setMonth] = useState(getCurrentMonth());
  const [year, setYear] = useState(getCurrentYear());
  const closing = getMonthlyClosing(month, year);
  const reportRef = useRef<HTMLDivElement>(null);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevClosing = getMonthlyClosing(prevMonth, prevYear);

  const revenueChange = prevClosing.totalRevenue > 0 ? ((closing.totalRevenue - prevClosing.totalRevenue) / prevClosing.totalRevenue * 100) : 0;
  const profitChange = prevClosing.netProfit !== 0 ? ((closing.netProfit - prevClosing.netProfit) / Math.abs(prevClosing.netProfit) * 100) : 0;

  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = [getCurrentYear() - 2, getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1];

  const exportPDF = async () => {
    if (!reportRef.current) return;
    toast.info('Gerando PDF...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Apply PDF-specific styles
      reportRef.current.classList.add('pdf-export');
      
      const canvas = await html2canvas(reportRef.current, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      reportRef.current.classList.remove('pdf-export');
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // If content is taller than one page, scale down
      const maxHeight = pdf.internal.pageSize.getHeight();
      if (pdfHeight > maxHeight) {
        const scale = maxHeight / pdfHeight;
        const scaledWidth = pdfWidth * scale;
        const offsetX = (pdfWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', offsetX, 0, scaledWidth, maxHeight);
      } else {
        pdf.addImage(imgData, 'PNG', 0, 5, pdfWidth, pdfHeight);
      }
      
      pdf.save(`fechamento_${getMonthName(month)}_${year}.pdf`);
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
          <h1 className="page-title">Fechamento Mensal</h1>
        </div>
        <Button onClick={exportPDF} variant="outline" size="sm" className="rounded-xl">
          <Download size={14} className="mr-2" /> PDF
        </Button>
      </div>
      <div className="flex items-center gap-3 mb-8 mt-4">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div ref={reportRef} className="pdf-report-container">
        {/* PDF Header - only visible during export */}
        <div className="pdf-header hidden">
          <div className="text-center mb-6 pb-4 border-b-2 border-primary">
            <img src="/logo-pdf.png" alt="Espetos & Cia" className="h-16 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mt-1">Relatório de Fechamento Mensal</p>
            <p className="text-lg font-semibold mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {getMonthName(month)} / {year}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8">
          <MetricCard label="Faturamento" value={closing.totalRevenue} icon={TrendingUp} variant="success" />
          <MetricCard label="Despesas" value={closing.totalExpenses} icon={TrendingDown} variant="danger" />
          <MetricCard label="Salários" value={closing.totalSalaries} icon={Users} />
          <MetricCard label="Vales" value={closing.totalVales} icon={Banknote} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          <MetricCard label="Lucro Líquido" value={closing.netProfit} icon={Target} variant={closing.netProfit >= 0 ? 'success' : 'danger'} />
          <MetricCard label="Margem Final" value={closing.margin} icon={Percent} isCurrency={false} isPercent variant="info" />
        </div>

        {/* Summary bar */}
        <div className="rounded-2xl border p-5 mb-8 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Receita Total</p>
              <p className="text-xl font-bold font-mono text-success">{formatCurrency(closing.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Custos Totais</p>
              <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(closing.totalExpenses + closing.totalSalaries)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Resultado</p>
              <p className={`text-xl font-bold font-mono ${closing.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(closing.netProfit)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Margem</p>
              <p className={`text-xl font-bold font-mono ${closing.margin >= 20 ? 'text-success' : 'text-destructive'}`}>
                {formatPercent(closing.margin)}
              </p>
            </div>
          </div>
        </div>

        {(prevClosing.totalRevenue > 0 || prevClosing.totalExpenses > 0) && (
          <div className="metric-card mb-8">
            <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              📊 Comparativo com {getMonthName(prevMonth)}/{prevYear}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Faturamento anterior</span>
                <p className="font-mono font-bold mt-2 text-lg">{formatCurrency(prevClosing.totalRevenue)}</p>
                <p className={`text-xs font-semibold mt-1 ${revenueChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {revenueChange >= 0 ? '▲' : '▼'} {Math.abs(revenueChange).toFixed(1)}%
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Lucro anterior</span>
                <p className="font-mono font-bold mt-2 text-lg">{formatCurrency(prevClosing.netProfit)}</p>
                <p className={`text-xs font-semibold mt-1 ${profitChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {profitChange >= 0 ? '▲' : '▼'} {Math.abs(profitChange).toFixed(1)}%
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Despesas anterior</span>
                <p className="font-mono font-bold mt-2 text-lg">{formatCurrency(prevClosing.totalExpenses)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Margem anterior</span>
                <p className="font-mono font-bold mt-2 text-lg">{formatPercent(prevClosing.margin)}</p>
              </div>
            </div>
          </div>
        )}

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
                {closing.employeeDetails.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum funcionário ativo</td></tr>
                )}
                {closing.employeeDetails.map((emp, i) => (
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
                {closing.employeeDetails.length > 0 && (
                  <tr className="border-t-2 border-primary/20 bg-primary/5">
                    <td className="py-3 font-bold">TOTAL</td>
                    <td className="py-3 text-right font-mono font-bold">{formatCurrency(closing.employeeDetails.reduce((s, e) => s + e.baseSalary, 0))}</td>
                    <td className="py-3 text-center font-bold">{closing.employeeDetails.reduce((s, e) => s + e.absences, 0)}</td>
                    <td className="py-3 text-center font-bold">{closing.employeeDetails.reduce((s, e) => s + e.halfDays, 0)}</td>
                    <td className="py-3 text-right font-mono font-bold text-destructive">-{formatCurrency(closing.employeeDetails.reduce((s, e) => s + e.absenceDiscount, 0))}</td>
                    <td className="py-3 text-right font-mono font-bold text-destructive">-{formatCurrency(closing.totalVales)}</td>
                    <td className="py-3 text-right font-mono font-bold text-lg">{formatCurrency(closing.totalSalaries)}</td>
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
