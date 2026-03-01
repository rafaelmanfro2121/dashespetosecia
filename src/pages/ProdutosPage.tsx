import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Package, Edit2, Check, X, AlertTriangle, ChevronDown, ChevronUp, ShieldAlert, Truck } from 'lucide-react';
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

interface ProductMaterial {
  id: string;
  product_id: string;
  material_name: string;
  quantity_per_unit: number;
}

interface MaterialPrice {
  material_name: string;
  avg_unit_price: number;
}

interface WarrantyCost {
  id: string;
  product_id: string | null;
  description: string;
  part_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  warranty_date: string;
  shipping_cost: number;
  notes: string | null;
}

const COMMON_MATERIALS = [
  'Parafuso', 'Engrenagem', 'Chapa de Inox', 'Rolamento', 'Fuso',
  'Tubos', 'Barras', 'Rebites', 'Graxa', 'Módulo', 'Fonte', 'Trafo',
];

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productMaterials, setProductMaterials] = useState<ProductMaterial[]>([]);
  const [materialPrices, setMaterialPrices] = useState<MaterialPrice[]>([]);
  const [warrantyCosts, setWarrantyCosts] = useState<WarrantyCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', description: '', sale_price: '', labor_cost: '', other_costs: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [matForm, setMatForm] = useState({ material_name: '', quantity_per_unit: '1', custom_name: '' });

  // Warranty form
  const [warrantyForm, setWarrantyForm] = useState({
    product_id: '', description: '', part_name: '', quantity: '1', unit_cost: '', shipping_cost: '0', notes: '', warranty_date: new Date().toISOString().slice(0, 10),
  });

  const fetchAll = useCallback(async () => {
    const [{ data: prodData }, { data: pmData }, { data: purchaseData }, { data: warrantyData }] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('product_materials').select('*'),
      supabase.from('material_purchases').select('material_name, unit_price, total_cost, quantity'),
      supabase.from('warranty_costs').select('*').order('warranty_date', { ascending: false }),
    ]);

    if (prodData) setProducts(prodData as Product[]);
    if (pmData) setProductMaterials(pmData as ProductMaterial[]);
    if (warrantyData) setWarrantyCosts(warrantyData as WarrantyCost[]);

    if (purchaseData) {
      const matMap: Record<string, { totalCost: number; totalQty: number }> = {};
      (purchaseData as any[]).forEach(p => {
        const key = p.material_name.toLowerCase();
        if (!matMap[key]) matMap[key] = { totalCost: 0, totalQty: 0 };
        matMap[key].totalCost += Number(p.total_cost);
        matMap[key].totalQty += Number(p.quantity);
      });
      setMaterialPrices(Object.entries(matMap).map(([name, d]) => ({
        material_name: name,
        avg_unit_price: d.totalQty > 0 ? d.totalCost / d.totalQty : 0,
      })));
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const calcMaterialCost = (productId: string) => {
    const mats = productMaterials.filter(m => m.product_id === productId);
    return mats.reduce((sum, m) => {
      const price = materialPrices.find(p => p.material_name === m.material_name.toLowerCase());
      return sum + (Number(m.quantity_per_unit) * (price?.avg_unit_price || 0));
    }, 0);
  };

  const lowMarginProducts = products.filter(p => {
    if (!p.is_active || Number(p.sale_price) <= 0) return false;
    const matCost = calcMaterialCost(p.id);
    const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs);
    return ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100 < 30;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.sale_price) { toast.error('Preencha nome e preço de venda'); return; }
    const { error } = await supabase.from('products').insert({
      name: form.name,
      description: form.description || null,
      sale_price: parseFloat(form.sale_price),
      material_cost: 0,
      labor_cost: parseFloat(form.labor_cost || '0'),
      other_costs: parseFloat(form.other_costs || '0'),
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    setForm({ name: '', description: '', sale_price: '', labor_cost: '', other_costs: '' });
    toast.success('Produto cadastrado');
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('product_materials').delete().eq('product_id', id);
    await supabase.from('products').delete().eq('id', id);
    fetchAll();
  };

  const startEdit = (p: Product) => { setEditingId(p.id); setEditForm({ ...p }); };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    await supabase.from('products').update({
      name: editForm.name, description: editForm.description, sale_price: editForm.sale_price,
      labor_cost: editForm.labor_cost, other_costs: editForm.other_costs, units_sold: editForm.units_sold,
    }).eq('id', editingId);
    setEditingId(null);
    toast.success('Produto atualizado');
    fetchAll();
  };

  const updateUnitsSold = async (id: string, units: number) => {
    await supabase.from('products').update({ units_sold: units }).eq('id', id);
    fetchAll();
  };

  const addMaterialToProduct = async (productId: string) => {
    const name = matForm.material_name === '__custom__' ? matForm.custom_name.trim() : matForm.material_name;
    if (!name) { toast.error('Selecione ou digite um material'); return; }
    const existing = productMaterials.find(m => m.product_id === productId && m.material_name.toLowerCase() === name.toLowerCase());
    if (existing) { toast.error('Material já adicionado neste produto'); return; }
    const { error } = await supabase.from('product_materials').insert({
      product_id: productId,
      material_name: name,
      quantity_per_unit: parseFloat(matForm.quantity_per_unit || '1'),
    });
    if (error) { toast.error('Erro ao adicionar material'); return; }
    setMatForm({ material_name: '', quantity_per_unit: '1', custom_name: '' });
    toast.success('Material adicionado');
    fetchAll();
  };

  const removeMaterial = async (id: string) => {
    await supabase.from('product_materials').delete().eq('id', id);
    fetchAll();
  };

  // Warranty
  const handleAddWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warrantyForm.part_name || !warrantyForm.unit_cost || !warrantyForm.description) {
      toast.error('Preencha descrição, peça e custo'); return;
    }
    const qty = parseInt(warrantyForm.quantity || '1');
    const unitCost = parseFloat(warrantyForm.unit_cost);
    const shipping = parseFloat(warrantyForm.shipping_cost || '0');
    const { error } = await supabase.from('warranty_costs').insert({
      product_id: warrantyForm.product_id || null,
      description: warrantyForm.description,
      part_name: warrantyForm.part_name,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: qty * unitCost + shipping,
      shipping_cost: shipping,
      notes: warrantyForm.notes || null,
      warranty_date: warrantyForm.warranty_date,
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    setWarrantyForm({ product_id: '', description: '', part_name: '', quantity: '1', unit_cost: '', shipping_cost: '0', notes: '', warranty_date: new Date().toISOString().slice(0, 10) });
    toast.success('Custo de garantia registrado');
    fetchAll();
  };

  const removeWarranty = async (id: string) => {
    await supabase.from('warranty_costs').delete().eq('id', id);
    fetchAll();
  };

  const totalWarrantyCost = warrantyCosts.reduce((s, w) => s + Number(w.total_cost), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const totalUnitsSold = products.reduce((s, p) => s + Number(p.units_sold), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">Produtos / Modelos</h1>
          <p className="text-muted-foreground text-xs">Custos calculados a partir das compras de materiais</p>
        </div>
      </div>

      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 rounded-xl">
          <TabsTrigger value="produtos" className="rounded-xl gap-1.5"><Package size={14} /> Produtos & Materiais</TabsTrigger>
          <TabsTrigger value="garantia" className="rounded-xl gap-1.5"><ShieldAlert size={14} /> Garantia & Reposição</TabsTrigger>
        </TabsList>

        {/* === PRODUTOS TAB === */}
        <TabsContent value="produtos">
          {lowMarginProducts.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-warning" />
                <h3 className="font-semibold text-sm text-warning">⚠️ Margem Abaixo de 30%</h3>
              </div>
              {lowMarginProducts.map(p => {
                const matCost = calcMaterialCost(p.id);
                const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs);
                const margin = ((Number(p.sale_price) - totalCost) / Number(p.sale_price)) * 100;
                const targetPrice = totalCost / 0.7;
                return (
                  <p key={p.id} className="text-sm text-foreground">
                    <strong>{p.name}</strong>: margem <span className="text-destructive font-bold">{formatPercent(margin)}</span> —
                    recomendado <span className="text-success font-bold">{formatCurrency(targetPrice)}</span>
                  </p>
                );
              })}
            </div>
          )}

          {/* Add product form */}
          <div className="metric-card mb-6">
            <h3 className="section-label mb-3">Cadastrar Produto</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Input placeholder="Nome do modelo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
              <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl" />
              <Input type="number" step="0.01" placeholder="Preço venda" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} className="rounded-xl" />
              <Input type="number" step="0.01" placeholder="Custo mão de obra" value={form.labor_cost} onChange={e => setForm({ ...form, labor_cost: e.target.value })} className="rounded-xl" />
              <Input type="number" step="0.01" placeholder="Outros custos" value={form.other_costs} onChange={e => setForm({ ...form, other_costs: e.target.value })} className="rounded-xl" />
              <Button type="submit" className="rounded-xl"><Plus size={16} className="mr-1" /> Cadastrar</Button>
            </form>
          </div>

          {/* Summary cards */}
          {products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="metric-card border-l-4 border-l-primary">
                <p className="section-label">Produtos Ativos</p>
                <p className="text-2xl font-bold mt-1">{products.filter(p => p.is_active).length}</p>
              </div>
              <div className="metric-card border-l-4 border-l-success">
                <p className="section-label">Margem Média</p>
                <p className="text-2xl font-bold mt-1">
                  {formatPercent(
                    products.filter(p => p.is_active && Number(p.sale_price) > 0).reduce((acc, p) => {
                      const matCost = calcMaterialCost(p.id);
                      const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs);
                      return acc + ((Number(p.sale_price) - totalCost) / Number(p.sale_price) * 100);
                    }, 0) / Math.max(1, products.filter(p => p.is_active && Number(p.sale_price) > 0).length)
                  )}
                </p>
              </div>
              <div className="metric-card border-l-4 border-l-info">
                <p className="section-label">Unid. Vendidas</p>
                <p className="text-2xl font-bold mt-1">{totalUnitsSold}</p>
              </div>
            </div>
          )}

          {/* Products list */}
          <div className="space-y-4">
            {products.length === 0 && <div className="metric-card text-center py-8 text-muted-foreground">Nenhum produto cadastrado</div>}
            {products.map(p => {
              const matCost = calcMaterialCost(p.id);
              const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs);
              const profit = Number(p.sale_price) - totalCost;
              const margin = Number(p.sale_price) > 0 ? (profit / Number(p.sale_price)) * 100 : 0;
              const isEditing = editingId === p.id;
              const isExpanded = expandedProduct === p.id;
              const pMats = productMaterials.filter(m => m.product_id === p.id);

              return (
                <div key={p.id} className="metric-card overflow-hidden">
                  {/* Product header */}
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedProduct(isExpanded ? null : p.id)}>
                    <button className="text-muted-foreground hover:text-foreground shrink-0">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-7 text-sm" onClick={e => e.stopPropagation()} />
                      ) : (
                        <div>
                          <span className="font-semibold text-sm">{p.name}</span>
                          {p.description && <span className="text-xs text-muted-foreground ml-2">{p.description}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0" onClick={e => e.stopPropagation()}>
                      <div className="text-right hidden md:block">
                        <span className="text-[10px] text-muted-foreground block">Venda</span>
                        {isEditing ? <Input type="number" step="0.01" value={editForm.sale_price ?? ''} onChange={e => setEditForm({ ...editForm, sale_price: parseFloat(e.target.value) })} className="h-7 text-sm w-24" /> : <span className="font-mono font-medium">{formatCurrency(Number(p.sale_price))}</span>}
                      </div>
                      <div className="text-right hidden md:block">
                        <span className="text-[10px] text-muted-foreground block">Custo</span>
                        <span className="font-mono">{formatCurrency(totalCost)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">Margem</span>
                        <span className={`font-mono font-bold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-destructive'}`}>
                          {formatPercent(margin)}
                        </span>
                      </div>
                      <div className="text-center hidden md:block">
                        <span className="text-[10px] text-muted-foreground block">Vendidos</span>
                        {isEditing ? (
                          <Input type="number" value={editForm.units_sold ?? 0} onChange={e => setEditForm({ ...editForm, units_sold: parseInt(e.target.value) })} className="h-7 text-sm w-16" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateUnitsSold(p.id, Math.max(0, Number(p.units_sold) - 1))} className="text-muted-foreground hover:text-foreground text-xs px-1">−</button>
                            <span className="font-mono w-6 text-center">{p.units_sold}</span>
                            <button onClick={() => updateUnitsSold(p.id, Number(p.units_sold) + 1)} className="text-muted-foreground hover:text-foreground text-xs px-1">+</button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
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
                    </div>
                  </div>

                  {/* Badge: materials count */}
                  {!isExpanded && pMats.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pMats.map(m => (
                        <span key={m.id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {m.material_name} ×{Number(m.quantity_per_unit)}
                        </span>
                      ))}
                    </div>
                  )}
                  {!isExpanded && pMats.length === 0 && (
                    <p className="mt-2 text-[10px] text-warning italic">⚠ Nenhum material vinculado — clique para expandir e adicionar</p>
                  )}

                  {/* Expanded: materials + cost breakdown */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-muted/50 space-y-4 animate-fade-in">
                      {/* Cost breakdown */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-info/5 border border-info/20">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-info">Material</span>
                          <p className="font-mono font-bold mt-1">{formatCurrency(matCost)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mão de obra</span>
                          <p className="font-mono font-bold mt-1">{formatCurrency(Number(p.labor_cost))}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outros</span>
                          <p className="font-mono font-bold mt-1">{formatCurrency(Number(p.other_costs))}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-success">Lucro/Un.</span>
                          <p className={`font-mono font-bold mt-1 ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(profit)}</p>
                        </div>
                      </div>

                      {/* Materials table */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">📦 Composição de Materiais</h4>
                        {pMats.length > 0 && (
                          <div className="rounded-xl border overflow-hidden mb-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/40 text-xs">
                                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Material</th>
                                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Qtd/Un</th>
                                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Preço Médio</th>
                                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Subtotal</th>
                                  <th className="py-2 px-3 w-8"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {pMats.map(m => {
                                  const price = materialPrices.find(mp => mp.material_name === m.material_name.toLowerCase());
                                  const lineCost = Number(m.quantity_per_unit) * (price?.avg_unit_price || 0);
                                  return (
                                    <tr key={m.id} className="border-t border-muted/30 hover:bg-muted/20">
                                      <td className="py-2 px-3 font-medium">{m.material_name}</td>
                                      <td className="py-2 px-3 text-center font-mono">{Number(m.quantity_per_unit)}</td>
                                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                        {price ? formatCurrency(price.avg_unit_price) : <span className="text-warning text-xs">Sem compra</span>}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-semibold">{formatCurrency(lineCost)}</td>
                                      <td className="py-2 px-3 text-right">
                                        <button onClick={() => removeMaterial(m.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="border-t-2 border-muted bg-muted/20">
                                  <td colSpan={3} className="py-2 px-3 text-right text-xs font-semibold uppercase text-muted-foreground">Total Material</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(matCost)}</td>
                                  <td></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                        {pMats.length === 0 && <p className="text-xs text-muted-foreground italic mb-3">Nenhum material vinculado. Adicione abaixo:</p>}

                        {/* Add material form */}
                        <div className="flex gap-2 flex-wrap items-end">
                          <div className="flex-1 min-w-[180px]">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Material</label>
                            <select
                              value={matForm.material_name}
                              onChange={e => setMatForm({ ...matForm, material_name: e.target.value })}
                              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Selecione material...</option>
                              <optgroup label="Materiais Comuns">
                                {COMMON_MATERIALS.map(m => (
                                  <option key={m} value={m} disabled={pMats.some(pm => pm.material_name.toLowerCase() === m.toLowerCase())}>
                                    {m} {pMats.some(pm => pm.material_name.toLowerCase() === m.toLowerCase()) ? '✓' : ''}
                                  </option>
                                ))}
                              </optgroup>
                              {materialPrices.filter(mp => !COMMON_MATERIALS.some(cm => cm.toLowerCase() === mp.material_name)).length > 0 && (
                                <optgroup label="Do Histórico de Compras">
                                  {materialPrices
                                    .filter(mp => !COMMON_MATERIALS.some(cm => cm.toLowerCase() === mp.material_name))
                                    .map(mp => (
                                      <option key={mp.material_name} value={mp.material_name} disabled={pMats.some(pm => pm.material_name.toLowerCase() === mp.material_name)}>
                                        {mp.material_name} {pMats.some(pm => pm.material_name.toLowerCase() === mp.material_name) ? '✓' : ''}
                                      </option>
                                    ))
                                  }
                                </optgroup>
                              )}
                              <option value="__custom__">✏️ Outro (digitar)</option>
                            </select>
                          </div>
                          {matForm.material_name === '__custom__' && (
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Nome</label>
                              <Input
                                placeholder="Nome do material"
                                value={matForm.custom_name}
                                onChange={e => setMatForm({ ...matForm, custom_name: e.target.value })}
                                className="w-40 rounded-xl"
                              />
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Qtd/un</label>
                            <Input
                              type="number" step="0.01" placeholder="Qtd"
                              value={matForm.quantity_per_unit}
                              onChange={e => setMatForm({ ...matForm, quantity_per_unit: e.target.value })}
                              className="w-24 rounded-xl"
                            />
                          </div>
                          <Button size="sm" onClick={() => addMaterialToProduct(p.id)} className="rounded-xl">
                            <Plus size={14} className="mr-1" /> Adicionar
                          </Button>
                        </div>
                      </div>

                      {/* Recommended price */}
                      {Number(p.sale_price) > 0 && margin < 30 && (
                        <div className="text-xs bg-warning/10 rounded-xl p-3 border border-warning/20">
                          💡 Para margem de 30%, venda por <strong className="text-success">{formatCurrency(totalCost / 0.7)}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* === GARANTIA TAB === */}
        <TabsContent value="garantia">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="metric-card border-l-4 border-l-destructive">
              <p className="section-label">Total Garantias</p>
              <p className="text-2xl font-bold mt-1">{warrantyCosts.length}</p>
            </div>
            <div className="metric-card border-l-4 border-l-warning">
              <p className="section-label">Custo Total (Peças + Frete)</p>
              <p className="text-2xl font-bold mt-1 text-destructive">{formatCurrency(totalWarrantyCost)}</p>
            </div>
            <div className="metric-card border-l-4 border-l-info">
              <p className="section-label">Custo Frete Total</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(warrantyCosts.reduce((s, w) => s + Number(w.shipping_cost), 0))}</p>
            </div>
          </div>

          {/* Register warranty cost */}
          <div className="metric-card mb-6">
            <h3 className="section-label mb-3">Registrar Custo de Garantia / Reposição</h3>
            <form onSubmit={handleAddWarranty} className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select
                  value={warrantyForm.product_id}
                  onChange={e => setWarrantyForm({ ...warrantyForm, product_id: e.target.value })}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Produto (opcional)</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Input placeholder="Descrição do problema" value={warrantyForm.description} onChange={e => setWarrantyForm({ ...warrantyForm, description: e.target.value })} className="rounded-xl" />
                <Input placeholder="Peça enviada (ex: Rolamento)" value={warrantyForm.part_name} onChange={e => setWarrantyForm({ ...warrantyForm, part_name: e.target.value })} className="rounded-xl" />
                <Input type="date" value={warrantyForm.warranty_date} onChange={e => setWarrantyForm({ ...warrantyForm, warranty_date: e.target.value })} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Input type="number" placeholder="Qtd" value={warrantyForm.quantity} onChange={e => setWarrantyForm({ ...warrantyForm, quantity: e.target.value })} className="rounded-xl" />
                <Input type="number" step="0.01" placeholder="Custo unitário peça" value={warrantyForm.unit_cost} onChange={e => setWarrantyForm({ ...warrantyForm, unit_cost: e.target.value })} className="rounded-xl" />
                <Input type="number" step="0.01" placeholder="Custo frete" value={warrantyForm.shipping_cost} onChange={e => setWarrantyForm({ ...warrantyForm, shipping_cost: e.target.value })} className="rounded-xl" />
                <Input placeholder="Observações" value={warrantyForm.notes} onChange={e => setWarrantyForm({ ...warrantyForm, notes: e.target.value })} className="rounded-xl" />
                <Button type="submit" className="rounded-xl"><Plus size={16} className="mr-1" /> Registrar</Button>
              </div>
            </form>
          </div>

          {/* Warranty history */}
          <div className="metric-card">
            <h3 className="section-label mb-4">Histórico de Garantias ({warrantyCosts.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Data</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Produto</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Descrição</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs">Peça</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Qtd</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Custo Un.</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Frete</th>
                    <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Total</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {warrantyCosts.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum custo de garantia registrado</td></tr>
                  )}
                  {warrantyCosts.map(w => (
                    <tr key={w.id} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                      <td className="py-3 text-muted-foreground">{new Date(w.warranty_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="py-3 font-medium">{w.product_id ? products.find(p => p.id === w.product_id)?.name || '—' : '—'}</td>
                      <td className="py-3 text-muted-foreground">{w.description}</td>
                      <td className="py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">{w.part_name}</span>
                      </td>
                      <td className="py-3 text-right font-mono">{w.quantity}</td>
                      <td className="py-3 text-right font-mono">{formatCurrency(Number(w.unit_cost))}</td>
                      <td className="py-3 text-right font-mono">
                        {Number(w.shipping_cost) > 0 && <Truck size={10} className="inline mr-1 text-muted-foreground" />}
                        {formatCurrency(Number(w.shipping_cost))}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-destructive">{formatCurrency(Number(w.total_cost))}</td>
                      <td className="py-3 text-right">
                        <button onClick={() => removeWarranty(w.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
