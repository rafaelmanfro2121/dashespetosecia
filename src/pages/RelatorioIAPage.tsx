import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import { Brain } from 'lucide-react';

export default function RelatorioIAPage() {
  const { getMonthlyClosing, getMonthTransactions } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const closing = getMonthlyClosing(month, year);
  const monthTx = getMonthTransactions(month, year);

  // Category analysis
  const categoryMap: Record<string, number> = {};
  monthTx.filter(t => t.type === 'saida').forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });
  const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0];

  const hasData = monthTx.length > 0;

  const generateReport = () => {
    if (!hasData) return null;

    const alerts: string[] = [];
    const suggestions: string[] = [];

    // Margin analysis
    if (closing.margin < 10) alerts.push('⚠️ Margem de lucro abaixo de 10%. Situação crítica.');
    else if (closing.margin < 20) alerts.push('⚠️ Margem de lucro entre 10-20%. Atenção necessária.');

    // Expense ratio
    const expenseRatio = closing.totalRevenue > 0 ? (closing.totalExpenses / closing.totalRevenue) * 100 : 0;
    if (expenseRatio > 70) alerts.push(`⚠️ Despesas representam ${expenseRatio.toFixed(0)}% do faturamento.`);

    // Salary impact
    const salaryRatio = closing.totalRevenue > 0 ? (closing.totalSalaries / closing.totalRevenue) * 100 : 0;
    if (salaryRatio > 30) alerts.push(`⚠️ Folha salarial consome ${salaryRatio.toFixed(0)}% do faturamento.`);

    // Top expense
    if (topCategory) {
      const catRatio = closing.totalExpenses > 0 ? (topCategory[1] / closing.totalExpenses) * 100 : 0;
      if (catRatio > 40) alerts.push(`⚠️ Categoria "${topCategory[0]}" concentra ${catRatio.toFixed(0)}% das despesas.`);
    }

    // Suggestions
    if (closing.margin < 20) suggestions.push('📌 Revise preços de venda para melhorar a margem.');
    if (topCategory && topCategory[1] > closing.totalExpenses * 0.3) suggestions.push(`📌 Negocie melhores preços em "${topCategory[0]}" — principal custo.`);
    if (salaryRatio > 25) suggestions.push('📌 Avalie eficiência da equipe e possibilidade de otimizar turnos.');
    if (closing.totalVales > closing.totalSalaries * 0.1) suggestions.push('📌 Controle de vales alto. Estabeleça limites mensais por funcionário.');
    suggestions.push('📌 Mantenha registro diário para análises mais precisas.');

    return { alerts, suggestions, expenseRatio, salaryRatio };
  };

  const report = generateReport();

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Brain size={28} className="text-secondary" />
        <h1 className="page-title">Relatório Inteligente</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">{getMonthName(month)} de {year}</p>

      {!hasData ? (
        <div className="metric-card text-center py-12 text-muted-foreground">
          <Brain size={48} className="mx-auto mb-4 opacity-30" />
          <p>Registre movimentações financeiras para gerar análises inteligentes.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="metric-card">
            <h3 className="section-label mb-3">📊 Diagnóstico Financeiro</h3>
            <div className="space-y-2 text-sm">
              <p>Faturamento mensal: <strong className="text-success">{formatCurrency(closing.totalRevenue)}</strong></p>
              <p>Despesas operacionais: <strong className="text-destructive">{formatCurrency(closing.totalExpenses)}</strong> ({report?.expenseRatio.toFixed(1)}% do faturamento)</p>
              <p>Folha de pagamento: <strong>{formatCurrency(closing.totalSalaries)}</strong> ({report?.salaryRatio.toFixed(1)}% do faturamento)</p>
              <p>Lucro líquido: <strong className={closing.netProfit >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(closing.netProfit)}</strong></p>
              <p>Margem: <strong>{formatPercent(closing.margin)}</strong></p>
            </div>
          </div>

          {/* Alerts */}
          {report && report.alerts.length > 0 && (
            <div className="metric-card border-l-4 border-l-warning">
              <h3 className="section-label mb-3">🚨 Alertas</h3>
              <ul className="space-y-1.5 text-sm">
                {report.alerts.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {/* Top expenses */}
          {sortedCategories.length > 0 && (
            <div className="metric-card">
              <h3 className="section-label mb-3">💸 Maiores Despesas por Categoria</h3>
              <div className="space-y-2">
                {sortedCategories.slice(0, 5).map(([cat, val]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span>{cat}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(val / sortedCategories[0][1]) * 100}%` }} />
                      </div>
                      <span className="font-mono w-28 text-right">{formatCurrency(val)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {report && report.suggestions.length > 0 && (
            <div className="metric-card border-l-4 border-l-secondary">
              <h3 className="section-label mb-3">💡 Sugestões Estratégicas</h3>
              <ul className="space-y-1.5 text-sm">
                {report.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center py-4">
            Análise gerada localmente com base nos dados registrados. Conecte o Lovable Cloud para relatórios avançados com IA generativa.
          </div>
        </div>
      )}
    </div>
  );
}
