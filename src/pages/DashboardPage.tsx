import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, formatCurrency, formatPercent } from '@/lib/formatters';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, TrendingDown, DollarSign, Users, Banknote, Target, Percent, Loader2, AlertTriangle, Sparkles, Flame, CalendarDays, BarChart3, TrendingUp as Forecast } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['hsl(225,65%,48%)', 'hsl(155,55%,42%)', 'hsl(0,75%,55%)', 'hsl(210,95%,55%)', 'hsl(38,90%,50%)', 'hsl(280,55%,55%)', 'hsl(180,50%,42%)', 'hsl(30,80%,55%)'];
const MODEL_COLORS: Record<string, string> = {
  FAZE: 'hsl(225,65%,48%)',
  LEGACY: 'hsl(155,55%,42%)',
  IMPERIAL: 'hsl(38,90%,50%)',
};

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

interface PaidOS {
  os_number: string;
  atendimento_data: string;
  items: Array<{ name?: string; quantity?: number }>;
  payment_status: string;
}

export default function DashboardPage() {
  const { getMonthlyClosing, getMonthTransactions, transactions, attendance, loading, refreshData } = useFinance();
  const [products, setProducts] = useState<Product[]>([]);
  const [paidOrders, setPaidOrders] = useState<PaidOS[]>([]);
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const closing = getMonthlyClosing(month, year);
  const monthTx = getMonthTransactions(month, year);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
    if (data) setProducts(data as Product[]);
  }, []);

  const fetchPaidOrders = useCallback(async () => {
    const { data } = await supabase
      .from('service_orders')
      .select('os_number, atendimento_data, items, payment_status')
      .neq('payment_status', 'pendente');
    if (data) setPaidOrders(data as PaidOS[]);
  }, []);

  useEffect(() => {
    refreshData();
    fetchProducts();
    fetchPaidOrders();
  }, [refreshData, fetchProducts, fetchPaidOrders]);

  // ---- Count churrasqueiras from paid service orders ----
  const getModelFromItems = (items: Array<{ name?: string; quantity?: number }> | null): string[] => {
    if (!items || !Array.isArray(items)) return [];
    const models: string[] = [];
    items.forEach(item => {
      const name = (item.name || '').toUpperCase();
      if (name.includes('FAZE')) models.push('FAZE');
      else if (name.includes('LEGACY')) models.push('LEGACY');
      else if (name.includes('IMPERIAL')) models.push('IMPERIAL');
      else if (name.includes('CHURRASQUEIRA')) models.push('OUTRO');
    });
    return models;
  };

  const filterOsByMonth = (m: number, y: number) => {
    return paidOrders.filter(os => {
      const d = new Date(os.atendimento_data + 'T12:00:00');
      return d.getMonth() === m && d.getFullYear() === y;
    });
  };

  // Current month model counts
  const currentMonthOS = filterOsByMonth(month, year);
  const modelCounts: Record<string, number> = { FAZE: 0, LEGACY: 0, IMPERIAL: 0 };
  let totalChurrasqueirasMonth = 0;
  currentMonthOS.forEach(os => {
    const models = getModelFromItems(os.items);
    models.forEach(m => {
      if (m in modelCounts) modelCounts[m]++;
      totalChurrasqueirasMonth++;
    });
  });

  // Churrasqueiras vendidas por mês (últimos 6 meses) from service_orders
  const churrasqueirasByMonth = [];
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m < 0) { m += 12; y -= 1; }
    const monthOS = filterOsByMonth(m, y);
    let count = 0;
    monthOS.forEach(os => { count += getModelFromItems(os.items).length; });
    // Revenue still from transactions
    const mTx = transactions.filter(t => {
      const d = new Date(t.transaction_date + 'T12:00:00');
      return d.getMonth() === m && d.getFullYear() === y && t.type === 'entrada';
    });
    const totalSales = mTx.reduce((s, t) => s + Number(t.amount), 0);
    churrasqueirasByMonth.push({
      name: getMonthName(m).slice(0, 3),
      churrasqueiras: count,
      faturamento: totalSales,
    });
  }

  // Dias trabalhados no mês
  const monthAttendance = attendance.filter(a => {
    const d = new Date(a.presence_date + 'T12:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const uniqueWorkDays = new Set(monthAttendance.filter(a => a.status === 'presente' || a.status === 'meio-periodo').map(a => a.presence_date)).size;

  // Média de faturamento por dia
  const avgDailyRevenue = uniqueWorkDays > 0 ? closing.totalRevenue / uniqueWorkDays : 0;

  // Margem de lucro
  const profitMargin = closing.margin;

  // Previsão anual (extrapolação dos últimos 6 meses)
  let totalRevLast6 = 0;
  let totalProfitLast6 = 0;
  for (let i = 5; i >= 0; i--) {
    let m = month - i;
    let y = year;
    if (m < 0) { m += 12; y -= 1; }
    const c = getMonthlyClosing(m, y);
    totalRevLast6 += c.totalRevenue;
    totalProfitLast6 += c.netProfit;
  }
  const avgMonthlyRev = totalRevLast6 / 6;
  const avgMonthlyProfit = totalProfitLast6 / 6;
  const annualForecastRevenue = avgMonthlyRev * 12;
  const annualForecastProfit = avgMonthlyProfit * 12;

  // Low margin products
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
      name: getMonthName(m).slice(0, 3),
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="page-title text-2xl sm:text-3xl">Dashboard</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">{getMonthName(month)} de {year} — Espetos & Cia</p>
        </div>
        <div className="flex items-center gap-2 badge-info">
          <Sparkles size={14} />
          <span>IA Ativa</span>
        </div>
      </div>

      {/* AI Alerts */}
      {lowMarginProducts.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-2xl p-3 sm:p-5 mb-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Alerta de Margem</h3>
              <p className="text-xs text-muted-foreground">Produtos com margem abaixo de 30%</p>
            </div>
          </div>
          <div className="space-y-2 sm:ml-10">
            {lowMarginProducts.map(p => {
              const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
              const margin = ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100;
              const targetPrice = totalCost / 0.7;
              return (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-card gap-1">
                  <span className="font-medium truncate">{p.name}</span>
                  <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                    <span className="badge-danger">{formatPercent(margin)}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="badge-success">{formatCurrency(targetPrice)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ INFOGRÁFICO ============ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-8">
        <div className="metric-card text-center">
          <Flame size={20} className="text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{totalChurrasqueirasMonth}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Churrasqueiras vendidas</p>
          <p className="text-[10px] text-muted-foreground">este mês</p>
        </div>
        <div className="metric-card text-center">
          <CalendarDays size={20} className="text-secondary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{uniqueWorkDays}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Dias trabalhados</p>
          <p className="text-[10px] text-muted-foreground">este mês</p>
        </div>
        <div className="metric-card text-center">
          <BarChart3 size={20} className="text-info mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{formatCurrency(avgDailyRevenue)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Média/dia</p>
          <p className="text-[10px] text-muted-foreground">faturamento</p>
        </div>
        <div className="metric-card text-center">
          <Percent size={20} className={`mx-auto mb-2 ${profitMargin >= 30 ? 'text-success' : profitMargin >= 15 ? 'text-warning' : 'text-destructive'}`} />
          <p className={`text-2xl font-bold ${profitMargin >= 30 ? 'text-success' : profitMargin >= 15 ? 'text-warning' : 'text-destructive'}`}>{profitMargin.toFixed(1)}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">Margem de lucro</p>
          <p className="text-[10px] text-muted-foreground">líquida</p>
        </div>
        <div className="metric-card text-center col-span-2 sm:col-span-3 lg:col-span-1">
          <Forecast size={20} className="text-primary mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{formatCurrency(annualForecastRevenue)}</p>
          <p className="text-xs font-semibold text-success">{formatCurrency(annualForecastProfit)} lucro</p>
          <p className="text-[11px] text-muted-foreground mt-1">Previsão anual</p>
        </div>
      </div>

      {/* Vendas por Modelo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {Object.entries(modelCounts).map(([model, count]) => (
          <div key={model} className="metric-card text-center border-t-4" style={{ borderTopColor: MODEL_COLORS[model] || 'hsl(0,0%,70%)' }}>
            <p className="text-2xl font-bold text-foreground">{count}</p>
            <p className="text-xs font-semibold mt-1" style={{ color: MODEL_COLORS[model] }}>{model}</p>
            <p className="text-[10px] text-muted-foreground">vendidas este mês</p>
          </div>
        ))}
      </div>

      {/* Churrasqueiras vendidas por mês */}
      <div className="metric-card mb-6">
        <h3 className="text-sm font-bold mb-5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Churrasqueiras Vendidas & Faturamento — 6 meses</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={churrasqueirasByMonth}>
            <defs>
              <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(225,65%,48%)" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="hsl(225,65%,48%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(225,15%,92%)" />
            <XAxis dataKey="name" fontSize={12} fontWeight={500} />
            <YAxis yAxisId="left" fontSize={11} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" fontSize={11} />
            <Tooltip formatter={(v: number, name: string) => name === 'churrasqueiras' ? v : formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(225,18%,90%)', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area yAxisId="left" type="monotone" dataKey="faturamento" name="Faturamento" stroke="hsl(225,65%,48%)" fill="url(#colorFat)" strokeWidth={2} />
            <Bar yAxisId="right" dataKey="churrasqueiras" name="Unidades" fill="hsl(155,55%,42%)" radius={[6, 6, 0, 0]} barSize={28} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Existing metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8">
        <MetricCard label="Entradas" value={closing.totalRevenue} icon={TrendingUp} variant="success" />
        <MetricCard label="Saídas" value={closing.totalExpenses} icon={TrendingDown} variant="danger" />
        <MetricCard label="Lucro Bruto" value={closing.totalRevenue - closing.totalExpenses} icon={DollarSign} variant="info" />
        <MetricCard label="Lucro Líquido" value={closing.netProfit} icon={Target} variant={closing.netProfit >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 mb-8">
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
      )}
    </div>
  );
}
