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
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
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

      <div ref={reportRef}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <MetricCard label="Faturamento" value={closing.totalRevenue} icon={TrendingUp} variant="success" />
          <MetricCard label="Despesas" value={closing.totalExpenses} icon={TrendingDown} variant="danger" />
          <MetricCard label="Salários" value={closing.totalSalaries} icon={Users} />
          <MetricCard label="Vales" value={closing.totalVales} icon={Banknote} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          <MetricCard label="Lucro Líquido" value={closing.netProfit} icon={Target} variant={closing.netProfit >= 0 ? 'success' : 'danger'} />
          <MetricCard label="Margem Final" value={closing.margin} icon={Percent} isCurrency={false} isPercent variant="info" />
        </div>

        {(prevClosing.totalRevenue > 0 || prevClosing.totalExpenses > 0) && (
          <div className="metric-card mb-8">
            <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Comparativo com {getMonthName(prevMonth)}/{prevYear}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-muted/30">
                <span className="text-xs text-muted-foreground">Faturamento anterior</span>
                <p className="font-mono font-bold mt-1">{formatCurrency(prevClosing.totalRevenue)}</p>
                <p className={`text-xs font-semibold mt-0.5 ${revenueChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {revenueChange >= 0 ? '▲' : '▼'} {Math.abs(revenueChange).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <span className="text-xs text-muted-foreground">Lucro anterior</span>
                <p className="font-mono font-bold mt-1">{formatCurrency(prevClosing.netProfit)}</p>
                <p className={`text-xs font-semibold mt-0.5 ${profitChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {profitChange >= 0 ? '▲' : '▼'} {Math.abs(profitChange).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <span className="text-xs text-muted-foreground">Despesas anterior</span>
                <p className="font-mono font-bold mt-1">{formatCurrency(prevClosing.totalExpenses)}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <span className="text-xs text-muted-foreground">Margem anterior</span>
                <p className="font-mono font-bold mt-1">{formatPercent(prevClosing.margin)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="metric-card">
          <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Detalhamento por Funcionário</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground text-xs">Funcionário</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Salário Base</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs text-center">Faltas</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs text-center">½ Período</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Desc. Faltas</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Vales</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Salário Final</th>
                </tr>
              </thead>
              <tbody>
                {closing.employeeDetails.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum funcionário ativo</td></tr>
                )}
                {closing.employeeDetails.map(emp => (
                  <tr key={emp.employeeId} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                    <td className="py-3 font-medium">{emp.employeeName}</td>
                    <td className="py-3 text-right font-mono">{formatCurrency(emp.baseSalary)}</td>
                    <td className="py-3 text-center">{emp.absences}</td>
                    <td className="py-3 text-center">{emp.halfDays}</td>
                    <td className="py-3 text-right font-mono text-destructive">{emp.absenceDiscount > 0 ? `-${formatCurrency(emp.absenceDiscount)}` : '—'}</td>
                    <td className="py-3 text-right font-mono text-destructive">{emp.valesTotal > 0 ? `-${formatCurrency(emp.valesTotal)}` : '—'}</td>
                    <td className="py-3 text-right font-mono font-bold">{formatCurrency(emp.finalSalary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
