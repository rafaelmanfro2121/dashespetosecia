import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Package, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MaterialPurchase {
  id: string;
  material_name: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  supplier: string | null;
  purchase_date: string;
  created_at: string;
}

interface PriceAlert {
  material: string;
  previousPrice: number;
  currentPrice: number;
  percentChange: number;
}

export default function MateriaisPage() {
  const [purchases, setPurchases] = useState<MaterialPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [form, setForm] = useState({ material_name: '', quantity: '', unit_price: '', supplier: '', purchase_date: new Date().toISOString().slice(0, 10) });

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('material_purchases')
      .select('*')
      .order('purchase_date', { ascending: false });
    if (data) {
      setPurchases(data as MaterialPurchase[]);
      calculateAlerts(data as MaterialPurchase[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const calculateAlerts = (data: MaterialPurchase[]) => {
    const byMaterial: Record<string, MaterialPurchase[]> = {};
    data.forEach(p => {
      const key = p.material_name.toLowerCase();
      if (!byMaterial[key]) byMaterial[key] = [];
      byMaterial[key].push(p);
    });

    const newAlerts: PriceAlert[] = [];
    Object.entries(byMaterial).forEach(([, items]) => {
      if (items.length < 2) return;
      const sorted = [...items].sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
      const current = Number(sorted[0].unit_price);
      const previous = Number(sorted[1].unit_price);
      if (previous > 0) {
        const change = ((current - previous) / previous) * 100;
        if (change > 10) {
          newAlerts.push({
            material: sorted[0].material_name,
            previousPrice: previous,
            currentPrice: current,
            percentChange: change,
          });
        }
      }
    });
    setAlerts(newAlerts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.material_name || !form.quantity || !form.unit_price) {
      toast.error('Preencha material, quantidade e preço unitário');
      return;
    }
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.unit_price);
    const { error } = await supabase.from('material_purchases').insert({
      material_name: form.material_name,
      quantity: qty,
      unit_price: price,
      total_cost: qty * price,
      supplier: form.supplier || null,
      purchase_date: form.purchase_date,
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Compra registrada');
    setForm({ material_name: '', quantity: '', unit_price: '', supplier: '', purchase_date: new Date().toISOString().slice(0, 10) });
    fetchPurchases();
  };

  // Price evolution chart data
  const materialNames = [...new Set(purchases.map(p => p.material_name.toLowerCase()))];
  const chartData: Record<string, any>[] = [];
  const dateMap: Record<string, Record<string, number>> = {};

  purchases.forEach(p => {
    const dateKey = p.purchase_date;
    if (!dateMap[dateKey]) dateMap[dateKey] = {};
    dateMap[dateKey][p.material_name.toLowerCase()] = Number(p.unit_price);
  });

  Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, materials]) => {
      chartData.push({ date: format(new Date(date + 'T12:00:00'), 'dd/MM', { locale: ptBR }), ...materials });
    });

  const chartColors = ['hsl(225,65%,48%)', 'hsl(155,55%,42%)', 'hsl(0,75%,55%)', 'hsl(38,90%,50%)', 'hsl(280,55%,55%)', 'hsl(180,50%,42%)'];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">Materiais & Fornecedores</h1>
          <p className="text-muted-foreground text-xs">Histórico de compras e evolução de preços</p>
        </div>
      </div>

      {/* Price Alerts */}
      {alerts.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-destructive" />
            <h3 className="font-semibold text-sm">⚠️ Alerta de Preço — Material subiu mais de 10%</h3>
          </div>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-card">
                <span className="font-medium">{a.material}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{formatCurrency(a.previousPrice)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="badge-danger">{formatCurrency(a.currentPrice)} (+{a.percentChange.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register form */}
      <div className="metric-card mb-6">
        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Registrar Compra de Material</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Input placeholder="Material (ex: Chapa inox)" value={form.material_name} onChange={e => setForm({ ...form, material_name: e.target.value })} className="rounded-xl" />
          <Input type="number" step="0.01" placeholder="Qtd" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="rounded-xl" />
          <Input type="number" step="0.01" placeholder="Preço unit." value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} className="rounded-xl" />
          <Input placeholder="Fornecedor" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="rounded-xl" />
          <Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} className="rounded-xl" />
          <Button type="submit" className="rounded-xl"><Plus size={16} className="mr-1" /> Registrar</Button>
        </form>
      </div>

      {/* Price evolution chart */}
      {chartData.length > 1 && (
        <div className="metric-card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-primary" />
            <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Evolução de Preços por Material</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(225,15%,92%)" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={v => `R$${v}`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(225,18%,90%)', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {materialNames.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} name={name.charAt(0).toUpperCase() + name.slice(1)} stroke={chartColors[i % chartColors.length]} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Purchase history */}
      <div className="metric-card">
        <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Histórico de Compras ({purchases.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 font-medium text-muted-foreground text-xs">Data</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Material</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs">Fornecedor</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Qtd</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Preço Unit.</th>
                <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma compra registrada</td></tr>
              )}
              {purchases.map(p => (
                <tr key={p.id} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                  <td className="py-3 text-muted-foreground">{new Date(p.purchase_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="py-3 font-medium">{p.material_name}</td>
                  <td className="py-3 text-muted-foreground">{p.supplier || '—'}</td>
                  <td className="py-3 text-right">{Number(p.quantity)}</td>
                  <td className="py-3 text-right font-mono">{formatCurrency(Number(p.unit_price))}</td>
                  <td className="py-3 text-right font-mono font-bold">{formatCurrency(Number(p.total_cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
