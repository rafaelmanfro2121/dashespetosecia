import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Warehouse, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  last_purchase_date: string | null;
  last_purchase_price: number | null;
  is_active: boolean;
}

export default function EstoquePage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', unit: 'kg', current_stock: '', min_stock: '', cost_per_unit: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});

  const fetchItems = useCallback(async () => {
    const { data } = await supabase.from('inventory').select('*').order('name');
    if (data) setItems(data as InventoryItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const lowStockItems = items.filter(i => i.is_active && i.current_stock <= i.min_stock && i.min_stock > 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Preencha o nome do material'); return; }
    const { error } = await supabase.from('inventory').insert({
      name: form.name,
      unit: form.unit || 'kg',
      current_stock: parseFloat(form.current_stock || '0'),
      min_stock: parseFloat(form.min_stock || '0'),
      cost_per_unit: parseFloat(form.cost_per_unit || '0'),
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    setForm({ name: '', unit: 'kg', current_stock: '', min_stock: '', cost_per_unit: '' });
    toast.success('Material cadastrado');
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('inventory').delete().eq('id', id);
    fetchItems();
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await supabase.from('inventory').update({
      name: editForm.name,
      unit: editForm.unit,
      current_stock: editForm.current_stock,
      min_stock: editForm.min_stock,
      cost_per_unit: editForm.cost_per_unit,
      last_purchase_date: editForm.last_purchase_date,
      last_purchase_price: editForm.last_purchase_price,
    }).eq('id', editingId);
    setEditingId(null);
    toast.success('Material atualizado');
    fetchItems();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Warehouse size={28} className="text-primary" />
        <h1 className="page-title">Controle de Estoque</h1>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-warning" />
            <h3 className="font-semibold text-sm text-warning">Alertas de Reposição</h3>
          </div>
          <div className="space-y-1">
            {lowStockItems.map(item => (
              <p key={item.id} className="text-sm text-foreground">
                <strong>{item.name}</strong>: {item.current_stock} {item.unit} restantes (mínimo: {item.min_stock} {item.unit})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="metric-card mb-6">
        <h3 className="section-label mb-3">Cadastrar Material</h3>
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Input placeholder="Nome do material" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Unidade (kg, un, L)" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Estoque atual" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Estoque mínimo" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Custo unitário" value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: e.target.value })} />
          <Button type="submit"><Plus size={16} className="mr-1" /> Cadastrar</Button>
        </form>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="metric-card border-l-4 border-l-primary">
          <p className="section-label">Total Materiais</p>
          <p className="text-2xl font-bold mt-1">{items.filter(i => i.is_active).length}</p>
        </div>
        <div className="metric-card border-l-4 border-l-destructive">
          <p className="section-label">Estoque Baixo</p>
          <p className="text-2xl font-bold mt-1 text-destructive">{lowStockItems.length}</p>
        </div>
        <div className="metric-card border-l-4 border-l-info">
          <p className="section-label">Valor em Estoque</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(items.reduce((s, i) => s + Number(i.current_stock) * Number(i.cost_per_unit), 0))}
          </p>
        </div>
      </div>

      <div className="metric-card">
        <h3 className="section-label mb-3">Materiais Cadastrados</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium text-muted-foreground">Material</th>
                <th className="pb-2 font-medium text-muted-foreground text-center">Estoque</th>
                <th className="pb-2 font-medium text-muted-foreground text-center">Mínimo</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Custo/Un</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Valor Total</th>
                <th className="pb-2 font-medium text-muted-foreground text-center">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum material cadastrado</td></tr>
              )}
              {items.map(item => {
                const isEditing = editingId === item.id;
                const isLow = item.current_stock <= item.min_stock && item.min_stock > 0;
                return (
                  <tr key={item.id} className="border-b border-muted/50 hover:bg-muted/30">
                    <td className="py-2 font-medium">
                      {isEditing ? <Input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-7 text-sm" /> : item.name}
                    </td>
                    <td className="py-2 text-center font-mono">
                      {isEditing ? <Input type="number" step="0.01" value={editForm.current_stock ?? ''} onChange={e => setEditForm({ ...editForm, current_stock: parseFloat(e.target.value) })} className="h-7 text-sm w-20 mx-auto" /> : `${item.current_stock} ${item.unit}`}
                    </td>
                    <td className="py-2 text-center font-mono">
                      {isEditing ? <Input type="number" step="0.01" value={editForm.min_stock ?? ''} onChange={e => setEditForm({ ...editForm, min_stock: parseFloat(e.target.value) })} className="h-7 text-sm w-20 mx-auto" /> : `${item.min_stock} ${item.unit}`}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {isEditing ? <Input type="number" step="0.01" value={editForm.cost_per_unit ?? ''} onChange={e => setEditForm({ ...editForm, cost_per_unit: parseFloat(e.target.value) })} className="h-7 text-sm w-24 ml-auto" /> : formatCurrency(Number(item.cost_per_unit))}
                    </td>
                    <td className="py-2 text-right font-mono font-medium">{formatCurrency(Number(item.current_stock) * Number(item.cost_per_unit))}</td>
                    <td className="py-2 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={12} /> Baixo
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">OK</span>
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
                            <button onClick={() => startEdit(item)} className="text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
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
