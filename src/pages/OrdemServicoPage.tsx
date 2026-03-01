import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Printer, Save, FileDown, History, ArrowLeft } from 'lucide-react';
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

export default function OrdemServicoPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [view, setView] = useState<'form' | 'history'>('form');
  const [savedOrders, setSavedOrders] = useState<SavedOS[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [currentOsId, setCurrentOsId] = useState<string | null>(null);

  const [osNumber, setOsNumber] = useState('');
  const [empresa, setEmpresa] = useState({ nome: 'Espetos & Cia', cnpj: '', telefone: '', endereco: '', email: '' });
  const [cliente, setCliente] = useState({ nome: '', telefone: '', cpfCnpj: '', contato: '' });
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

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), name: '', quantity: 1, price: 0 }]);
  const removeItem = (id: number) => { if (items.length > 1) setItems(prev => prev.filter(i => i.id !== id)); };
  const updateItem = (id: number, field: keyof ServiceItem, value: string | number) => setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const clearForm = () => {
    setCurrentOsId(null);
    setOsNumber('');
    setCliente({ nome: '', telefone: '', cpfCnpj: '', contato: '' });
    setAtendimento({ vendedor: '', data: new Date().toISOString().split('T')[0], hora: new Date().toTimeString().slice(0, 5) });
    setItems([{ id: 1, name: '', quantity: 1, price: 0 }]);
    setDesconto(0);
    setShowDesconto(false);
    setFormaPagamento('');
    setDescricaoPagamento('');
    setObservacoes('');
  };

  const saveOS = async () => {
    if (!user) { toast.error('Faça login primeiro'); return; }
    if (!cliente.nome) { toast.error('Preencha o nome do cliente'); return; }

    const payload = {
      os_number: osNumber,
      empresa_nome: empresa.nome, empresa_cnpj: empresa.cnpj, empresa_telefone: empresa.telefone, empresa_endereco: empresa.endereco, empresa_email: empresa.email,
      cliente_nome: cliente.nome, cliente_telefone: cliente.telefone, cliente_cpf_cnpj: cliente.cpfCnpj, cliente_contato: cliente.contato,
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
    fetchHistory();
  };

  const loadOS = async (id: string) => {
    const { data } = await supabase.from('service_orders').select('*').eq('id', id).single();
    if (!data) return;
    setCurrentOsId(data.id);
    setOsNumber(data.os_number || '');
    setEmpresa({ nome: data.empresa_nome || '', cnpj: data.empresa_cnpj || '', telefone: data.empresa_telefone || '', endereco: data.empresa_endereco || '', email: data.empresa_email || '' });
    setCliente({ nome: data.cliente_nome || '', telefone: data.cliente_telefone || '', cpfCnpj: data.cliente_cpf_cnpj || '', contato: data.cliente_contato || '' });
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
          #os-print { position: absolute; left: 0; top: 0; width: 100%; }
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
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-lg font-bold">
              Ordem de Serviço nº
              <Input value={osNumber} onChange={e => setOsNumber(e.target.value)} className="w-28 text-center font-bold border-b-2 border-t-0 border-x-0 rounded-none bg-transparent h-8 text-black" placeholder="000" />
            </div>
          </div>

          {/* Header: Logo + Company */}
          <div className="border border-gray-300 rounded-lg p-4 mb-6 flex gap-6">
            <div className="flex-shrink-0 flex items-center justify-center w-40">
              <img src={logoBlack} alt="Logo" className="h-16 object-contain" />
            </div>
            <div className="flex-1 grid grid-cols-1 gap-1.5 text-sm">
              {[
                { label: 'Empresa / CNPJ:', fields: [{ key: 'nome' as const, ph: 'Nome da empresa', cls: 'flex-1' }, { key: 'cnpj' as const, ph: 'CNPJ', cls: 'w-44' }] },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="font-semibold whitespace-nowrap w-32 text-right">{r.label}</span>
                  {r.fields.map(f => <Input key={f.key} value={empresa[f.key]} onChange={e => setEmpresa(p => ({ ...p, [f.key]: e.target.value }))} className={`${f.cls} h-7 text-sm border-gray-300 bg-transparent text-black`} placeholder={f.ph} />)}
                </div>
              ))}
              {(['telefone', 'endereco', 'email'] as const).map(k => (
                <div key={k} className="flex items-center gap-2">
                  <span className="font-semibold whitespace-nowrap w-32 text-right capitalize">{k === 'endereco' ? 'Endereço' : k === 'email' ? 'E-mail' : 'Telefone'}:</span>
                  <Input value={empresa[k]} onChange={e => setEmpresa(p => ({ ...p, [k]: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                </div>
              ))}
            </div>
          </div>

          {/* Client + Atendimento */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border border-gray-300 rounded-lg p-4">
              <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">Informações do Cliente</h3>
              <div className="space-y-2 text-sm">
                {([['nome', 'Nome'], ['telefone', 'Telefone'], ['cpfCnpj', 'CPF/CNPJ'], ['contato', 'Contato']] as const).map(([k, l]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="font-semibold w-24 text-right">{l}:</span>
                    <Input value={cliente[k]} onChange={e => setCliente(p => ({ ...p, [k]: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-gray-300 rounded-lg p-4">
              <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">Dados do Atendimento</h3>
              <div className="space-y-2 text-sm">
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
          <div className="border border-gray-300 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">Produtos e Serviços</h3>
            <table className="w-full text-sm">
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
            <div className="mt-4 border-t border-gray-200 pt-3 space-y-1.5 text-sm">
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
              <div className="flex justify-end items-center gap-4 text-base font-bold border-t border-gray-300 pt-2">
                <span>Total OS:</span>
                <span className="w-32 text-right">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="border border-gray-300 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">Forma de Pagamento</h3>
            <div className="flex gap-4 text-sm">
              <div className="flex-1"><Input value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="h-8 text-sm border-gray-300 bg-transparent text-black" placeholder="Ex: PIX, Cartão, Boleto..." /></div>
              <div className="flex-1"><Input value={descricaoPagamento} onChange={e => setDescricaoPagamento(e.target.value)} className="h-8 text-sm border-gray-300 bg-transparent text-black" placeholder="Descrição / Parcelas" /></div>
            </div>
          </div>

          {/* Observations */}
          <div className="border border-gray-300 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">Observações</h3>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} className="min-h-[80px] text-sm border-gray-300 bg-transparent text-black resize-y" placeholder="Observações adicionais..." />
          </div>

          {/* Authorization */}
          <div className="mb-8">
            <p className="text-sm font-medium text-center bg-gray-100 border border-gray-300 rounded px-4 py-2">
              Autorizo e concordo com a realização dos serviços listados conforme o combinado.
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-16 mt-12 mb-4">
            <div className="text-center"><div className="border-t border-black pt-2 mx-8"><span className="text-sm font-medium">Responsável pelo atendimento</span></div></div>
            <div className="text-center"><div className="border-t border-black pt-2 mx-8"><span className="text-sm font-medium">Cliente</span></div></div>
          </div>
        </div>
      </div>
    </>
  );
}
