import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Printer, Save, FileDown, History, ArrowLeft, Lock, Unlock } from 'lucide-react';
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

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const total = Math.max(0, subtotal - desconto);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase.from('service_orders').select('id, os_number, cliente_nome, total, created_at').order('created_at', { ascending: false });
    if (data) setSavedOrders(data as SavedOS[]);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

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

  const clearForm = () => {
    setCurrentOsId(null);
    // Auto-set next OS number
    const next = getNextOsNumber(savedOrders);
    setOsNumber(next);
    setCliente({ nome: '', telefone: '', cpfCnpj: '', contato: '', email: '' });
    setAtendimento({ vendedor: '', data: new Date().toISOString().split('T')[0], hora: new Date().toTimeString().slice(0, 5) });
    setItems([{ id: 1, name: '', quantity: 1, price: 0 }]);
    setDesconto(0);
    setShowDesconto(false);
    setFormaPagamento('');
    setDescricaoPagamento('');
    setObservacoes('');
    // Keep empresa data from localStorage
    setEmpresa(loadEmpresaFromStorage());
  };

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
      toast.success('OS salva');
    }
    await fetchHistory();

    // After saving a new OS, auto-advance to next number and clear form
    if (!currentOsId) {
      // Refetch to get updated list, then clear
      const { data } = await supabase.from('service_orders').select('id, os_number, cliente_nome, total, created_at').order('created_at', { ascending: false });
      if (data) {
        setSavedOrders(data as SavedOS[]);
        const next = getNextOsNumber(data as SavedOS[]);
        setOsNumber(next);
      }
      setCurrentOsId(null);
      setCliente({ nome: '', telefone: '', cpfCnpj: '', contato: '', email: '' });
      setAtendimento({ vendedor: '', data: new Date().toISOString().split('T')[0], hora: new Date().toTimeString().slice(0, 5) });
      setItems([{ id: 1, name: '', quantity: 1, price: 0 }]);
      setDesconto(0);
      setShowDesconto(false);
      setFormaPagamento('');
      setDescricaoPagamento('');
      setObservacoes('');
    }
  };

  const loadOS = async (id: string) => {
    const { data } = await supabase.from('service_orders').select('*').eq('id', id).single();
    if (!data) return;
    setCurrentOsId(data.id);
    setOsNumber(data.os_number || '');
    // Don't overwrite empresa from loaded OS — keep the locked empresa data
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

  const generatePDF = async () => {
    if (!printRef.current) return;
    setLoadingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
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

  // History view
  if (view === 'history') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setView('form')} className="gap-1"><ArrowLeft size={14} /> Voltar</Button>
            <h1 className="text-lg font-bold text-foreground">Histórico de Ordens de Serviço</h1>
          </div>
          <Button onClick={() => { clearForm(); setView('form'); }} className="gap-1"><Plus size={14} /> Nova OS</Button>
        </div>
        {savedOrders.length === 0 ? (
          <div className="metric-card text-center py-12 text-muted-foreground">Nenhuma OS salva ainda</div>
        ) : (
          <div className="space-y-2">
            {savedOrders.map(os => (
              <div key={os.id} className="metric-card flex items-center justify-between">
                <div className="cursor-pointer flex-1" onClick={() => loadOS(os.id)}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">OS #{os.os_number || '—'}</span>
                    <span className="font-semibold text-sm">{os.cliente_nome || 'Sem cliente'}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{new Date(os.created_at).toLocaleDateString('pt-BR')}</span>
                    <span className="font-mono font-medium text-foreground">{fmt(Number(os.total))}</span>
                  </div>
                </div>
                <button onClick={() => deleteOS(os.id)} className="text-muted-foreground hover:text-destructive p-2"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #os-print, #os-print * { visibility: visible; }
          #os-print { position: absolute; left: 0; top: 0; width: 100%; padding: 8mm !important; font-size: 11px !important; }
          #os-print .print-compact { margin-bottom: 6px !important; padding: 6px !important; }
          #os-print .print-compact h3 { margin-bottom: 4px !important; padding-bottom: 4px !important; font-size: 11px !important; }
          #os-print input, #os-print textarea { height: 20px !important; font-size: 11px !important; padding: 1px 4px !important; }
          #os-print textarea { min-height: 30px !important; height: auto !important; overflow: visible !important; }
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
            <Button variant="outline" size="sm" onClick={() => setView('history')} className="gap-1"><History size={14} /> Histórico</Button>
            <Button variant="outline" size="sm" onClick={clearForm} className="gap-1"><Plus size={14} /> Nova</Button>
            <Button variant="outline" size="sm" onClick={saveOS} className="gap-1"><Save size={14} /> Salvar</Button>
            <Button variant="outline" size="sm" onClick={generatePDF} disabled={loadingPdf} className="gap-1">
              <FileDown size={14} /> {loadingPdf ? 'Gerando...' : 'PDF'}
            </Button>
            <Button size="sm" onClick={() => window.print()} className="gap-1"><Printer size={14} /> Imprimir</Button>
          </div>
        </div>

        <div id="os-print" ref={printRef} className="max-w-4xl mx-auto p-8 bg-white text-black">
          {/* OS Number */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center gap-2 text-base font-bold">
              Ordem de Serviço nº
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
                {([['nome', 'Nome'], ['telefone', 'Telefone'], ['email', 'E-mail'], ['cpfCnpj', 'CPF/CNPJ'], ['contato', 'Endereço']] as const).map(([k, l]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="font-semibold w-24 text-right">{l}:</span>
                    <Input value={cliente[k]} onChange={e => setCliente(p => ({ ...p, [k]: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
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
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-500">{idx + 1}</td>
                    <td className="py-1.5"><Input value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} className="h-7 text-sm border-gray-300 bg-transparent text-black" placeholder="Nome do produto/serviço" /></td>
                    <td className="py-1.5"><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} className="h-7 text-sm text-center border-gray-300 bg-transparent text-black" /></td>
                    <td className="py-1.5"><Input type="number" min={0} step={0.01} value={item.price || ''} onChange={e => updateItem(item.id, 'price', Number(e.target.value))} className="h-7 text-sm text-center border-gray-300 bg-transparent text-black" placeholder="0,00" /></td>
                    <td className="py-1.5 text-right font-medium">{fmt(item.quantity * item.price)}</td>
                    <td className="py-1.5 text-center no-print"><button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
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
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className="min-h-[50px] text-xs border-gray-300 bg-transparent text-black resize-y overflow-visible" placeholder="Observações adicionais..." style={{ overflow: 'visible' }} />
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
