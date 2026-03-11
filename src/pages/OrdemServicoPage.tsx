import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Printer, Save, FileDown, History, ArrowLeft, Lock, Unlock, Search, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import logoBlack from '@/assets/logo-black.png';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ServiceItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  sale_price: number;
}

interface SavedOS {
  id: string;
  os_number: string;
  cliente_nome: string;
  total: number;
  created_at: string;
}

const EMPRESA_STORAGE_KEY = 'os_empresa_data';

function loadEmpresaFromStorage() {
  try {
    const saved = localStorage.getItem(EMPRESA_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { nome: 'Espetos & Cia', cnpj: '', telefone: '', endereco: '', email: '' };
}

function getNextOsNumber(orders: SavedOS[]): string {
  if (orders.length === 0) return '';
  // Find the highest numeric OS number
  let max = 0;
  orders.forEach(os => {
    const num = parseInt(os.os_number, 10);
    if (!isNaN(num) && num > max) max = num;
  });
  if (max === 0) return '';
  return String(max + 1).padStart(String(max).length >= 5 ? String(max).length : 5, '0');
}

export default function OrdemServicoPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [view, setView] = useState<'form' | 'history'>('form');
  const [savedOrders, setSavedOrders] = useState<SavedOS[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [currentOsId, setCurrentOsId] = useState<string | null>(null);

  const [osNumber, setOsNumber] = useState('');
  const [empresa, setEmpresa] = useState(loadEmpresaFromStorage);
  const [empresaLocked, setEmpresaLocked] = useState(() => {
    // Lock by default if empresa data already saved
    return !!localStorage.getItem(EMPRESA_STORAGE_KEY);
  });
  const [cliente, setCliente] = useState({ nome: '', telefone: '', cpfCnpj: '', contato: '', email: '' });
  const [atendimento, setAtendimento] = useState({ vendedor: '', data: new Date().toISOString().split('T')[0], hora: new Date().toTimeString().slice(0, 5) });
  const [items, setItems] = useState<ServiceItem[]>([{ id: 1, name: '', quantity: 1, price: 0 }]);
  const [desconto, setDesconto] = useState(0);
  const [showDesconto, setShowDesconto] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [descricaoPagamento, setDescricaoPagamento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null);
  const [clienteSuggestions, setClienteSuggestions] = useState<Array<{ nome: string; telefone: string; email: string; cpfCnpj: string; contato: string }>>([]);
  const [showClienteSuggestions, setShowClienteSuggestions] = useState(false);
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const total = Math.max(0, subtotal - desconto);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase.from('service_orders').select('id, os_number, cliente_nome, total, created_at').order('created_at', { ascending: false });
    if (data) setSavedOrders(data as SavedOS[]);
  }, []);

  // Auto-load OS from query param (e.g., from Clientes page)
  useEffect(() => {
    const loadId = searchParams.get('load');
    if (loadId) {
      loadOS(loadId);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data } = await supabase.from('products').select('id, name, sale_price').eq('is_active', true).order('name');
      if (data) setCatalogProducts(data as CatalogProduct[]);
    };
    fetchCatalog();
  }, []);

  const searchClientes = async (term: string) => {
    if (term.length < 2) { setClienteSuggestions([]); setShowClienteSuggestions(false); return; }
    const { data } = await supabase
      .from('service_orders')
      .select('cliente_nome, cliente_telefone, cliente_email, cliente_cpf_cnpj, cliente_contato')
      .ilike('cliente_nome', `%${term}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      const unique = new Map<string, { nome: string; telefone: string; email: string; cpfCnpj: string; contato: string }>();
      data.forEach(d => {
        if (!unique.has(d.cliente_nome)) {
          unique.set(d.cliente_nome, {
            nome: d.cliente_nome,
            telefone: d.cliente_telefone || '',
            email: d.cliente_email || '',
            cpfCnpj: d.cliente_cpf_cnpj || '',
            contato: d.cliente_contato || '',
          });
        }
      });
      setClienteSuggestions(Array.from(unique.values()));
      setShowClienteSuggestions(unique.size > 0);
    }
  };

  // Set auto OS number for new forms based on history
  useEffect(() => {
    if (!currentOsId && savedOrders.length > 0 && !osNumber) {
      const next = getNextOsNumber(savedOrders);
      if (next) setOsNumber(next);
    }
  }, [savedOrders, currentOsId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save empresa to localStorage whenever it changes and is unlocked (being edited)
  const updateEmpresa = (update: Partial<typeof empresa>) => {
    setEmpresa(prev => {
      const updated = { ...prev, ...update };
      localStorage.setItem(EMPRESA_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const toggleEmpresaLock = () => {
    if (!empresaLocked) {
      // Locking: save current data
      localStorage.setItem(EMPRESA_STORAGE_KEY, JSON.stringify(empresa));
      toast.success('Dados da empresa travados');
    } else {
      toast.info('Dados da empresa liberados para edição');
    }
    setEmpresaLocked(prev => !prev);
  };

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), name: '', quantity: 1, price: 0 }]);
  const removeItem = (id: number) => { if (items.length > 1) setItems(prev => prev.filter(i => i.id !== id)); };
  const updateItem = (id: number, field: keyof ServiceItem, value: string | number) => setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const clearForm = useCallback((orders?: SavedOS[]) => {
    setCurrentOsId(null);
    const list = orders || savedOrders;
    const next = getNextOsNumber(list);
    setOsNumber(next);
    setCliente({ nome: '', telefone: '', cpfCnpj: '', contato: '', email: '' });
    setAtendimento({ vendedor: '', data: new Date().toISOString().split('T')[0], hora: new Date().toTimeString().slice(0, 5) });
    setItems([{ id: 1, name: '', quantity: 1, price: 0 }]);
    setDesconto(0);
    setShowDesconto(false);
    setFormaPagamento('');
    setDescricaoPagamento('');
    setObservacoes('');
    setEmpresa(loadEmpresaFromStorage());
  }, [savedOrders]);

  const saveOS = async () => {
    if (!user) { toast.error('Faça login primeiro'); return; }
    if (!cliente.nome) { toast.error('Preencha o nome do cliente'); return; }

    const payload = {
      os_number: osNumber,
      empresa_nome: empresa.nome, empresa_cnpj: empresa.cnpj, empresa_telefone: empresa.telefone, empresa_endereco: empresa.endereco, empresa_email: empresa.email,
      cliente_nome: cliente.nome, cliente_telefone: cliente.telefone, cliente_cpf_cnpj: cliente.cpfCnpj, cliente_contato: cliente.contato, cliente_email: cliente.email,
      vendedor: atendimento.vendedor, atendimento_data: atendimento.data, atendimento_hora: atendimento.hora,
      items: items as any, subtotal, desconto, total,
      forma_pagamento: formaPagamento, descricao_pagamento: descricaoPagamento, observacoes,
      user_id: user.id,
    };

    if (currentOsId) {
      const { error } = await supabase.from('service_orders').update(payload).eq('id', currentOsId);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('OS atualizada');
    } else {
      const { error } = await supabase.from('service_orders').insert(payload);
      if (error) { toast.error('Erro ao salvar'); return; }
      toast.success('OS salva com sucesso!');
    }

    const { data: freshOrders } = await supabase.from('service_orders').select('id, os_number, cliente_nome, total, created_at, atendimento_data, payment_status, order_status').order('created_at', { ascending: false });
    if (freshOrders) setSavedOrders(freshOrders as SavedOS[]);
    clearForm(freshOrders as SavedOS[] | undefined);
    setView('list');
  };

  const loadOS = async (id: string) => {
    const { data } = await supabase.from('service_orders').select('*').eq('id', id).single();
    if (!data) return;
    setCurrentOsId(data.id);
    setOsNumber(data.os_number || '');
    // Load empresa data from DB if available (for PDF accuracy), otherwise keep localStorage
    if (data.empresa_nome) {
      const loadedEmpresa = {
        nome: data.empresa_nome || '',
        cnpj: data.empresa_cnpj || '',
        telefone: data.empresa_telefone || '',
        endereco: data.empresa_endereco || '',
        email: data.empresa_email || '',
      };
      setEmpresa(loadedEmpresa);
    }
    setCliente({ nome: data.cliente_nome || '', telefone: data.cliente_telefone || '', cpfCnpj: data.cliente_cpf_cnpj || '', contato: data.cliente_contato || '', email: (data as any).cliente_email || '' });
    setAtendimento({ vendedor: data.vendedor || '', data: data.atendimento_data || '', hora: data.atendimento_hora || '' });
    setItems((data.items as any as ServiceItem[]) || [{ id: 1, name: '', quantity: 1, price: 0 }]);
    setDesconto(Number(data.desconto) || 0);
    setShowDesconto(Number(data.desconto) > 0);
    setFormaPagamento(data.forma_pagamento || '');
    setDescricaoPagamento(data.descricao_pagamento || '');
    setObservacoes(data.observacoes || '');
    setView('form');
  };

  const deleteOS = async (id: string) => {
    await supabase.from('service_orders').delete().eq('id', id);
    toast.success('OS removida');
    fetchHistory();
  };

  const expandTextareas = useCallback(() => {
    if (!printRef.current) return;
    const textareas = printRef.current.querySelectorAll('textarea');

    textareas.forEach((ta) => {
      const textarea = ta as HTMLTextAreaElement;
      textarea.style.height = 'auto';
      textarea.style.overflow = 'hidden';
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.style.overflow = 'visible';
    });
  }, []);

  useEffect(() => {
    const handleBeforePrint = () => expandTextareas();
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => window.removeEventListener('beforeprint', handleBeforePrint);
  }, [expandTextareas]);

  const generatePDF = async () => {
    if (!printRef.current) return;
    setLoadingPdf(true);
    try {
      expandTextareas();
      // Hide no-print elements
      const noPrintEls = printRef.current.querySelectorAll('.no-print');
      noPrintEls.forEach(el => (el as HTMLElement).style.display = 'none');

      // Show print mirrors, hide expandable inputs for PDF
      const expandableEls = printRef.current.querySelectorAll('[data-expandable]');
      const mirrorEls = printRef.current.querySelectorAll('[data-print-mirror]');
      const obsPrintTextEls = printRef.current.querySelectorAll('[data-observacoes-print-text]');
      const obsPrintEls = printRef.current.querySelectorAll('[data-observacoes-print]');

      expandableEls.forEach(el => (el as HTMLElement).style.display = 'none');
      mirrorEls.forEach(el => {
        const h = el as HTMLElement;
        h.style.display = 'block';
        h.style.minHeight = '18px';
        h.style.padding = '1px 4px';
        h.style.fontSize = '11px';
        h.style.whiteSpace = 'pre-wrap';
        h.style.wordBreak = 'break-word';
        h.style.overflowWrap = 'break-word';
        h.style.overflow = 'visible';
        h.style.border = '1px solid #d1d5db';
        h.style.borderRadius = '4px';
        h.style.lineHeight = '1.4';
      });
      obsPrintEls.forEach(el => (el as HTMLElement).style.display = 'none');
      obsPrintTextEls.forEach(el => {
        const h = el as HTMLElement;
        h.style.display = 'block';
        h.style.whiteSpace = 'pre-wrap';
        h.style.wordBreak = 'break-word';
        h.style.padding = '1px 4px';
        h.style.fontSize = '11px';
        h.style.border = '1px solid #d1d5db';
        h.style.borderRadius = '6px';
      });

      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

      // Restore all elements
      noPrintEls.forEach(el => (el as HTMLElement).style.display = '');
      expandableEls.forEach(el => (el as HTMLElement).style.display = '');
      mirrorEls.forEach(el => { (el as HTMLElement).style.cssText = ''; });
      obsPrintEls.forEach(el => (el as HTMLElement).style.display = '');
      obsPrintTextEls.forEach(el => { (el as HTMLElement).style.cssText = ''; });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`OS_${osNumber || 'sem-numero'}_${cliente.nome || 'cliente'}.pdf`);
      toast.success('PDF gerado com sucesso');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
    setLoadingPdf(false);
  };

  const handlePrint = () => {
    expandTextareas();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  // History filters state
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('todos');

  const filteredOrders = useMemo(() => {
    return savedOrders.filter(os => {
      const search = historySearch.toLowerCase().trim();
      if (search) {
        const matchName = os.cliente_nome?.toLowerCase().includes(search);
        const matchOs = os.os_number?.toLowerCase().includes(search);
        if (!matchName && !matchOs) return false;
      }
      if (historyDateFrom) {
        const d = os.atendimento_data || os.created_at.split('T')[0];
        if (d < historyDateFrom) return false;
      }
      if (historyDateTo) {
        const d = os.atendimento_data || os.created_at.split('T')[0];
        if (d > historyDateTo) return false;
      }
      if (historyStatusFilter !== 'todos') {
        if (historyStatusFilter === 'pago' && os.payment_status !== 'pago') return false;
        if (historyStatusFilter === 'parcial' && os.payment_status !== 'parcial') return false;
        if (historyStatusFilter === 'pendente' && os.payment_status !== 'pendente') return false;
        if (historyStatusFilter === 'em_producao' && os.order_status !== 'em_producao') return false;
        if (historyStatusFilter === 'enviado' && os.order_status !== 'enviado') return false;
      }
      return true;
    });
  }, [savedOrders, historySearch, historyDateFrom, historyDateTo, historyStatusFilter]);

  const historyTotalValue = useMemo(() => filteredOrders.reduce((s, o) => s + Number(o.total), 0), [filteredOrders]);

  const getStatusBadge = (os: SavedOS) => {
    if (os.payment_status === 'pago') return { label: 'Pago', className: 'bg-blue-800/20 text-blue-300 border-blue-800/30' };
    if (os.payment_status === 'parcial') return { label: 'Parcial', className: 'bg-emerald-800/20 text-emerald-300 border-emerald-800/30' };
    return { label: 'Pendente', className: 'bg-orange-800/20 text-orange-300 border-orange-800/30' };
  };

  const getOrderStatusBadge = (os: SavedOS) => {
    if (os.order_status === 'enviado') return { label: 'Enviado', className: 'bg-primary/20 text-primary border-primary/30' };
    return { label: 'Em Produção', className: 'bg-muted text-muted-foreground border-border' };
  };

  const hasActiveFilters = historySearch || historyDateFrom || historyDateTo || historyStatusFilter !== 'todos';
  const clearFilters = () => { setHistorySearch(''); setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryStatusFilter('todos'); };

  // History view
  if (view === 'list') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileDown size={20} className="text-primary" />
            Ordens de Serviço
          </h1>
          <Button onClick={() => { clearForm(); setView('form'); }} size="sm" className="gap-1"><Plus size={14} /> Nova OS</Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="metric-card flex items-center gap-3 p-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users size={16} className="text-primary" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground">Pedidos</p>
              <p className="font-bold text-foreground">{filteredOrders.length}</p>
            </div>
          </div>
          <div className="metric-card flex items-center gap-3 p-3">
            <div className="p-2 rounded-lg bg-primary/10"><DollarSign size={16} className="text-primary" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground">Valor Total</p>
              <p className="font-bold text-foreground text-sm">{fmt(historyTotalValue)}</p>
            </div>
          </div>
          <div className="metric-card flex items-center gap-3 p-3 col-span-2 md:col-span-1">
            <div className="p-2 rounded-lg bg-primary/10"><Filter size={16} className="text-primary" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground">Total Cadastrado</p>
              <p className="font-bold text-foreground">{savedOrders.length} OS</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="metric-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Filter size={12} /> Filtros</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-destructive hover:underline flex items-center gap-1"><X size={12} /> Limpar</button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do cliente ou nº da OS..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Date range */}
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-muted-foreground" />
              <Input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)} className="h-8 text-xs w-[130px]" />
              <span className="text-xs text-muted-foreground">até</span>
              <Input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)} className="h-8 text-xs w-[130px]" />
            </div>

            {/* Status filter */}
            <select
              value={historyStatusFilter}
              onChange={e => setHistoryStatusFilter(e.target.value)}
              className="h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground"
            >
              <option value="todos">Todos Status</option>
              <option value="pago">Pago</option>
              <option value="parcial">Parcial</option>
              <option value="pendente">Pendente</option>
              <option value="em_producao">Em Produção</option>
              <option value="enviado">Enviado</option>
            </select>
          </div>
        </div>

        {/* Orders list */}
        {filteredOrders.length === 0 ? (
          <div className="metric-card text-center py-12 text-muted-foreground">
            {hasActiveFilters ? 'Nenhuma OS encontrada com esses filtros' : 'Nenhuma OS salva ainda'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map(os => {
              const statusBadge = getStatusBadge(os);
              const orderBadge = getOrderStatusBadge(os);
              const dateStr = os.atendimento_data
                ? new Date(os.atendimento_data + 'T12:00:00').toLocaleDateString('pt-BR')
                : new Date(os.created_at).toLocaleDateString('pt-BR');
              return (
                <div key={os.id} className="metric-card flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="cursor-pointer flex-1 min-w-0" onClick={() => loadOS(os.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">OS #{os.os_number || '—'}</span>
                      <span className="font-semibold text-sm truncate">{os.cliente_nome || 'Sem cliente'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{dateStr}</span>
                      <span className="font-mono font-medium text-sm text-foreground">{fmt(Number(os.total))}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadge.className}`}>{statusBadge.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${orderBadge.className}`}>{orderBadge.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => loadOS(os.id)} className="text-muted-foreground hover:text-primary p-2" title="Editar OS"><Pencil size={14} /></button>
                    <button onClick={() => deleteOS(os.id)} className="text-muted-foreground hover:text-destructive p-2" title="Excluir OS"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        #os-print [data-print-mirror] { display: none; }
        #os-print [data-observacoes-print-text] { display: none; }
        @media print {
          body * { visibility: hidden; }
          #os-print, #os-print * { visibility: visible; }
          #os-print { position: absolute; left: 0; top: 0; width: 100%; padding: 8mm !important; font-size: 11px !important; }
          #os-print .print-compact { margin-bottom: 6px !important; padding: 6px !important; }
          #os-print .print-compact h3 { margin-bottom: 4px !important; padding-bottom: 4px !important; font-size: 11px !important; }
          #os-print input { height: 20px !important; font-size: 11px !important; padding: 1px 4px !important; }
          #os-print textarea { height: auto !important; min-height: 20px !important; max-height: none !important; overflow: visible !important; font-size: 11px !important; padding: 1px 4px !important; white-space: pre-wrap !important; word-wrap: break-word !important; display: block !important; }
          #os-print textarea[data-observacoes-print] { display: none !important; }
          #os-print [data-observacoes-print-text] {
            display: block !important;
            min-height: 20px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 6px !important;
            padding: 1px 4px !important;
            font-size: 11px !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
          }
          #os-print [data-expandable] { display: none !important; }
          #os-print [data-print-mirror] {
            display: block !important;
            min-height: 18px !important;
            padding: 1px 4px !important;
            font-size: 11px !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            overflow: visible !important;
            border: 1px solid #d1d5db !important;
            border-radius: 4px !important;
            line-height: 1.4 !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          #os-print table td, #os-print table th { padding: 2px 4px !important; font-size: 11px !important; }
          #os-print .print-signatures { margin-top: 20px !important; gap: 2rem !important; margin-bottom: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        <div className="no-print bg-muted/30 border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-bold text-foreground">
            {currentOsId ? `Editando OS #${osNumber || '—'}` : 'Nova Ordem de Serviço'}
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setView('list')} className="gap-1"><ArrowLeft size={14} /> Voltar</Button>
            <Button variant="outline" size="sm" onClick={() => clearForm()} className="gap-1"><Plus size={14} /> Nova</Button>
            <Button variant="outline" size="sm" onClick={saveOS} className="gap-1"><Save size={14} /> Salvar</Button>
            <Button variant="outline" size="sm" onClick={generatePDF} disabled={loadingPdf} className="gap-1">
              <FileDown size={14} /> {loadingPdf ? 'Gerando...' : 'PDF'}
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1"><Printer size={14} /> Imprimir</Button>
          </div>
        </div>

        <div id="os-print" ref={printRef} className="max-w-4xl mx-auto p-8 bg-white text-black">
          {/* OS Number */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center gap-2 text-base font-bold">
              Pedido nº
              <Input value={osNumber} onChange={e => setOsNumber(e.target.value)} className="w-28 text-center font-bold border-b-2 border-t-0 border-x-0 rounded-none bg-transparent h-7 text-sm text-black" placeholder="00001" />
            </div>
          </div>

          {/* Header: Logo + Company with Lock */}
          <div className="border border-gray-300 rounded-lg p-3 mb-4 flex gap-4 relative print-compact">
            {/* Lock toggle button */}
            <button
              onClick={toggleEmpresaLock}
              className="no-print absolute top-2 right-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title={empresaLocked ? 'Desbloquear edição dos dados da empresa' : 'Travar dados da empresa'}
            >
              {empresaLocked ? (
                <Lock size={16} className="text-amber-600" />
              ) : (
                <Unlock size={16} className="text-gray-400" />
              )}
            </button>

            <div className="flex-shrink-0 flex items-center justify-center w-40">
              <img src={logoBlack} alt="Logo" className="h-12 object-contain" />
            </div>
            <div className="flex-1 grid grid-cols-1 gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold whitespace-nowrap w-32 text-right">Empresa / CNPJ:</span>
                <Input
                  value={empresa.nome}
                  onChange={e => updateEmpresa({ nome: e.target.value })}
                  disabled={empresaLocked}
                  className={`flex-1 h-7 text-sm border-gray-300 bg-transparent text-black ${empresaLocked ? 'opacity-80 cursor-default border-transparent' : ''}`}
                  placeholder="Nome da empresa"
                />
                <Input
                  value={empresa.cnpj}
                  onChange={e => updateEmpresa({ cnpj: e.target.value })}
                  disabled={empresaLocked}
                  className={`w-44 h-7 text-sm border-gray-300 bg-transparent text-black ${empresaLocked ? 'opacity-80 cursor-default border-transparent' : ''}`}
                  placeholder="CNPJ"
                />
              </div>
              {([
                ['telefone', 'Telefone'],
                ['endereco', 'Endereço'],
                ['email', 'E-mail'],
              ] as const).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="font-semibold whitespace-nowrap w-32 text-right">{label}:</span>
                  <Input
                    value={empresa[k]}
                    onChange={e => updateEmpresa({ [k]: e.target.value })}
                    disabled={empresaLocked}
                    className={`flex-1 h-7 text-sm border-gray-300 bg-transparent text-black ${empresaLocked ? 'opacity-80 cursor-default border-transparent' : ''}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Client + Atendimento */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="border border-gray-300 rounded-lg p-3 print-compact">
              <h3 className="font-bold text-xs mb-2 text-center border-b border-gray-200 pb-1">Informações do Cliente</h3>
              <div className="space-y-1 text-xs">
                {/* Nome with autocomplete */}
                <div className="flex items-start gap-2 relative">
                  <span className="font-semibold w-24 text-right mt-1">Nome:</span>
                  <div className="flex-1 relative">
                    <Input
                      data-expandable
                      value={cliente.nome}
                      onChange={e => {
                        setCliente(p => ({ ...p, nome: e.target.value }));
                        searchClientes(e.target.value);
                      }}
                      onFocus={() => { if (cliente.nome.length >= 2) searchClientes(cliente.nome); }}
                      onBlur={() => setTimeout(() => setShowClienteSuggestions(false), 200)}
                      className="h-7 text-sm border-gray-300 bg-transparent text-black"
                      placeholder="Buscar cliente cadastrado..."
                    />
                    <div data-print-mirror>{cliente.nome || '\u00A0'}</div>
                    {showClienteSuggestions && clienteSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto no-print">
                        {clienteSuggestions.map((c, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex justify-between items-center"
                            onMouseDown={e => {
                              e.preventDefault();
                              setCliente({ nome: c.nome, telefone: c.telefone, email: c.email, cpfCnpj: c.cpfCnpj, contato: c.contato });
                              setShowClienteSuggestions(false);
                            }}
                          >
                            <span className="font-medium text-black">{c.nome}</span>
                            {c.telefone && <span className="text-gray-500">{c.telefone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Other client fields */}
                {([['telefone', 'Telefone'], ['email', 'E-mail'], ['cpfCnpj', 'CPF/CNPJ'], ['contato', 'Endereço']] as const).map(([k, l]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="font-semibold w-24 text-right mt-1">{l}:</span>
                    <div className="flex-1">
                      <Input data-expandable value={cliente[k]} onChange={e => setCliente(p => ({ ...p, [k]: e.target.value }))} className="h-7 text-sm border-gray-300 bg-transparent text-black" />
                      <div data-print-mirror>{cliente[k] || '\u00A0'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-gray-300 rounded-lg p-3 print-compact">
              <h3 className="font-bold text-xs mb-2 text-center border-b border-gray-200 pb-1">Dados do Atendimento</h3>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Vendedor:</span>
                  <Input value={atendimento.vendedor} onChange={e => setAtendimento(p => ({ ...p, vendedor: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Data:</span>
                  <Input type="date" value={atendimento.data} onChange={e => setAtendimento(p => ({ ...p, data: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs no-print" onClick={() => setAtendimento(p => ({ ...p, data: new Date().toISOString().split('T')[0] }))}>Hoje</Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Hora:</span>
                  <Input type="time" value={atendimento.hora} onChange={e => setAtendimento(p => ({ ...p, hora: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs no-print" onClick={() => setAtendimento(p => ({ ...p, hora: new Date().toTimeString().slice(0, 5) }))}>Agora</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Products & Services */}
          <div className="border border-gray-300 rounded-lg p-3 mb-4 print-compact">
            <h3 className="font-bold text-xs mb-2 text-center border-b border-gray-200 pb-1">Produtos e Serviços</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 w-8">#</th>
                  <th className="text-left py-1.5">Produto / Serviço</th>
                  <th className="text-center py-1.5 w-24">Qtd</th>
                  <th className="text-center py-1.5 w-28">Preço</th>
                  <th className="text-right py-1.5 w-28">Subtotal</th>
                  <th className="w-10 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const searchTerm = item.name.toLowerCase();
                  const suggestions = activeSearchId === item.id && searchTerm.length > 0
                    ? catalogProducts.filter(p => p.name.toLowerCase().includes(searchTerm))
                    : [];
                  return (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-500">{idx + 1}</td>
                      <td className="py-1.5 relative">
                        <Input
                          data-expandable
                          value={item.name}
                          onChange={e => { updateItem(item.id, 'name', e.target.value); setActiveSearchId(item.id); }}
                          onFocus={() => setActiveSearchId(item.id)}
                          onBlur={() => setTimeout(() => setActiveSearchId(null), 200)}
                          className="h-7 text-sm border-gray-300 bg-transparent text-black"
                          placeholder="Buscar produto ou digitar..."
                        />
                        <div data-print-mirror>{item.name || '\u00A0'}</div>
                        {suggestions.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto no-print">
                            {suggestions.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex justify-between items-center"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  updateItem(item.id, 'name', p.name);
                                  updateItem(item.id, 'price', p.sale_price);
                                  setActiveSearchId(null);
                                }}
                              >
                                <span className="font-medium text-black">{p.name}</span>
                                <span className="text-gray-500 font-mono">{fmt(p.sale_price)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5"><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} className="h-7 text-sm text-center border-gray-300 bg-transparent text-black" /></td>
                      <td className="py-1.5"><Input type="number" min={0} step={0.01} value={item.price || ''} onChange={e => updateItem(item.id, 'price', Number(e.target.value))} className="h-7 text-sm text-center border-gray-300 bg-transparent text-black" placeholder="0,00" /></td>
                      <td className="py-1.5 text-right font-medium">{fmt(item.quantity * item.price)}</td>
                      <td className="py-1.5 text-center no-print"><button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="no-print mt-2">
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs"><Plus size={14} /> Adicionar Item</Button>
            </div>
            <div className="mt-2 border-t border-gray-200 pt-2 space-y-1 text-xs">
              <div className="flex justify-end items-center gap-4">
                <span className="font-semibold">Subtotal:</span>
                <span className="w-32 text-right font-medium">{fmt(subtotal)}</span>
              </div>
              {showDesconto ? (
                <div className="flex justify-end items-center gap-4">
                  <span className="font-semibold">Desconto:</span>
                  <Input type="number" min={0} step={0.01} value={desconto || ''} onChange={e => setDesconto(Number(e.target.value))} className="w-32 h-7 text-sm text-right border-gray-300 bg-transparent text-black" placeholder="0,00" />
                  <button onClick={() => { setShowDesconto(false); setDesconto(0); }} className="text-red-500 no-print"><Trash2 size={14} /></button>
                </div>
              ) : (
                <div className="flex justify-end no-print">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowDesconto(true)} className="gap-1 text-xs"><Plus size={14} /> Adicionar Desconto</Button>
                </div>
              )}
              <div className="flex justify-end items-center gap-4 text-sm font-bold border-t border-gray-300 pt-1">
                <span>Total OS:</span>
                <span className="w-32 text-right">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="border border-gray-300 rounded-lg p-3 mb-3 print-compact">
            <h3 className="font-bold text-xs mb-2 text-center border-b border-gray-200 pb-1">Forma de Pagamento</h3>
            <div className="flex gap-3 text-xs">
              <div className="flex-1"><Input value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="h-7 text-xs border-gray-300 bg-transparent text-black" placeholder="Ex: PIX, Cartão, Boleto..." /></div>
              <div className="flex-1"><Input value={descricaoPagamento} onChange={e => setDescricaoPagamento(e.target.value)} className="h-7 text-xs border-gray-300 bg-transparent text-black" placeholder="Descrição / Parcelas" /></div>
            </div>
          </div>

          {/* Observations */}
          <div className="border border-gray-300 rounded-lg p-3 mb-3 print-compact">
            <h3 className="font-bold text-xs mb-2 text-center border-b border-gray-200 pb-1">Observações</h3>
            <Textarea
              data-observacoes-print
              value={observacoes}
              onChange={e => {
                setObservacoes(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
              className="min-h-[50px] text-xs border-gray-300 bg-transparent text-black resize-none overflow-hidden"
              placeholder="Observações adicionais..."
              style={{ overflow: 'hidden' }}
            />
            <div data-observacoes-print-text>{observacoes || '\u00A0'}</div>
          </div>

          {/* Authorization */}
          <div className="mb-4">
            <p className="text-xs font-medium text-center bg-gray-100 border border-gray-300 rounded px-3 py-1.5">
              Autorizo e concordo com a realização dos serviços listados conforme o combinado.
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 mt-16 mb-2 print-signatures">
            <div className="text-center"><div className="border-t border-black pt-2 mx-4"><span className="text-xs font-medium">Responsável pelo atendimento</span></div></div>
            <div className="text-center"><div className="border-t border-black pt-2 mx-4"><span className="text-xs font-medium">Cliente</span></div></div>
          </div>
        </div>
      </div>
    </>
  );
}
