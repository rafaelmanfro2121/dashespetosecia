import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import MetricCard from '@/components/MetricCard';
import { DollarSign, TrendingUp, TrendingDown, Users, Banknote, Target, Percent } from 'lucide-react';

export default function FechamentoPage() {
  const { getMonthlyClosing } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const closing = getMonthlyClosing(month, year);

  return (
    <div>
      <h1 className="page-title mb-1">Fechamento Mensal</h1>
      <p className="text-muted-foreground text-sm mb-6">{getMonthName(month)} de {year}</p>

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
