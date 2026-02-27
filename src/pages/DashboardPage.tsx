import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, TrendingDown, DollarSign, Users, Banknote, Target, Percent, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const COLORS = ['hsl(225,65%,48%)', 'hsl(155,55%,42%)', 'hsl(0,75%,55%)', 'hsl(210,95%,55%)', 'hsl(38,90%,50%)', 'hsl(280,55%,55%)', 'hsl(180,50%,42%)', 'hsl(30,80%,55%)'];

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

  const lowMarginProducts = products.filter(p => {
    if (Number(p.sale_price) <= 0) return false;
    const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
    return ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100 < 30;
  });

  const productMarginData = products
    .filter(p => Number(p.sale_price) > 0)
    .map(p => {
      const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
      const margin = ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100;
      return { name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name, margem: parseFloat(margin.toFixed(1)) };
    })
    .sort((a, b) => b.margem - a.margem);

  const productRevenueData = products
    .filter(p => Number(p.units_sold) > 0)
    .map(p => ({
      name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
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

  const profitEvolution = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m < 0) { m += 12; y -= 1; }
    const c = getMonthlyClosing(m, y);
    profitEvolution.push({
      name: `${getMonthName(m).slice(0, 3)}`,
      lucro: c.netProfit,
      receita: c.totalRevenue,
      despesas: c.totalExpenses + c.totalSalaries,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title text-3xl">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">{getMonthName(month)} de {year} — Espetos & Cia</p>
        </div>
        <div className="flex items-center gap-2 badge-info">
          <Sparkles size={14} />
          <span>IA Ativa</span>
        </div>
      </div>

      {/* AI Alerts */}
      {lowMarginProducts.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-2xl p-5 mb-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-warning/15 flex items-center justify-center">
              <AlertTriangle size={16} className="text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Alerta de Margem</h3>
              <p className="text-xs text-muted-foreground">Produtos com margem abaixo de 30%</p>
            </div>
          </div>
          <div className="space-y-2 ml-10">
            {lowMarginProducts.map(p => {
              const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
              const margin = ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100;
              const targetPrice = totalCost / 0.7;
              return (
                <div key={p.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-card">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="badge-danger">{formatPercent(margin)}</span>
                    <span className="text-xs text-muted-foreground">→ Ajustar para</span>
                    <span className="badge-success">{formatCurrency(targetPrice)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard label="Entradas" value={closing.totalRevenue} icon={TrendingUp} variant="success" />
        <MetricCard label="Saídas" value={closing.totalExpenses} icon={TrendingDown} variant="danger" />
        <MetricCard label="Lucro Bruto" value={closing.totalRevenue - closing.totalExpenses} icon={DollarSign} variant="info" />
        <MetricCard label="Lucro Líquido" value={closing.netProfit} icon={Target} variant={closing.netProfit >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <MetricCard label="Salários" value={closing.totalSalaries} icon={Users} />
        <MetricCard label="Vales" value={closing.totalVales} icon={Banknote} />
        <MetricCard label="Margem" value={closing.margin} icon={Percent} isCurrency={false} isPercent />
      </div>

      {/* Evolution Chart */}
      <div className="metric-card mb-6">
        <h3 className="text-sm font-bold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Evolução Financeira — 6 meses</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={profitEvolution}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(225,15%,92%)" />
            <XAxis dataKey="name" fontSize={12} fontWeight={500} />
            <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(225,18%,90%)', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(155,55%,42%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(155,55%,42%)' }} />
            <Line type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(0,75%,55%)" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(225,65%,48%)" strokeWidth={3} dot={{ r: 5, fill: 'hsl(225,65%,48%)' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Product Charts */}
      {productMarginData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="metric-card">
            <h3 className="text-sm font-bold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Margem por Produto</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={productMarginData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225,15%,92%)" />
                <XAxis type="number" fontSize={11} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(225,18%,90%)' }} />
                <Bar dataKey="margem" radius={[0, 8, 8, 0]}>
                  {productMarginData.map((entry, i) => (
                    <Cell key={i} fill={entry.margem >= 30 ? 'hsl(155,55%,42%)' : entry.margem >= 15 ? 'hsl(38,90%,50%)' : 'hsl(0,75%,55%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {productRevenueData.length > 0 && (
            <div className="metric-card">
              <h3 className="text-sm font-bold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Ranking de Rentabilidade</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={productRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(225,15%,92%)" />
                  <XAxis dataKey="name" fontSize={10} angle={-15} textAnchor="end" height={50} />
                  <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(225,18%,90%)' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="receita" name="Receita" fill="hsl(225,65%,48%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro" fill="hsl(155,55%,42%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card">
          <h3 className="text-sm font-bold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Resumo do Mês</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={[
              { name: 'Entradas', value: closing.totalRevenue },
              { name: 'Saídas', value: closing.totalExpenses },
              { name: 'Salários', value: closing.totalSalaries },
              { name: 'Vales', value: closing.totalVales },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(225,15%,92%)" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(225,18%,90%)' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {[0, 1, 2, 3].map(i => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card">
          <h3 className="text-sm font-bold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Gastos por Categoria</h3>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
              Sem dados de saídas este mês
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={65} outerRadius={105} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(225,18%,90%)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
