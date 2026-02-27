import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, TrendingDown, DollarSign, Users, Banknote, Target, Percent, Loader2, AlertTriangle, Package } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { toast } from 'sonner';

const COLORS = ['hsl(220,70%,45%)', 'hsl(160,60%,45%)', 'hsl(0,72%,51%)', 'hsl(220,90%,56%)', 'hsl(38,92%,50%)', 'hsl(280,60%,55%)', 'hsl(180,50%,45%)', 'hsl(30,80%,55%)'];

interface Product {
  id: string;
  name: string;
  sale_price: number;
  material_cost: number;
  labor_cost: number;
  other_costs: number;
  units_sold: number;
  is_active: boolean;
}

export default function DashboardPage() {
  const { getMonthlyClosing, getMonthTransactions, loading } = useFinance();
  const [products, setProducts] = useState<Product[]>([]);
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const closing = getMonthlyClosing(month, year);
  const monthTx = getMonthTransactions(month, year);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (data) setProducts(data as Product[]);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Margin alerts
  const lowMarginProducts = products.filter(p => {
    if (Number(p.sale_price) <= 0) return false;
    const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
    const margin = ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100;
    return margin < 30;
  });

  // Product margin data for chart
  const productMarginData = products
    .filter(p => Number(p.sale_price) > 0)
    .map(p => {
      const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
      const margin = ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100;
      return { name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name, margem: parseFloat(margin.toFixed(1)), profit: Number(p.sale_price) - totalCost };
    })
    .sort((a, b) => b.margem - a.margem);

  // Revenue by product (ranking)
  const productRevenueData = products
    .filter(p => Number(p.units_sold) > 0)
    .map(p => ({
      name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name,
      receita: Number(p.sale_price) * Number(p.units_sold),
      lucro: (Number(p.sale_price) - Number(p.material_cost) - Number(p.labor_cost) - Number(p.other_costs)) * Number(p.units_sold),
    }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 8);

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

      {/* Margin alerts */}
      {lowMarginProducts.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-warning" />
            <h3 className="font-semibold text-sm text-warning">⚠️ Produtos com Margem Abaixo de 30%</h3>
          </div>
          <div className="space-y-1">
            {lowMarginProducts.map(p => {
              const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
              const margin = ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100;
              const targetPrice = totalCost / 0.7;
              return (
                <p key={p.id} className="text-sm text-foreground">
                  <strong>{p.name}</strong>: margem de <span className="text-destructive font-bold">{formatPercent(margin)}</span> — 
                  sugestão: ajustar preço para <span className="text-success font-bold">{formatCurrency(targetPrice)}</span>
                </p>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Profit Evolution */}
      <div className="metric-card mb-6">
        <h3 className="section-label mb-4">📈 Evolução Financeira (6 meses)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={profitEvolution}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(160,60%,45%)" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(0,72%,51%)" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="lucro" name="Lucro Líquido" stroke="hsl(220,70%,45%)" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Product Margin Chart + Ranking */}
      {productMarginData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="metric-card">
            <h3 className="section-label mb-4">📊 Margem por Produto</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={productMarginData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                <XAxis type="number" fontSize={11} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="margem" radius={[0, 4, 4, 0]}>
                  {productMarginData.map((entry, i) => (
                    <Cell key={i} fill={entry.margem >= 30 ? 'hsl(160,60%,45%)' : entry.margem >= 15 ? 'hsl(38,92%,50%)' : 'hsl(0,72%,51%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {productRevenueData.length > 0 && (
            <div className="metric-card">
              <h3 className="section-label mb-4">🏆 Ranking de Rentabilidade</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={50} />
                  <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="hsl(220,70%,45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro" fill="hsl(160,60%,45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <h3 className="section-label mb-4">Resumo Financeiro</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
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
