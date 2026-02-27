import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Package, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string | null;
  sale_price: number;
  material_cost: number;
  labor_cost: number;
  other_costs: number;
  units_sold: number;
  is_active: boolean;
}

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '', description: '', sale_price: '', material_cost: '', labor_cost: '', other_costs: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.sale_price) { toast.error('Preencha nome e preço de venda'); return; }
    const { error } = await supabase.from('products').insert({
      name: form.name,
      description: form.description || null,
      sale_price: parseFloat(form.sale_price),
      material_cost: parseFloat(form.material_cost || '0'),
      labor_cost: parseFloat(form.labor_cost || '0'),
      other_costs: parseFloat(form.other_costs || '0'),
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    setForm({ name: '', description: '', sale_price: '', material_cost: '', labor_cost: '', other_costs: '' });
    toast.success('Produto cadastrado');
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditForm({ ...p });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    await supabase.from('products').update({
      name: editForm.name,
      description: editForm.description,
      sale_price: editForm.sale_price,
      material_cost: editForm.material_cost,
      labor_cost: editForm.labor_cost,
      other_costs: editForm.other_costs,
      units_sold: editForm.units_sold,
    }).eq('id', editingId);
    setEditingId(null);
    toast.success('Produto atualizado');
    fetchProducts();
  };

  const updateUnitsSold = async (id: string, units: number) => {
    await supabase.from('products').update({ units_sold: units }).eq('id', id);
    fetchProducts();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Package size={28} className="text-secondary" />
        <h1 className="page-title">Produtos / Modelos</h1>
      </div>

      <div className="metric-card mb-6">
        <h3 className="section-label mb-3">Cadastrar Produto</h3>
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <Input placeholder="Nome do modelo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Preço venda" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Custo material" value={form.material_cost} onChange={e => setForm({ ...form, material_cost: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Custo mão de obra" value={form.labor_cost} onChange={e => setForm({ ...form, labor_cost: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Outros custos" value={form.other_costs} onChange={e => setForm({ ...form, other_costs: e.target.value })} />
          <Button type="submit"><Plus size={16} className="mr-1" /> Cadastrar</Button>
        </form>
      </div>

      {/* Summary cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="metric-card">
            <p className="section-label">Total Produtos</p>
            <p className="text-2xl font-bold mt-1">{products.filter(p => p.is_active).length}</p>
          </div>
          <div className="metric-card">
            <p className="section-label">Margem Média</p>
            <p className="text-2xl font-bold mt-1">
              {formatPercent(
                products.filter(p => p.is_active && Number(p.sale_price) > 0).reduce((acc, p) => {
                  const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
                  return acc + ((Number(p.sale_price) - totalCost) / Number(p.sale_price) * 100);
                }, 0) / Math.max(1, products.filter(p => p.is_active && Number(p.sale_price) > 0).length)
              )}
            </p>
          </div>
          <div className="metric-card">
            <p className="section-label">Unidades Vendidas</p>
            <p className="text-2xl font-bold mt-1">{products.reduce((s, p) => s + Number(p.units_sold), 0)}</p>
          </div>
        </div>
      )}

      <div className="metric-card">
        <h3 className="section-label mb-3">Catálogo de Produtos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-muted-foreground">Produto</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Preço Venda</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Custo Material</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Mão de Obra</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Outros</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Custo Total</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Margem</th>
                <th className="pb-2 font-medium text-muted-foreground text-center">Vendidos</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado</td></tr>
              )}
              {products.map(p => {
                const totalCost = Number(p.material_cost) + Number(p.labor_cost) + Number(p.other_costs);
                const profit = Number(p.sale_price) - totalCost;
                const margin = Number(p.sale_price) > 0 ? (profit / Number(p.sale_price)) * 100 : 0;
                const isEditing = editingId === p.id;

                return (
                  <tr key={p.id} className="border-b border-muted/50 hover:bg-muted/30">
                    <td className="py-2 font-medium">
                      {isEditing ? <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-7 text-sm" /> : p.name}
                      {p.description && !isEditing && <span className="block text-xs text-muted-foreground">{p.description}</span>}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {isEditing ? <Input type="number" step="0.01" value={editForm.sale_price ?? ''} onChange={e => setEditForm({ ...editForm, sale_price: parseFloat(e.target.value) })} className="h-7 text-sm w-24 ml-auto" /> : formatCurrency(Number(p.sale_price))}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {isEditing ? <Input type="number" step="0.01" value={editForm.material_cost ?? ''} onChange={e => setEditForm({ ...editForm, material_cost: parseFloat(e.target.value) })} className="h-7 text-sm w-24 ml-auto" /> : formatCurrency(Number(p.material_cost))}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {isEditing ? <Input type="number" step="0.01" value={editForm.labor_cost ?? ''} onChange={e => setEditForm({ ...editForm, labor_cost: parseFloat(e.target.value) })} className="h-7 text-sm w-24 ml-auto" /> : formatCurrency(Number(p.labor_cost))}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {isEditing ? <Input type="number" step="0.01" value={editForm.other_costs ?? ''} onChange={e => setEditForm({ ...editForm, other_costs: parseFloat(e.target.value) })} className="h-7 text-sm w-24 ml-auto" /> : formatCurrency(Number(p.other_costs))}
                    </td>
                    <td className="py-2 text-right font-mono font-medium">{formatCurrency(totalCost)}</td>
                    <td className="py-2 text-right">
                      <span className={`font-mono font-bold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-destructive'}`}>
                        {formatPercent(margin)}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      {isEditing ? (
                        <Input type="number" value={editForm.units_sold ?? 0} onChange={e => setEditForm({ ...editForm, units_sold: parseInt(e.target.value) })} className="h-7 text-sm w-16 mx-auto" />
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => updateUnitsSold(p.id, Math.max(0, Number(p.units_sold) - 1))} className="text-muted-foreground hover:text-foreground text-xs px-1">−</button>
                          <span className="font-mono w-8 text-center">{p.units_sold}</span>
                          <button onClick={() => updateUnitsSold(p.id, Number(p.units_sold) + 1)} className="text-muted-foreground hover:text-foreground text-xs px-1">+</button>
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="text-success hover:text-success/80"><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(p)} className="text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
