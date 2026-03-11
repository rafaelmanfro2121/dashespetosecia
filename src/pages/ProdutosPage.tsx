import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package, Edit2, Check, X, AlertTriangle, ChevronDown, ChevronUp, ShieldAlert, Truck, Search, TrendingUp, BarChart3, DollarSign } from 'lucide-react';
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

const CARD_FEE_DISCOUNT = 0.1177;
const applyCardDiscount = (price: number) => price * (1 - CARD_FEE_DISCOUNT);

const COMMON_MATERIALS = [
  'Parafuso', 'Engrenagem', 'Chapa de Inox', 'Rolamento', 'Fuso',
  'Tubos', 'Barras', 'Rebites', 'Graxa', 'Módulo', 'Fonte', 'Trafo',
];

interface MaterialComposition {
  material_name: string;
  quantity: string;
  modelo: string;
}

function MarginBadge({ margin }: { margin: number }) {
  if (margin >= 30) return <Badge className="bg-success/15 text-success border-success/30 text-[10px] font-bold">{formatPercent(margin)}</Badge>;
  if (margin >= 15) return <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] font-bold">{formatPercent(margin)}</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-bold">{formatPercent(margin)}</Badge>;
}

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productMaterials, setProductMaterials] = useState<ProductMaterial[]>([]);
  const [materialPrices, setMaterialPrices] = useState<MaterialPrice[]>([]);
  const [warrantyCosts, setWarrantyCosts] = useState<WarrantyCost[]>([]);
  const [osSalesCount, setOsSalesCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({ name: '', description: '', sale_price: '', labor_cost: '', other_costs: '' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [newMaterials, setNewMaterials] = useState<MaterialComposition[]>(
    COMMON_MATERIALS.map(m => ({ material_name: m, quantity: '', modelo: '' }))
  );
  const [customMaterials, setCustomMaterials] = useState<MaterialComposition[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [matForm, setMatForm] = useState({ material_name: '', quantity_per_unit: '1', custom_name: '' });

  const [warrantyForm, setWarrantyForm] = useState({
    product_id: '', description: '', part_name: '', quantity: '1', unit_cost: '', shipping_cost: '0', notes: '', warranty_date: new Date().toISOString().slice(0, 10),
  });

  const fetchAll = useCallback(async () => {
    const [{ data: prodData }, { data: pmData }, { data: purchaseData }, { data: warrantyData }, { data: osData }] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('product_materials').select('*'),
      supabase.from('material_purchases').select('material_name, unit_price, total_cost, quantity'),
      supabase.from('warranty_costs').select('*').order('warranty_date', { ascending: false }),
      supabase.from('service_orders').select('items'),
    ]);

    if (prodData) setProducts(prodData as Product[]);
    if (pmData) setProductMaterials(pmData as ProductMaterial[]);
    if (warrantyData) setWarrantyCosts(warrantyData as WarrantyCost[]);

    if (osData && prodData) {
      const salesCount: Record<string, number> = {};
      (prodData as Product[]).forEach(p => { salesCount[p.id] = 0; });
      (osData as any[]).forEach(os => {
        if (!Array.isArray(os.items)) return;
        os.items.forEach((item: any) => {
          const itemName = String(item?.name || '').toUpperCase();
          (prodData as Product[]).forEach(p => {
            const pName = p.name.toUpperCase();
            if (itemName.includes(pName) || pName.includes(itemName) ||
                (itemName.includes('CHURRASQUEIRA') && pName.includes('CHURRASQUEIRA')) ||
                (itemName.includes('FAZE') && pName.includes('FAZE')) ||
                (itemName.includes('LEGACY') && pName.includes('LEGACY')) ||
                (itemName.includes('IMPERIAL') && pName.includes('IMPERIAL'))) {
              salesCount[p.id] = (salesCount[p.id] || 0) + (Number(item.quantity) || 1);
            }
          });
        });
      });
      setOsSalesCount(salesCount);
    }

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
    return productMaterials.filter(m => m.product_id === productId).reduce((sum, m) => sum + Number(m.quantity_per_unit), 0);
  };

  const totalUnitsSold = Object.values(osSalesCount).reduce((s, c) => s + c, 0);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const s = searchTerm.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s));
  }, [products, searchTerm]);

  const lowMarginProducts = products.filter(p => {
    if (!p.is_active || Number(p.sale_price) <= 0) return false;
    const netPrice = applyCardDiscount(Number(p.sale_price));
    const matCost = calcMaterialCost(p.id);
    const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs);
    return ((netPrice - totalCost) / netPrice) * 100 < 30;
  });

  const avgMargin = useMemo(() => {
    const active = products.filter(p => p.is_active && Number(p.sale_price) > 0);
    if (active.length === 0) return 0;
    return active.reduce((acc, p) => {
      const netPrice = applyCardDiscount(Number(p.sale_price));
      const matCost = calcMaterialCost(p.id);
      const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs);
      return acc + ((netPrice - totalCost) / netPrice * 100);
    }, 0) / active.length;
  }, [products, productMaterials]);

  const totalWarrantyCost = warrantyCosts.reduce((s, w) => s + Number(w.total_cost), 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.sale_price) { toast.error('Preencha nome e preço de venda'); return; }
    const { data: newProduct, error } = await supabase.from('products').insert({
      name: form.name, description: form.description || null,
      sale_price: parseFloat(form.sale_price), material_cost: 0,
      labor_cost: parseFloat(form.labor_cost || '0'), other_costs: parseFloat(form.other_costs || '0'),
    }).select('id').single();
    if (error || !newProduct) { toast.error('Erro ao salvar produto'); return; }

    const allMats = [...newMaterials, ...customMaterials].filter(m => m.quantity && parseFloat(m.quantity) > 0);
    if (allMats.length > 0) {
      await supabase.from('product_materials').insert(allMats.map(m => ({
        product_id: newProduct.id,
        material_name: m.modelo ? `${m.material_name} (${m.modelo})` : m.material_name,
        quantity_per_unit: parseFloat(m.quantity),
      })));
    }

    setForm({ name: '', description: '', sale_price: '', labor_cost: '', other_costs: '' });
    setNewMaterials(COMMON_MATERIALS.map(m => ({ material_name: m, quantity: '', modelo: '' })));
    setCustomMaterials([]);
    setShowNewForm(false);
    toast.success('Produto cadastrado');
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este produto e seus materiais?')) return;
    await supabase.from('product_materials').delete().eq('product_id', id);
    await supabase.from('products').delete().eq('id', id);
    fetchAll();
  };

  const startEdit = (p: Product) => { setEditingId(p.id); setEditForm({ ...p }); };
  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    await supabase.from('products').update({
      name: editForm.name, description: editForm.description, sale_price: editForm.sale_price,
      labor_cost: editForm.labor_cost, other_costs: editForm.other_costs,
    }).eq('id', editingId);
    setEditingId(null);
    toast.success('Produto atualizado');
    fetchAll();
  };

  const addMaterialToProduct = async (productId: string) => {
    const name = matForm.material_name === '__custom__' ? matForm.custom_name.trim() : matForm.material_name;
    if (!name) { toast.error('Selecione ou digite um material'); return; }
    const pMats = productMaterials.filter(m => m.product_id === productId);
    if (pMats.some(pm => pm.material_name.toLowerCase() === name.toLowerCase())) { toast.error('Material já adicionado'); return; }
    await supabase.from('product_materials').insert({
      product_id: productId, material_name: name, quantity_per_unit: parseFloat(matForm.quantity_per_unit || '1'),
    });
    setMatForm({ material_name: '', quantity_per_unit: '1', custom_name: '' });
    toast.success('Material adicionado');
    fetchAll();
  };

  const removeMaterial = async (id: string) => { await supabase.from('product_materials').delete().eq('id', id); fetchAll(); };

  const handleAddWarranty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warrantyForm.part_name || !warrantyForm.unit_cost || !warrantyForm.description) { toast.error('Preencha descrição, peça e custo'); return; }
    const qty = parseInt(warrantyForm.quantity || '1');
    const unitCost = parseFloat(warrantyForm.unit_cost);
    const shipping = parseFloat(warrantyForm.shipping_cost || '0');
    await supabase.from('warranty_costs').insert({
      product_id: warrantyForm.product_id || null, description: warrantyForm.description,
      part_name: warrantyForm.part_name, quantity: qty, unit_cost: unitCost,
      total_cost: qty * unitCost + shipping, shipping_cost: shipping,
      notes: warrantyForm.notes || null, warranty_date: warrantyForm.warranty_date,
    });
    setWarrantyForm({ product_id: '', description: '', part_name: '', quantity: '1', unit_cost: '', shipping_cost: '0', notes: '', warranty_date: new Date().toISOString().slice(0, 10) });
    toast.success('Custo registrado');
    fetchAll();
  };

  const removeWarranty = async (id: string) => { await supabase.from('warranty_costs').delete().eq('id', id); fetchAll(); };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="page-title">Produtos & Modelos</h1>
            <p className="text-muted-foreground text-xs">Catálogo com custos e margens calculadas automaticamente</p>
          </div>
        </div>
        <Button onClick={() => setShowNewForm(!showNewForm)} className="rounded-xl gap-1.5" size="sm">
          {showNewForm ? <X size={14} /> : <Plus size={14} />}
          {showNewForm ? 'Fechar' : 'Novo Produto'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="metric-card flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Produtos</p>
            <p className="text-xl font-bold text-foreground">{products.filter(p => p.is_active).length}</p>
          </div>
        </div>
        <div className="metric-card flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-success" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Margem Média</p>
            <p className={`text-xl font-bold ${avgMargin >= 30 ? 'text-success' : avgMargin >= 15 ? 'text-warning' : 'text-destructive'}`}>{formatPercent(avgMargin)}</p>
          </div>
        </div>
        <div className="metric-card flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
            <BarChart3 size={18} className="text-info" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Vendidos</p>
            <p className="text-xl font-bold text-foreground">{totalUnitsSold}</p>
          </div>
        </div>
        <div className="metric-card flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <ShieldAlert size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Garantias</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalWarrantyCost)}</p>
          </div>
        </div>
      </div>

      {/* Low margin alert */}
      {lowMarginProducts.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-warning" />
            <span className="text-sm font-semibold text-warning">Margem abaixo de 30%</span>
          </div>
          <div className="space-y-1">
            {lowMarginProducts.map(p => {
              const netPrice = applyCardDiscount(Number(p.sale_price));
              const matCost = calcMaterialCost(p.id);
              const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs);
              const margin = ((netPrice - totalCost) / netPrice) * 100;
              const targetPrice = totalCost / 0.7 / (1 - CARD_FEE_DISCOUNT);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{p.name}</span>
                  <Badge variant="destructive" className="text-[10px]">{formatPercent(margin)}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-success font-semibold">Recomendado: {formatCurrency(targetPrice)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Tabs defaultValue="produtos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 rounded-xl">
          <TabsTrigger value="produtos" className="rounded-xl gap-1.5 text-xs sm:text-sm"><Package size={14} /> Produtos</TabsTrigger>
          <TabsTrigger value="garantia" className="rounded-xl gap-1.5 text-xs sm:text-sm"><ShieldAlert size={14} /> Garantia</TabsTrigger>
        </TabsList>

        {/* === PRODUTOS TAB === */}
        <TabsContent value="produtos">
          {/* New product form */}
          {showNewForm && (
            <div className="metric-card mb-6 animate-fade-in border-2 border-primary/20">
              <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Cadastrar Novo Produto</h3>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <Input placeholder="Nome / Modelo *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
                  <Input placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl" />
                  <Input type="number" step="0.01" placeholder="Preço venda *" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} className="rounded-xl" />
                  <Input type="number" step="0.01" placeholder="Mão de obra" value={form.labor_cost} onChange={e => setForm({ ...form, labor_cost: e.target.value })} className="rounded-xl" />
                  <Input type="number" step="0.01" placeholder="Outros custos" value={form.other_costs} onChange={e => setForm({ ...form, other_costs: e.target.value })} className="rounded-xl" />
                </div>

                <div className="border border-muted rounded-xl p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    📦 Composição de Materiais <span className="text-[10px] font-normal normal-case">(preencha apenas o que usa)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {newMaterials.map((mat, idx) => (
                      <div key={mat.material_name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                        <span className="text-xs font-medium w-28 shrink-0 truncate">{mat.material_name}</span>
                        <Input placeholder="Modelo" value={mat.modelo}
                          onChange={e => { const u = [...newMaterials]; u[idx] = { ...u[idx], modelo: e.target.value }; setNewMaterials(u); }}
                          className="h-7 text-xs rounded-lg flex-1" />
                        <Input type="number" step="0.01" placeholder="R$" value={mat.quantity}
                          onChange={e => { const u = [...newMaterials]; u[idx] = { ...u[idx], quantity: e.target.value }; setNewMaterials(u); }}
                          className="h-7 text-xs rounded-lg w-20" />
                      </div>
                    ))}
                  </div>

                  {customMaterials.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Materiais Personalizados</p>
                      {customMaterials.map((mat, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                          <Input placeholder="Nome" value={mat.material_name}
                            onChange={e => { const u = [...customMaterials]; u[idx] = { ...u[idx], material_name: e.target.value }; setCustomMaterials(u); }}
                            className="h-7 text-xs rounded-lg w-28" />
                          <Input placeholder="Modelo" value={mat.modelo}
                            onChange={e => { const u = [...customMaterials]; u[idx] = { ...u[idx], modelo: e.target.value }; setCustomMaterials(u); }}
                            className="h-7 text-xs rounded-lg flex-1" />
                          <Input type="number" step="0.01" placeholder="R$" value={mat.quantity}
                            onChange={e => { const u = [...customMaterials]; u[idx] = { ...u[idx], quantity: e.target.value }; setCustomMaterials(u); }}
                            className="h-7 text-xs rounded-lg w-20" />
                          <button onClick={() => setCustomMaterials(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button type="button" variant="ghost" size="sm" onClick={() => setCustomMaterials(prev => [...prev, { material_name: '', quantity: '', modelo: '' }])} className="mt-2 text-xs gap-1">
                    <Plus size={12} /> Outro material
                  </Button>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="rounded-xl gap-1"><Plus size={16} /> Cadastrar</Button>
                </div>
              </form>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 rounded-xl h-9" />
          </div>

          {/* Products grid */}
          <div className="space-y-3">
            {filteredProducts.length === 0 && <div className="metric-card text-center py-12 text-muted-foreground text-sm">Nenhum produto encontrado</div>}
            {filteredProducts.map(p => {
              const netPrice = applyCardDiscount(Number(p.sale_price));
              const matCost = calcMaterialCost(p.id);
              const totalCost = matCost + Number(p.labor_cost) + Number(p.other_costs);
              const profit = netPrice - totalCost;
              const margin = netPrice > 0 ? (profit / netPrice) * 100 : 0;
              const isEditing = editingId === p.id;
              const isExpanded = expandedProduct === p.id;
              const pMats = productMaterials.filter(m => m.product_id === p.id);
              const soldCount = osSalesCount[p.id] || 0;

              return (
                <div key={p.id} className={`metric-card overflow-hidden transition-all duration-200 ${isExpanded ? 'ring-2 ring-primary/20' : ''}`}>
                  {/* Header row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 cursor-pointer" onClick={() => setExpandedProduct(isExpanded ? null : p.id)}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button className="text-muted-foreground hover:text-foreground shrink-0">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-8 text-sm rounded-lg" />
                            <Input type="number" step="0.01" placeholder="Preço" value={editForm.sale_price ?? ''} onChange={e => setEditForm({ ...editForm, sale_price: parseFloat(e.target.value) })} className="h-8 text-sm rounded-lg w-28" />
                          </div>
                        ) : (
                          <div>
                            <span className="font-semibold text-sm text-foreground">{p.name}</span>
                            {p.description && <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{p.description}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2.5 py-1.5">
                        <DollarSign size={12} className="text-muted-foreground" />
                        <div className="text-right">
                          <span className="text-[9px] text-muted-foreground block leading-tight">Líquido</span>
                          <span className="font-mono font-semibold text-xs">{formatCurrency(netPrice)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2.5 py-1.5">
                        <TrendingUp size={12} className="text-muted-foreground" />
                        <div className="text-right">
                          <span className="text-[9px] text-muted-foreground block leading-tight">Custo</span>
                          <span className="font-mono font-semibold text-xs">{formatCurrency(totalCost)}</span>
                        </div>
                      </div>
                      <MarginBadge margin={margin} />
                      {soldCount > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <BarChart3 size={10} /> {soldCount} vend.
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} className="p-1 rounded-md hover:bg-success/10 text-success"><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(p)} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(p.id)} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Material tags (collapsed) */}
                  {!isExpanded && pMats.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {pMats.map(m => (
                        <span key={m.id} className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                          {m.material_name} {formatCurrency(Number(m.quantity_per_unit))}
                        </span>
                      ))}
                    </div>
                  )}
                  {!isExpanded && pMats.length === 0 && (
                    <p className="mt-2 text-[10px] text-warning italic">⚠ Sem materiais — expanda para adicionar</p>
                  )}

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-4 animate-fade-in">
                      {/* Cost breakdown cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-info/5 border border-info/15">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-info">Material</span>
                          <p className="font-mono font-bold mt-1 text-sm">{formatCurrency(matCost)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mão de obra</span>
                          {isEditing ? (
                            <Input type="number" step="0.01" value={editForm.labor_cost ?? ''} onChange={e => setEditForm({ ...editForm, labor_cost: parseFloat(e.target.value) })} className="h-7 text-sm mt-1 rounded-lg" onClick={e => e.stopPropagation()} />
                          ) : (
                            <p className="font-mono font-bold mt-1 text-sm">{formatCurrency(Number(p.labor_cost))}</p>
                          )}
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outros</span>
                          {isEditing ? (
                            <Input type="number" step="0.01" value={editForm.other_costs ?? ''} onChange={e => setEditForm({ ...editForm, other_costs: parseFloat(e.target.value) })} className="h-7 text-sm mt-1 rounded-lg" onClick={e => e.stopPropagation()} />
                          ) : (
                            <p className="font-mono font-bold mt-1 text-sm">{formatCurrency(Number(p.other_costs))}</p>
                          )}
                        </div>
                        <div className={`p-3 rounded-xl border ${profit >= 0 ? 'bg-success/5 border-success/15' : 'bg-destructive/5 border-destructive/15'}`}>
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>Lucro/Un.</span>
                          <p className={`font-mono font-bold mt-1 text-sm ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(profit)}</p>
                        </div>
                      </div>

                      {/* Materials table */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">📦 Composição de Materiais</h4>
                        {pMats.length > 0 && (
                          <div className="rounded-xl border overflow-hidden mb-3">
                            <table className="w-full text-sm">
                              <thead><tr className="bg-muted/40 text-xs">
                                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Material</th>
                                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor (R$)</th>
                                <th className="py-2 px-3 w-8"></th>
                              </tr></thead>
                              <tbody>
                                {pMats.map(m => (
                                  <tr key={m.id} className="border-t border-muted/30 hover:bg-muted/20">
                                    <td className="py-2 px-3 font-medium text-sm">{m.material_name}</td>
                                    <td className="py-2 px-3 text-right font-mono font-semibold">{formatCurrency(Number(m.quantity_per_unit))}</td>
                                    <td className="py-2 px-3 text-right"><button onClick={() => removeMaterial(m.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button></td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 border-muted bg-muted/20">
                                  <td className="py-2 px-3 text-right text-xs font-semibold uppercase text-muted-foreground">Total Material</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold">{formatCurrency(matCost)}</td>
                                  <td></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                        {pMats.length === 0 && <p className="text-xs text-muted-foreground italic mb-3">Nenhum material vinculado.</p>}

                        {/* Add material */}
                        <div className="flex gap-2 flex-wrap items-end">
                          <div className="flex-1 min-w-[140px]">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Material</label>
                            <select value={matForm.material_name} onChange={e => setMatForm({ ...matForm, material_name: e.target.value })} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                              <option value="">Selecione...</option>
                              <optgroup label="Comuns">
                                {COMMON_MATERIALS.map(m => (
                                  <option key={m} value={m} disabled={pMats.some(pm => pm.material_name.toLowerCase() === m.toLowerCase())}>{m}</option>
                                ))}
                              </optgroup>
                              {materialPrices.filter(mp => !COMMON_MATERIALS.some(cm => cm.toLowerCase() === mp.material_name)).length > 0 && (
                                <optgroup label="Histórico">
                                  {materialPrices.filter(mp => !COMMON_MATERIALS.some(cm => cm.toLowerCase() === mp.material_name)).map(mp => (
                                    <option key={mp.material_name} value={mp.material_name}>{mp.material_name}</option>
                                  ))}
                                </optgroup>
                              )}
                              <option value="__custom__">✏️ Outro</option>
                            </select>
                          </div>
                          {matForm.material_name === '__custom__' && (
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Nome</label>
                              <Input placeholder="Nome" value={matForm.custom_name} onChange={e => setMatForm({ ...matForm, custom_name: e.target.value })} className="w-32 rounded-xl" />
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Valor (R$)</label>
                            <Input type="number" step="0.01" placeholder="R$" value={matForm.quantity_per_unit} onChange={e => setMatForm({ ...matForm, quantity_per_unit: e.target.value })} className="w-24 rounded-xl" />
                          </div>
                          <Button size="sm" onClick={() => addMaterialToProduct(p.id)} className="rounded-xl gap-1"><Plus size={14} /> Add</Button>
                        </div>
                      </div>

                      {margin < 30 && Number(p.sale_price) > 0 && (
                        <div className="text-xs bg-warning/10 rounded-xl p-3 border border-warning/20">
                          💡 Para margem 30%, venda por <strong className="text-success">{formatCurrency(totalCost / 0.7 / (1 - CARD_FEE_DISCOUNT))}</strong>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="metric-card flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0"><ShieldAlert size={18} className="text-destructive" /></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Garantias</p><p className="text-xl font-bold">{warrantyCosts.length}</p></div>
            </div>
            <div className="metric-card flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0"><DollarSign size={18} className="text-warning" /></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Custo Total</p><p className="text-xl font-bold text-destructive">{formatCurrency(totalWarrantyCost)}</p></div>
            </div>
            <div className="metric-card flex items-center gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0"><Truck size={18} className="text-info" /></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Frete Total</p><p className="text-xl font-bold">{formatCurrency(warrantyCosts.reduce((s, w) => s + Number(w.shipping_cost), 0))}</p></div>
            </div>
          </div>

          <div className="metric-card mb-6">
            <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Registrar Garantia</h3>
            <form onSubmit={handleAddWarranty} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <select value={warrantyForm.product_id} onChange={e => setWarrantyForm({ ...warrantyForm, product_id: e.target.value })} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Produto (opcional)</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Input placeholder="Descrição do problema" value={warrantyForm.description} onChange={e => setWarrantyForm({ ...warrantyForm, description: e.target.value })} className="rounded-xl" />
                <Input placeholder="Peça enviada" value={warrantyForm.part_name} onChange={e => setWarrantyForm({ ...warrantyForm, part_name: e.target.value })} className="rounded-xl" />
                <Input type="date" value={warrantyForm.warranty_date} onChange={e => setWarrantyForm({ ...warrantyForm, warranty_date: e.target.value })} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Input type="number" placeholder="Qtd" value={warrantyForm.quantity} onChange={e => setWarrantyForm({ ...warrantyForm, quantity: e.target.value })} className="rounded-xl" />
                <Input type="number" step="0.01" placeholder="Custo un." value={warrantyForm.unit_cost} onChange={e => setWarrantyForm({ ...warrantyForm, unit_cost: e.target.value })} className="rounded-xl" />
                <Input type="number" step="0.01" placeholder="Frete" value={warrantyForm.shipping_cost} onChange={e => setWarrantyForm({ ...warrantyForm, shipping_cost: e.target.value })} className="rounded-xl" />
                <Input placeholder="Observações" value={warrantyForm.notes} onChange={e => setWarrantyForm({ ...warrantyForm, notes: e.target.value })} className="rounded-xl" />
                <Button type="submit" className="rounded-xl gap-1"><Plus size={16} /> Registrar</Button>
              </div>
            </form>
          </div>

          <div className="metric-card">
            <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Histórico ({warrantyCosts.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground text-xs">Data</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs">Produto</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Descrição</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs">Peça</th>
                  <th className="pb-3 font-medium text-muted-foreground text-xs text-right">Total</th>
                  <th className="pb-3"></th>
                </tr></thead>
                <tbody>
                  {warrantyCosts.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum registro</td></tr>}
                  {warrantyCosts.map(w => (
                    <tr key={w.id} className="border-b border-muted/40 hover:bg-muted/20 transition-colors">
                      <td className="py-3 text-muted-foreground text-xs">{new Date(w.warranty_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="py-3 font-medium text-xs">{w.product_id ? products.find(p => p.id === w.product_id)?.name || '—' : '—'}</td>
                      <td className="py-3 text-muted-foreground text-xs hidden sm:table-cell">{w.description}</td>
                      <td className="py-3"><Badge variant="outline" className="text-[10px]">{w.part_name}</Badge></td>
                      <td className="py-3 text-right font-mono font-bold text-destructive text-xs">{formatCurrency(Number(w.total_cost))}</td>
                      <td className="py-3 text-right"><button onClick={() => removeWarranty(w.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></td>
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
