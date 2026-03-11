import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users, Search, FileText, Upload, Eye, Loader2, Download, CheckCircle, DollarSign, CreditCard, Banknote, Trash2, Wrench, ChevronDown, ChevronUp, Calendar, MapPin, Phone, Mail, User, Package, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const CARD_FEE = 0.1177;
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

interface ClienteRow {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string;
  cliente_cpf_cnpj: string;
  cliente_contato: string;
  atendimento_data: string;
  items: any;
  os_number: string;
  order_status: string;
  nota_fiscal_url: string;
  total: number;
  payment_status: string;
  paid_amount: number;
  payment_method_client: string;
}

function getPaymentColor(status: string, paid: number, total: number) {
  if (status === 'pago' || (total > 0 && paid >= total)) {
    return { row: 'border-l-4 border-l-blue-800 bg-blue-900/10', badge: 'bg-blue-800 text-white', label: 'Pago Total', dot: 'bg-blue-800' };
  }
  if (status === 'parcial' || paid > 0) {
    return { row: 'border-l-4 border-l-emerald-400 bg-emerald-200/30', badge: 'bg-emerald-400 text-emerald-950', label: 'Parcial', dot: 'bg-emerald-400' };
  }
  return { row: 'border-l-4 border-l-orange-500 bg-orange-400/10', badge: 'bg-orange-500 text-white', label: 'Pendente', dot: 'bg-orange-500' };
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  const dayOfMonth = d.getDate();
  return Math.ceil(dayOfMonth / 7);
}

function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [customAmountId, setCustomAmountId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('service_orders')
      .select('id, cliente_nome, cliente_telefone, cliente_email, cliente_cpf_cnpj, cliente_contato, atendimento_data, items, os_number, order_status, nota_fiscal_url, total, payment_status, paid_amount, payment_method_client')
      .order('atendimento_data', { ascending: false });
    if (data) setClientes(data as ClienteRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchClientes(); }, []);

  const availableYears = [...new Set(clientes.map(c => c.atendimento_data?.split('-')[0]).filter(Boolean))] as string[];
  if (!availableYears.includes(selectedYear)) availableYears.push(selectedYear);
  availableYears.sort((a, b) => Number(b) - Number(a));

  const filtered = clientes.filter(c => {
    if (!c.atendimento_data) return false;
    const [year, month] = c.atendimento_data.split('-');
    if (year !== selectedYear) return false;
    if (selectedMonth !== 'all' && month !== selectedMonth.padStart(2, '0')) return false;
    if (filterPayment !== 'all') {
      const paid = c.paid_amount || 0;
      const total = c.total || 0;
      const status = c.payment_status;
      if (filterPayment === 'pago' && status !== 'pago' && !(total > 0 && paid >= total)) return false;
      if (filterPayment === 'parcial' && status !== 'parcial' && !(paid > 0 && paid < total)) return false;
      if (filterPayment === 'pendente' && (status === 'pago' || status === 'parcial' || paid > 0)) return false;
    }
    if (filterStatus !== 'all') {
      if ((c.order_status || 'em_producao') !== filterStatus) return false;
    }
    if (!search) return true;
    const s = search.toLowerCase();
    return c.cliente_nome?.toLowerCase().includes(s) || c.cliente_telefone?.includes(s) || c.cliente_email?.toLowerCase().includes(s) || c.os_number?.includes(s);
  });

  // Group by week, then by day
  const groupedByWeek = useMemo(() => {
    const weeks: Record<number, { clients: ClienteRow[]; total: number; count: number }> = {};
    filtered.forEach(c => {
      const wk = getWeekNumber(c.atendimento_data);
      if (!weeks[wk]) weeks[wk] = { clients: [], total: 0, count: 0 };
      weeks[wk].clients.push(c);
      weeks[wk].total += c.total || 0;
      weeks[wk].count++;
    });
    // Sort weeks descending
    return Object.entries(weeks)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([wk, data]) => {
        // Group by day within week
        const byDay: Record<string, ClienteRow[]> = {};
        data.clients.forEach(c => {
          const day = c.atendimento_data;
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push(c);
        });
        const days = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));
        return { week: Number(wk), total: data.total, count: data.count, days };
      });
  }, [filtered]);

  const getProducts = (items: any): string => {
    if (!items || !Array.isArray(items)) return '—';
    return items.map((i: any) => i.name).filter(Boolean).join(', ') || '—';
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('service_orders').update({ order_status: newStatus }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); }
    else { setClientes(prev => prev.map(c => c.id === id ? { ...c, order_status: newStatus } : c)); toast.success(newStatus === 'enviado' ? 'Marcado como Enviado' : 'Marcado como Em Produção'); }
  };

  const processPayment = async (cliente: ClienteRow, amount: number, isCard: boolean) => {
    if (!user) { toast.error('Faça login primeiro'); return; }
    setPayingId(cliente.id);

    const netAmount = isCard ? amount * (1 - CARD_FEE) : amount;
    const newPaidAmount = (cliente.paid_amount || 0) + amount;
    const isPaidFull = newPaidAmount >= (cliente.total || 0);
    const method = isCard ? 'Cartão de Crédito' : 'Dinheiro/PIX';

    const { error: statusError } = await supabase
      .from('service_orders')
      .update({
        payment_status: isPaidFull ? 'pago' : 'parcial',
        paid_amount: newPaidAmount,
        payment_method_client: method,
      })
      .eq('id', cliente.id);

    if (statusError) {
      toast.error('Erro ao registrar pagamento');
      setPayingId(null);
      return;
    }

    try {
      const itemNames = Array.isArray(cliente.items)
        ? cliente.items.map((i: any) => String(i?.name || '').toUpperCase())
        : [];
      const types = new Set<string>();
      itemNames.forEach((name: string) => {
        if (name.includes('FAZE')) types.add('FAZE');
        if (name.includes('LEGACY')) types.add('LEGACY');
        if (name.includes('IMPERIAL')) types.add('IMPERIAL');
      });
      const tipoVenda = types.size > 0 ? Array.from(types).join(' + ') : 'CHURRASQUEIRA';
      const vendaDescription = `[VENDA_OS] ${tipoVenda} - OS #${cliente.os_number} - ${cliente.cliente_nome}`;

      const { data: catData } = await supabase
        .from('categories')
        .select('id')
        .eq('name', 'Vendas')
        .limit(1);
      const vendaCategoryId = catData?.[0]?.id ?? null;

      const { data: existingSaleTx } = await supabase
        .from('transactions')
        .select('id, amount')
        .ilike('description', `%OS #${cliente.os_number}%`)
        .eq('type', 'entrada')
        .limit(1)
        .maybeSingle();

      if (existingSaleTx?.id) {
        await supabase
          .from('transactions')
          .update({
            amount: cliente.total || 0,
            category_id: vendaCategoryId,
            payment_method: method,
          })
          .eq('id', existingSaleTx.id);
      } else {
        const { error: txInsertError } = await supabase.from('transactions').insert({
          description: vendaDescription,
          amount: cliente.total || 0,
          type: 'entrada',
          category_id: vendaCategoryId,
          transaction_date: new Date().toISOString().split('T')[0],
          user_id: user.id,
          payment_method: method,
        });
        if (txInsertError) {
          console.error('[Clientes] Erro ao inserir transação:', txInsertError);
          toast.error('Pagamento salvo, mas erro ao lançar entrada no financeiro');
        }
      }
    } catch (err) {
      console.error('[Clientes] Exception ao criar transação:', err);
    }

    setClientes(prev => prev.map(c =>
      c.id === cliente.id
        ? { ...c, payment_status: isPaidFull ? 'pago' : 'parcial', paid_amount: newPaidAmount, payment_method_client: method }
        : c
    ));
    const cardMsg = isCard ? ` | Líquido: ${fmt(netAmount)}` : '';
    toast.success(`${fmt(amount)} registrado${cardMsg}`);

    setPayingId(null);
    setCustomAmountId(null);
    setCustomAmount('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setUploadingId(selectedId);
    const filePath = `notas/${selectedId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('invoices').upload(filePath, file);
    if (uploadError) { toast.error('Erro ao enviar nota fiscal'); setUploadingId(null); return; }
    const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(filePath);
    const { error: updateError } = await supabase.from('service_orders').update({ nota_fiscal_url: urlData.publicUrl }).eq('id', selectedId);
    if (updateError) { toast.error('Erro ao salvar nota fiscal'); }
    else { setClientes(prev => prev.map(c => c.id === selectedId ? { ...c, nota_fiscal_url: urlData.publicUrl } : c)); toast.success('Nota fiscal anexada'); }
    setUploadingId(null); setSelectedId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileUpload = (id: string) => { setSelectedId(id); setTimeout(() => fileInputRef.current?.click(), 100); };

  const totalFiltered = filtered.reduce((s, c) => s + (c.total || 0), 0);

  const renderPaymentPopover = (c: ClienteRow) => {
    const total = c.total || 0;
    const paid = c.paid_amount || 0;
    const remaining = Math.max(0, total - paid);

    if (c.payment_status === 'pago') {
      const colors = getPaymentColor(c.payment_status, paid, total);
      return (
        <div className="flex items-center gap-2">
          <Badge className={`${colors.badge} text-xs gap-1 px-3 py-1`}>
            <CheckCircle size={12} /> Pago Total
          </Badge>
          <span className="text-[10px] text-muted-foreground">{fmt(paid)}</span>
        </div>
      );
    }

    const method = c.payment_method_client || '';
    const isCard = method.toLowerCase().includes('cartão') || method.toLowerCase().includes('credito') || method.toLowerCase().includes('crédito');
    const isPix = method.toLowerCase().includes('pix') || method.toLowerCase().includes('dinheiro');
    const lockedToCard = paid > 0 && isCard;
    const lockedToPix = paid > 0 && isPix;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1 font-medium" disabled={payingId === c.id}>
            {payingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <DollarSign size={14} />}
            {c.payment_status === 'parcial' ? `Resta ${fmt(remaining)}` : 'Registrar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground">Registrar Pagamento</div>
            <div className="text-xs text-muted-foreground">
              Total: {fmt(total)} {paid > 0 && <>| Pago: {fmt(paid)} | Resta: {fmt(remaining)}</>}
            </div>
            {!lockedToCard && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Entrada 30%</div>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 w-full"
                  onClick={() => processPayment(c, remaining * 0.3, false)}>
                  <Banknote size={12} /> 30% Dinheiro/PIX ({fmt(remaining * 0.3)})
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Valor total restante</div>
              <div className="flex gap-1.5">
                {!lockedToCard && (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1 flex-1"
                    onClick={() => processPayment(c, remaining, false)}>
                    <Banknote size={12} /> Dinheiro/PIX
                  </Button>
                )}
                {!lockedToPix && (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1 flex-1"
                    onClick={() => processPayment(c, remaining, true)}>
                    <CreditCard size={12} /> Cartão
                  </Button>
                )}
              </div>
              {!lockedToPix && remaining > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  Cartão: líquido {fmt(remaining * (1 - CARD_FEE))} (taxa {(CARD_FEE * 100).toFixed(2)}%)
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Valor personalizado</div>
              <Input type="number" placeholder="Valor..." className="h-8 text-xs"
                value={customAmountId === c.id ? customAmount : ''}
                onChange={e => { setCustomAmountId(c.id); setCustomAmount(e.target.value); }}
              />
              {customAmountId === c.id && Number(customAmount) > 0 && (
                <>
                  <div className="flex gap-1.5">
                    {!lockedToCard && (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 flex-1"
                        onClick={() => processPayment(c, Number(customAmount), false)}>
                        <Banknote size={12} /> Dinheiro/PIX
                      </Button>
                    )}
                    {!lockedToPix && (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 flex-1"
                        onClick={() => processPayment(c, Number(customAmount), true)}>
                        <CreditCard size={12} /> Cartão
                      </Button>
                    )}
                  </div>
                  {!lockedToPix && (
                    <div className="text-[10px] text-muted-foreground">
                      Cartão: líquido {fmt(Number(customAmount) * (1 - CARD_FEE))}
                    </div>
                  )}
                </>
              )}
            </div>
            {(lockedToCard || lockedToPix) && (
              <div className="text-[10px] text-amber-600 font-medium">
                ⚠ Método travado: {lockedToCard ? 'Cartão' : 'Dinheiro/PIX'} (mesmo da 1ª parcela)
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div>
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users size={22} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Clientes</h1>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente ou OS..." className="pl-9 h-9 text-sm" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 w-[100px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Pagamento: Todos</SelectItem>
              <SelectItem value="pago">Pago Total</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Pedido: Todos</SelectItem>
              <SelectItem value="em_producao">Em Produção</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-800" /> Pago</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-400" /> Parcial</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500" /> Pendente</span>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 mb-5 px-4 py-2.5 rounded-xl bg-card border text-sm">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <span className="font-semibold">{filtered.length}</span>
          <span className="text-muted-foreground">clientes</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-secondary" />
          <span className="font-semibold">{fmt(totalFiltered)}</span>
          <span className="text-muted-foreground">em vendas</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-muted-foreground" />
          <span className="text-muted-foreground">{groupedByWeek.length} semana(s)</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="metric-card text-center py-12 text-muted-foreground text-sm">
          {search ? 'Nenhum cliente encontrado' : 'Nenhum registro neste período'}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByWeek.map(({ week, total, count, days }) => (
            <div key={week} className="space-y-3">
              {/* Week header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <Calendar size={14} className="text-primary" />
                  <span className="text-sm font-bold text-primary">{week}ª Semana</span>
                </div>
                <div className="flex-1 h-px bg-border" />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-semibold">{count} venda(s)</span>
                  <span className="font-bold text-foreground">{fmt(total)}</span>
                </div>
              </div>

              {/* Days within week */}
              {days.map(([day, dayClients]) => (
                <div key={day} className="ml-2">
                  {/* Day label */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                    <span className="text-xs font-medium text-muted-foreground">{getDayLabel(day)}</span>
                  </div>

                  {/* Client cards */}
                  <div className="space-y-2 ml-3">
                    {dayClients.map(c => {
                      const colors = getPaymentColor(c.payment_status, c.paid_amount || 0, c.total || 0);
                      const isExpanded = expandedId === c.id;

                      return (
                        <div key={c.id} className={`rounded-xl border ${colors.row} transition-all duration-200`}>
                          {/* Main row - always visible */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          >
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground truncate">{c.cliente_nome || '—'}</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{c.os_number}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {getProducts(c.items)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="font-bold text-sm">{fmt(c.total || 0)}</span>
                              <Badge className={`${colors.badge} text-[10px] px-2 py-0.5`}>{colors.label}</Badge>
                              <Select value={c.order_status || 'em_producao'} onValueChange={(v) => { handleStatusChange(c.id, v); }}>
                                <SelectTrigger className="h-7 w-[120px] text-[10px]" onClick={e => e.stopPropagation()}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="em_producao">Em Produção</SelectItem>
                                  <SelectItem value="enviado">Enviado</SelectItem>
                                </SelectContent>
                              </Select>
                              {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                            </div>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-border/50 pt-3">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm">
                                  <User size={14} className="text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">Nome:</span>
                                  <span className="font-medium text-foreground">{c.cliente_nome || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone size={14} className="text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">Telefone:</span>
                                  <span className="font-medium text-foreground">{c.cliente_telefone || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail size={14} className="text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">E-mail:</span>
                                  <span className="font-medium text-foreground">{c.cliente_email || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">CPF/CNPJ:</span>
                                  <span className="font-medium text-foreground">{c.cliente_cpf_cnpj || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm col-span-2">
                                  <MapPin size={14} className="text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">Endereço:</span>
                                  <span className="font-medium text-foreground">{c.cliente_contato || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Package size={14} className="text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">Produto:</span>
                                  <span className="font-medium text-foreground">{getProducts(c.items)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <CalendarDays size={14} className="text-muted-foreground flex-shrink-0" />
                                  <span className="text-muted-foreground">Data da compra:</span>
                                  <span className="font-medium text-foreground">{formatDateBR(c.atendimento_data)}</span>
                                </div>
                              </div>

                              {/* Actions row */}
                              <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border/30">
                                {/* Payment */}
                                <div onClick={e => e.stopPropagation()}>
                                  {renderPaymentPopover(c)}
                                </div>

                                {/* Documents */}
                                <div className="flex items-center gap-1.5">
                                  {c.os_number && (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/ordem-servico?load=${c.id}`); }} title="Abrir Pedido">
                                      <FileText size={14} className="text-primary" />
                                      <span className="font-mono">{c.os_number}</span>
                                      <Download size={12} />
                                    </Button>
                                  )}
                                  {c.os_number && (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/ordem-servico-tecnica?load=${c.id}`); }} title="OS Técnica">
                                      <Wrench size={14} className="text-orange-500" />
                                      <span className="text-[10px]">Técnica</span>
                                    </Button>
                                  )}
                                </div>

                                <div className="h-5 w-px bg-border" />

                                {/* NF */}
                                <div className="flex items-center gap-1.5">
                                  {c.nota_fiscal_url && (
                                    <a href={c.nota_fiscal_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                                        <Eye size={14} /> NF
                                      </Button>
                                    </a>
                                  )}
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                                    onClick={(e) => { e.stopPropagation(); triggerFileUpload(c.id); }} disabled={uploadingId === c.id}>
                                    {uploadingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                    {c.nota_fiscal_url ? 'Trocar NF' : 'Anexar NF'}
                                  </Button>
                                </div>

                                <div className="flex-1" />

                                {/* Delete */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  title="Excluir OS"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!confirm(`Excluir OS #${c.os_number} de ${c.cliente_nome}?`)) return;
                                    await supabase.from('transactions').delete().ilike('description', `%OS #${c.os_number}%`);
                                    const { error } = await supabase.from('service_orders').delete().eq('id', c.id);
                                    if (error) { toast.error('Erro ao excluir'); return; }
                                    setClientes(prev => prev.filter(x => x.id !== c.id));
                                    toast.success(`OS #${c.os_number} excluída`);
                                  }}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
