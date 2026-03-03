import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, FileText, Upload, Eye, Loader2, Download, CheckCircle, DollarSign, CreditCard, Banknote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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

interface ClienteRow {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string;
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
    return { row: 'bg-blue-900/15 hover:bg-blue-900/25', badge: 'bg-blue-800 text-white', label: 'Pago Total' };
  }
  if (status === 'parcial' || paid > 0) {
    return { row: 'bg-emerald-200/40 hover:bg-emerald-200/60', badge: 'bg-emerald-300 text-emerald-900', label: 'Parcial' };
  }
  return { row: 'bg-orange-400/15 hover:bg-orange-400/25', badge: 'bg-orange-500 text-white', label: 'Pendente' };
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [customAmountId, setCustomAmountId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
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
      .select('id, cliente_nome, cliente_telefone, cliente_email, atendimento_data, items, os_number, order_status, nota_fiscal_url, total, payment_status, paid_amount, payment_method_client')
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
    // Payment filter
    if (filterPayment !== 'all') {
      const paid = c.paid_amount || 0;
      const total = c.total || 0;
      const status = c.payment_status;
      if (filterPayment === 'pago' && status !== 'pago' && !(total > 0 && paid >= total)) return false;
      if (filterPayment === 'parcial' && status !== 'parcial' && !(paid > 0 && paid < total)) return false;
      if (filterPayment === 'pendente' && (status === 'pago' || status === 'parcial' || paid > 0)) return false;
    }
    // Order status filter
    if (filterStatus !== 'all') {
      if ((c.order_status || 'em_producao') !== filterStatus) return false;
    }
    if (!search) return true;
    const s = search.toLowerCase();
    return c.cliente_nome?.toLowerCase().includes(s) || c.cliente_telefone?.includes(s) || c.cliente_email?.toLowerCase().includes(s) || c.os_number?.includes(s);
  });

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

    // Regra: ao confirmar pagamento (mesmo parcial), registrar a venda com valor total da OS no financeiro
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

    // Categoria "Vendas" (se existir)
    const { data: catData } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Vendas')
      .limit(1);
    const vendaCategoryId = catData?.[0]?.id ?? null;

    // Evita duplicidade: uma única entrada por OS
    const { data: existingSaleTx } = await supabase
      .from('transactions')
      .select('id, amount')
      .ilike('description', `%OS #${cliente.os_number}%`)
      .eq('type', 'entrada')
      .limit(1)
      .maybeSingle();

    let txError: any = null;
    if (existingSaleTx?.id) {
      const { error } = await supabase
        .from('transactions')
        .update({
          amount: cliente.total || 0,
          category_id: vendaCategoryId,
          payment_method: method,
        })
        .eq('id', existingSaleTx.id);
      txError = error;
    } else {
      const { error } = await supabase.from('transactions').insert({
        description: vendaDescription,
        amount: cliente.total || 0,
        type: 'entrada',
        category_id: vendaCategoryId,
        transaction_date: new Date().toISOString().split('T')[0],
        user_id: user.id,
        payment_method: method,
      });
      txError = error;
    }

    if (txError) {
      toast.error('Pagamento salvo, mas houve erro ao lançar entrada no financeiro');
    } else {
      setClientes(prev => prev.map(c =>
        c.id === cliente.id
          ? { ...c, payment_status: isPaidFull ? 'pago' : 'parcial', paid_amount: newPaidAmount, payment_method_client: method }
          : c
      ));
      const cardMsg = isCard ? ` | Líquido: ${fmt(netAmount)}` : '';
      toast.success(`${fmt(amount)} registrado${cardMsg}`);
    }

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

  return (
    <div>
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />

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

      {/* Filters row */}
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
          <span className="text-xs text-muted-foreground">{filtered.length} registro(s)</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-800" /> Pago Total</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-300" /> Parcial</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-orange-500" /> Pendente</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="metric-card text-center py-12 text-muted-foreground text-sm">
          {search ? 'Nenhum cliente encontrado' : 'Nenhum registro neste período'}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Documentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const total = c.total || 0;
                const paid = c.paid_amount || 0;
                const remaining = Math.max(0, total - paid);
                const colors = getPaymentColor(c.payment_status, paid, total);

                return (
                  <TableRow key={c.id} className={colors.row}>
                    <TableCell className="font-medium">{c.cliente_nome || '—'}</TableCell>
                    <TableCell>{c.cliente_telefone || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{c.atendimento_data ? new Date(c.atendimento_data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{getProducts(c.items)}</TableCell>
                    <TableCell className="text-xs font-semibold whitespace-nowrap">{fmt(total)}</TableCell>
                    <TableCell>
                      <Select value={c.order_status || 'em_producao'} onValueChange={(v) => handleStatusChange(c.id, v)}>
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="em_producao">Em Produção</SelectItem>
                          <SelectItem value="enviado">Enviado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {c.payment_status === 'pago' ? (
                        <div className="space-y-0.5">
                          <Badge className={`${colors.badge} text-xs gap-1 px-3 py-1`}>
                            <CheckCircle size={12} /> Pago Total
                          </Badge>
                          <div className="text-[10px] text-muted-foreground">{fmt(paid)}</div>
                        </div>
                      ) : (
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
                              {(() => {
                                const method = c.payment_method_client || '';
                                const isCard = method.toLowerCase().includes('cartão') || method.toLowerCase().includes('credito') || method.toLowerCase().includes('crédito');
                                const isPix = method.toLowerCase().includes('pix') || method.toLowerCase().includes('dinheiro');
                                // If already has a payment method, lock to the same one
                                const lockedToCard = paid > 0 && isCard;
                                const lockedToPix = paid > 0 && isPix;
                                // First payment: show both options. Subsequent: only the same method
                                return (
                                  <>
                                    {/* Entrada 30% - only PIX/Dinheiro */}
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
                                  </>
                                );
                              })()}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>
                    {/* Documentos: OS + NF unified */}
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* OS */}
                        {c.os_number && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                            onClick={() => navigate(`/ordem-servico?load=${c.id}`)} title="Baixar OS">
                            <FileText size={14} className="text-primary" />
                            <span className="font-mono">{c.os_number}</span>
                            <Download size={12} />
                          </Button>
                        )}
                        {!c.os_number && <span className="text-xs text-muted-foreground">Sem OS</span>}

                        <span className="text-muted-foreground/30">|</span>

                        {/* NF */}
                        {c.nota_fiscal_url && (
                          <a href={c.nota_fiscal_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                              <Eye size={14} /> NF
                            </Button>
                          </a>
                        )}
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                          onClick={() => triggerFileUpload(c.id)} disabled={uploadingId === c.id}>
                          {uploadingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                          {c.nota_fiscal_url ? 'Trocar NF' : 'Anexar NF'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
