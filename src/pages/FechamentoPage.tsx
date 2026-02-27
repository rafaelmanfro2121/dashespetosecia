import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import MetricCard from '@/components/MetricCard';
import { DollarSign, TrendingUp, TrendingDown, Users, Banknote, Target, Percent } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FechamentoPage() {
  const { getMonthlyClosing } = useFinance();
  const [month, setMonth] = useState(getCurrentMonth());
  const [year, setYear] = useState(getCurrentYear());
  const closing = getMonthlyClosing(month, year);

  // Compare with previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevClosing = getMonthlyClosing(prevMonth, prevYear);

  const revenueChange = prevClosing.totalRevenue > 0 ? ((closing.totalRevenue - prevClosing.totalRevenue) / prevClosing.totalRevenue * 100) : 0;
  const profitChange = prevClosing.netProfit !== 0 ? ((closing.netProfit - prevClosing.netProfit) / Math.abs(prevClosing.netProfit) * 100) : 0;

  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = [getCurrentYear() - 2, getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1];

  return (
    <div>
      <h1 className="page-title mb-1">Fechamento Mensal</h1>
      <div className="flex items-center gap-3 mb-6">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Faturamento" value={closing.totalRevenue} icon={TrendingUp} variant="success" />
        <MetricCard label="Despesas" value={closing.totalExpenses} icon={TrendingDown} variant="danger" />
        <MetricCard label="Salários" value={closing.totalSalaries} icon={Users} />
        <MetricCard label="Vales" value={closing.totalVales} icon={Banknote} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <MetricCard label="Lucro Líquido" value={closing.netProfit} icon={Target} variant={closing.netProfit >= 0 ? 'success' : 'danger'} />
        <MetricCard label="Margem Final" value={closing.margin} icon={Percent} isCurrency={false} isPercent variant="info" />
      </div>

      {/* Month comparison */}
      {(prevClosing.totalRevenue > 0 || prevClosing.totalExpenses > 0) && (
        <div className="metric-card mb-8">
          <h3 className="section-label mb-3">📊 Comparativo com {getMonthName(prevMonth)}/{prevYear}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Faturamento anterior:</span>
              <p className="font-mono font-medium">{formatCurrency(prevClosing.totalRevenue)}</p>
              <p className={`text-xs ${revenueChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {revenueChange >= 0 ? '▲' : '▼'} {Math.abs(revenueChange).toFixed(1)}%
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Lucro anterior:</span>
              <p className="font-mono font-medium">{formatCurrency(prevClosing.netProfit)}</p>
              <p className={`text-xs ${profitChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {profitChange >= 0 ? '▲' : '▼'} {Math.abs(profitChange).toFixed(1)}%
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Despesas anterior:</span>
              <p className="font-mono font-medium">{formatCurrency(prevClosing.totalExpenses)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Margem anterior:</span>
              <p className="font-mono font-medium">{formatPercent(prevClosing.margin)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="metric-card">
        <h3 className="section-label mb-3">Detalhamento por Funcionário</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-muted-foreground">Funcionário</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Salário Base</th>
                <th className="pb-2 font-medium text-muted-foreground text-center">Faltas</th>
                <th className="pb-2 font-medium text-muted-foreground text-center">½ Período</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Desc. Faltas</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Vales</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Salário Final</th>
              </tr>
            </thead>
            <tbody>
              {closing.employeeDetails.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum funcionário ativo</td></tr>
              )}
              {closing.employeeDetails.map(emp => (
                <tr key={emp.employeeId} className="border-b border-muted/50 hover:bg-muted/30">
                  <td className="py-2 font-medium">{emp.employeeName}</td>
                  <td className="py-2 text-right font-mono">{formatCurrency(emp.baseSalary)}</td>
                  <td className="py-2 text-center">{emp.absences}</td>
                  <td className="py-2 text-center">{emp.halfDays}</td>
                  <td className="py-2 text-right font-mono text-destructive">{emp.absenceDiscount > 0 ? `-${formatCurrency(emp.absenceDiscount)}` : '—'}</td>
                  <td className="py-2 text-right font-mono text-destructive">{emp.valesTotal > 0 ? `-${formatCurrency(emp.valesTotal)}` : '—'}</td>
                  <td className="py-2 text-right font-mono font-bold">{formatCurrency(emp.finalSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
