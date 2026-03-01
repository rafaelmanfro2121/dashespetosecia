import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Package, Edit2, Check, X, AlertTriangle, Info, ChevronDown, ChevronUp, Settings } from 'lucide-react';
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

interface FixedCost {
  id: string;
  name: string;
  category: string;
  monthly_amount: number;
  is_active: boolean;
}

interface MaterialPrice {
  material_name: string;
  avg_unit_price: number;
}

const COMMON_MATERIALS = [
  'Parafuso', 'Engrenagem', 'Chapa de Inox', 'Rolamento', 'Fuso',
  'Tubos', 'Barras', 'Rebites', 'Graxa', 'Módulo', 'Fonte', 'Trafo',
];

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productMaterials, setProductMaterials] = useState<ProductMaterial[]>([]);
  const [materialPrices, setMaterialPrices] = useState<MaterialPrice[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showFixedCosts, setShowFixedCosts] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', sale_price: '', labor_cost: '', other_costs: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  // Material assignment form
  const [matForm, setMatForm] = useState({ material_name: '', quantity_per_unit: '1' });

  // Fixed cost form
  const [fixedForm, setFixedForm] = useState({ name: '', category: 'geral', monthly_amount: '' });

  const fetchAll = useCallback(async () => {
    const [{ data: prodData }, { data: pmData }, { data: purchaseData }, { data: fcData }] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('product_materials').select('*'),
      supabase.from('material_purchases').select('material_name, unit_price, total_cost, quantity'),
      supabase.from('fixed_costs').select('*').order('name'),
    ]);

    if (prodData) setProducts(prodData as Product[]);
    if (pmData) setProductMaterials(pmData as ProductMaterial[]);
    if (fcData) setFixedCosts(fcData as FixedCost[]);

    // Calculate average price per material from purchases
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

  // Calculate material cost for a product based on its assigned materials × average purchase prices
  const calcMaterialCost = (productId: string) => {
    const mats = productMaterials.filter(m => m.product_id === productId);
    return mats.reduce((sum, m) => {
      const price = materialPrices.find(p => p.material_name === m.material_name.toLowerCase());
      return sum + (Number(m.quantity_per_unit) * (price?.avg_unit_price || 0));
    }, 0);
  };

  // Total fixed costs per month
  const totalFixedCosts = fixedCosts.filter(fc => fc.is_active).reduce((s, fc) => s + Number(fc.monthly_amount), 0);

  // Total units sold for overhead distribution
  const totalUnitsSold = products.reduce((s, p) => s + Number(p.units_sold), 0);
  const overheadPerUnit = totalUnitsSold > 0 ? totalFixedCosts / totalUnitsSold : 0;

  const lowMarginProducts = products.filter(p => {
    if (!p.is_active || Number(p.sale_price) <= 0) return false;
    const matCost = calcMaterialCost(p.id);
    const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs) + overheadPerUnit;
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

  // Add material to product
  const addMaterialToProduct = async (productId: string) => {
    if (!matForm.material_name) { toast.error('Selecione um material'); return; }
    const { error } = await supabase.from('product_materials').insert({
      product_id: productId,
      material_name: matForm.material_name,
      quantity_per_unit: parseFloat(matForm.quantity_per_unit || '1'),
    });
    if (error) { toast.error('Erro ao adicionar material'); return; }
    setMatForm({ material_name: '', quantity_per_unit: '1' });
    toast.success('Material adicionado');
    fetchAll();
  };

  const removeMaterial = async (id: string) => {
    await supabase.from('product_materials').delete().eq('id', id);
    fetchAll();
  };

  // Fixed costs CRUD
  const addFixedCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedForm.name || !fixedForm.monthly_amount) { toast.error('Preencha nome e valor'); return; }
    const { error } = await supabase.from('fixed_costs').insert({
      name: fixedForm.name,
      category: fixedForm.category,
      monthly_amount: parseFloat(fixedForm.monthly_amount),
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    setFixedForm({ name: '', category: 'geral', monthly_amount: '' });
    toast.success('Custo fixo cadastrado');
    fetchAll();
  };

  const removeFixedCost = async (id: string) => {
    await supabase.from('fixed_costs').delete().eq('id', id);
    fetchAll();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

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

      {/* Info box */}
      <div className="bg-info/10 border border-info/30 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Info size={18} className="text-info mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-info mb-1">Cálculo Automático de Custos</p>
          <p className="text-muted-foreground">
            O custo de material é calculado pelo <strong>preço médio de compra</strong> de cada insumo × quantidade usada por unidade.
            Os custos fixos ({formatCurrency(totalFixedCosts)}/mês) são rateados por unidade vendida ({totalUnitsSold} un.) = <strong className="text-foreground">{formatCurrency(overheadPerUnit)}</strong>/un.
          </p>
        </div>
      </div>

      {lowMarginProducts.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-warning" />
            <h3 className="font-semibold text-sm text-warning">⚠️ Margem Abaixo de 30%</h3>
          </div>
          {lowMarginProducts.map(p => {
            const matCost = calcMaterialCost(p.id);
            const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs) + overheadPerUnit;
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

      {/* Fixed Costs Section */}
      <div className="metric-card mb-6">
        <button onClick={() => setShowFixedCosts(!showFixedCosts)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-primary" />
            <h3 className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Custos Fixos Mensais — {formatCurrency(totalFixedCosts)}
            </h3>
          </div>
          {showFixedCosts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showFixedCosts && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">Frete, tráfego pago, aluguel, luz, água, telefone, etc. Esses custos são rateados entre todos os produtos vendidos.</p>
            <form onSubmit={addFixedCost} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Nome (ex: Aluguel)" value={fixedForm.name} onChange={e => setFixedForm({ ...fixedForm, name: e.target.value })} className="rounded-xl" />
              <select value={fixedForm.category} onChange={e => setFixedForm({ ...fixedForm, category: e.target.value })} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="aluguel">Aluguel</option>
                <option value="energia">Energia/Luz</option>
                <option value="agua">Água</option>
                <option value="telecom">Telefone/Internet</option>
                <option value="frete">Frete</option>
                <option value="marketing">Tráfego Pago / Agência</option>
                <option value="geral">Outros</option>
              </select>
              <Input type="number" step="0.01" placeholder="Valor mensal" value={fixedForm.monthly_amount} onChange={e => setFixedForm({ ...fixedForm, monthly_amount: e.target.value })} className="rounded-xl" />
              <Button type="submit" className="rounded-xl"><Plus size={16} className="mr-1" /> Adicionar</Button>
            </form>
            {fixedCosts.length > 0 && (
              <div className="space-y-1">
                {fixedCosts.map(fc => (
                  <div key={fc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 text-sm">
                    <span className="font-medium">{fc.name} <span className="text-xs text-muted-foreground">({fc.category})</span></span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{formatCurrency(Number(fc.monthly_amount))}</span>
                      <button onClick={() => removeFixedCost(fc.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add product form */}
      <div className="metric-card mb-6">
        <h3 className="section-label mb-3">Cadastrar Produto</h3>
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Input placeholder="Nome do modelo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Preço venda" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Custo mão de obra" value={form.labor_cost} onChange={e => setForm({ ...form, labor_cost: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Outros custos" value={form.other_costs} onChange={e => setForm({ ...form, other_costs: e.target.value })} />
          <Button type="submit"><Plus size={16} className="mr-1" /> Cadastrar</Button>
        </form>
      </div>

      {/* Summary cards */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
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
                  const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs) + overheadPerUnit;
                  return acc + ((Number(p.sale_price) - totalCost) / Number(p.sale_price) * 100);
                }, 0) / Math.max(1, products.filter(p => p.is_active && Number(p.sale_price) > 0).length)
              )}
            </p>
          </div>
          <div className="metric-card border-l-4 border-l-info">
            <p className="section-label">Unid. Vendidas</p>
            <p className="text-2xl font-bold mt-1">{totalUnitsSold}</p>
          </div>
          <div className="metric-card border-l-4 border-l-warning">
            <p className="section-label">Overhead/Un.</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(overheadPerUnit)}</p>
          </div>
        </div>
      )}

      {/* Products table */}
      <div className="metric-card">
        <h3 className="section-label mb-3">Catálogo de Produtos</h3>
        <div className="space-y-0">
          {products.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado</p>}
          {products.map(p => {
            const matCost = calcMaterialCost(p.id);
            const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs) + overheadPerUnit;
            const profit = Number(p.sale_price) - totalCost;
            const margin = Number(p.sale_price) > 0 ? (profit / Number(p.sale_price)) * 100 : 0;
            const isEditing = editingId === p.id;
            const isExpanded = expandedProduct === p.id;
            const pMats = productMaterials.filter(m => m.product_id === p.id);

            return (
              <div key={p.id} className="border-b border-muted/50">
                {/* Product row */}
                <div className="flex items-center gap-2 py-3 hover:bg-muted/30 transition-colors px-2 rounded-lg">
                  <button onClick={() => setExpandedProduct(isExpanded ? null : p.id)} className="text-muted-foreground hover:text-foreground shrink-0">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-7 text-sm" />
                    ) : (
                      <div>
                        <span className="font-medium text-sm">{p.name}</span>
                        {p.description && <span className="text-xs text-muted-foreground ml-2">{p.description}</span>}
                        <span className="text-xs text-muted-foreground ml-2">({pMats.length} materiais)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Venda</span>
                      {isEditing ? <Input type="number" step="0.01" value={editForm.sale_price ?? ''} onChange={e => setEditForm({ ...editForm, sale_price: parseFloat(e.target.value) })} className="h-7 text-sm w-24" /> : <span className="font-mono font-medium">{formatCurrency(Number(p.sale_price))}</span>}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Custo Total</span>
                      <span className="font-mono">{formatCurrency(totalCost)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Margem</span>
                      <span className={`font-mono font-bold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-destructive'}`}>
                        {formatPercent(margin)}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs text-muted-foreground block">Vendidos</span>
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

                {/* Expanded: material details + cost breakdown */}
                {isExpanded && (
                  <div className="pb-4 px-8 space-y-3 animate-fade-in">
                    {/* Cost breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                      <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">Overhead</span>
                        <p className="font-mono font-bold mt-1">{formatCurrency(overheadPerUnit)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-success">Lucro/Un.</span>
                        <p className={`font-mono font-bold mt-1 ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(profit)}</p>
                      </div>
                    </div>

                    {/* Materials list */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Materiais Utilizados</h4>
                      {pMats.length === 0 && <p className="text-xs text-muted-foreground">Nenhum material vinculado. Adicione abaixo.</p>}
                      <div className="space-y-1 mb-3">
                        {pMats.map(m => {
                          const price = materialPrices.find(mp => mp.material_name === m.material_name.toLowerCase());
                          const lineCost = Number(m.quantity_per_unit) * (price?.avg_unit_price || 0);
                          return (
                            <div key={m.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/20 text-sm">
                              <span>{m.material_name} × {Number(m.quantity_per_unit)}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs">
                                  {price ? `${formatCurrency(price.avg_unit_price)} × ${m.quantity_per_unit} = ${formatCurrency(lineCost)}` : 'Sem preço'}
                                </span>
                                <button onClick={() => removeMaterial(m.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add material */}
                      <div className="flex gap-2">
                        <select
                          value={matForm.material_name}
                          onChange={e => setMatForm({ ...matForm, material_name: e.target.value })}
                          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                        >
                          <option value="">Selecione material...</option>
                          {COMMON_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                          {/* Also show materials from purchases not in common list */}
                          {materialPrices
                            .filter(mp => !COMMON_MATERIALS.some(cm => cm.toLowerCase() === mp.material_name))
                            .map(mp => <option key={mp.material_name} value={mp.material_name}>{mp.material_name}</option>)
                          }
                        </select>
                        <Input
                          type="number" step="0.01" placeholder="Qtd/un"
                          value={matForm.quantity_per_unit}
                          onChange={e => setMatForm({ ...matForm, quantity_per_unit: e.target.value })}
                          className="w-24 rounded-lg"
                        />
                        <Button size="sm" onClick={() => addMaterialToProduct(p.id)} className="rounded-lg">
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>

                    {/* Recommended price */}
                    {Number(p.sale_price) > 0 && margin < 30 && (
                      <div className="text-xs bg-warning/10 rounded-lg p-3 border border-warning/20">
                        💡 Para margem de 30%, venda por <strong className="text-success">{formatCurrency(totalCost / 0.7)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
