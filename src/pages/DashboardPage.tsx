import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, TrendingDown, DollarSign, Users, Banknote, Target, Percent, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const COLORS = ['#0d1b2a', '#2ecc71', '#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];

export default function DashboardPage() {
  const { getMonthlyClosing, getMonthTransactions, loading } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const closing = getMonthlyClosing(month, year);
  const monthTx = getMonthTransactions(month, year);

  const categoryMap: Record<string, number> = {};
  monthTx.filter(t => t.type === 'saida').forEach(t => {
    categoryMap[t.category_name || 'Outros'] = (categoryMap[t.category_name || 'Outros'] || 0) + Number(t.amount);
  });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  const barData = [
    { name: 'Entradas', value: closing.totalRevenue },
    { name: 'Saídas', value: closing.totalExpenses },
    { name: 'Salários', value: closing.totalSalaries },
    { name: 'Vales', value: closing.totalVales },
  ];

  // Profit evolution: last 6 months
  const profitEvolution = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m < 0) { m += 12; y -= 1; }
    const c = getMonthlyClosing(m, y);
    profitEvolution.push({
      name: `${getMonthName(m).slice(0, 3)}/${y}`,
      lucro: c.netProfit,
      receita: c.totalRevenue,
      despesas: c.totalExpenses + c.totalSalaries,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm">{getMonthName(month)} de {year} — Espetos & Cia</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Entradas" value={closing.totalRevenue} icon={TrendingUp} variant="success" />
        <MetricCard label="Saídas" value={closing.totalExpenses} icon={TrendingDown} variant="danger" />
        <MetricCard label="Lucro Bruto" value={closing.totalRevenue - closing.totalExpenses} icon={DollarSign} variant="info" />
        <MetricCard label="Lucro Líquido" value={closing.netProfit} icon={Target} variant={closing.netProfit >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard label="Salários" value={closing.totalSalaries} icon={Users} />
        <MetricCard label="Vales" value={closing.totalVales} icon={Banknote} />
        <MetricCard label="Margem de Lucro" value={closing.margin} icon={Percent} isCurrency={false} isPercent />
      </div>

      {/* Profit Evolution Chart */}
      <div className="metric-card mb-6">
        <h3 className="section-label mb-4">📈 Evolução Financeira (6 meses)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={profitEvolution}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,20%,90%)" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Line type="monotone" dataKey="receita" name="Receita" stroke="#2ecc71" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#e74c3c" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="lucro" name="Lucro Líquido" stroke="#3498db" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <h3 className="section-label mb-4">Resumo Financeiro</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,20%,90%)" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card">
          <h3 className="section-label mb-4">Gastos por Categoria</h3>
          {categoryData.length === 0 ? (
            <p className="text-muted-foreground text-sm py-10 text-center">Sem dados de saídas este mês</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
