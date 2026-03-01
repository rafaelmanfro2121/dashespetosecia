import React, { useState, useRef } from 'react';
import { Plus, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import logoBlack from '@/assets/logo-black.png';

interface ServiceItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export default function OrdemServicoPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [osNumber, setOsNumber] = useState('');

  // Empresa
  const [empresa, setEmpresa] = useState({
    nome: 'Espetos & Cia',
    cnpj: '',
    telefone: '',
    endereco: '',
    email: '',
  });

  // Cliente
  const [cliente, setCliente] = useState({
    nome: '',
    telefone: '',
    cpfCnpj: '',
    contato: '',
  });

  // Atendimento
  const [atendimento, setAtendimento] = useState({
    vendedor: '',
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
  });

  // Produtos
  const [items, setItems] = useState<ServiceItem[]>([
    { id: 1, name: '', quantity: 1, price: 0 },
  ]);
  const [desconto, setDesconto] = useState(0);
  const [showDesconto, setShowDesconto] = useState(false);

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState('');
  const [descricaoPagamento, setDescricaoPagamento] = useState('');

  // Observações
  const [observacoes, setObservacoes] = useState('');

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now(), name: '', quantity: 1, price: 0 }]);
  };

  const removeItem = (id: number) => {
    if (items.length > 1) setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: number, field: keyof ServiceItem, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const total = Math.max(0, subtotal - desconto);

  const handlePrint = () => {
    window.print();
  };

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #os-print, #os-print * { visibility: visible; }
          #os-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        {/* Top bar - no print */}
        <div className="no-print bg-muted/30 border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-bold text-foreground">Ordem de Serviço</h1>
          <Button onClick={handlePrint} className="gap-2">
            <Printer size={16} /> Imprimir
          </Button>
        </div>

        <div id="os-print" ref={printRef} className="max-w-4xl mx-auto p-8 bg-white text-black">
          {/* OS Number */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-lg font-bold">
              Ordem de Serviço nº
              <Input
                value={osNumber}
                onChange={e => setOsNumber(e.target.value)}
                className="w-28 text-center font-bold border-b-2 border-t-0 border-x-0 rounded-none bg-transparent h-8 text-black"
                placeholder="000"
              />
            </div>
          </div>

          {/* Header: Logo + Company Info */}
          <div className="border border-gray-300 rounded-lg p-4 mb-6 flex gap-6">
            <div className="flex-shrink-0 flex items-center justify-center w-40">
              <img src={logoBlack} alt="Logo" className="h-16 object-contain" />
            </div>
            <div className="flex-1 grid grid-cols-1 gap-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold whitespace-nowrap w-32 text-right">Empresa / CNPJ:</span>
                <Input
                  value={empresa.nome}
                  onChange={e => setEmpresa(p => ({ ...p, nome: e.target.value }))}
                  className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black"
                  placeholder="Nome da empresa"
                />
                <Input
                  value={empresa.cnpj}
                  onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))}
                  className="w-44 h-7 text-sm border-gray-300 bg-transparent text-black"
                  placeholder="CNPJ"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold whitespace-nowrap w-32 text-right">Telefone:</span>
                <Input
                  value={empresa.telefone}
                  onChange={e => setEmpresa(p => ({ ...p, telefone: e.target.value }))}
                  className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black"
                  placeholder="Telefone"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold whitespace-nowrap w-32 text-right">Endereço:</span>
                <Input
                  value={empresa.endereco}
                  onChange={e => setEmpresa(p => ({ ...p, endereco: e.target.value }))}
                  className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black"
                  placeholder="Endereço"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold whitespace-nowrap w-32 text-right">E-mail:</span>
                <Input
                  value={empresa.email}
                  onChange={e => setEmpresa(p => ({ ...p, email: e.target.value }))}
                  className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black"
                  placeholder="E-mail"
                />
              </div>
            </div>
          </div>

          {/* Client + Service Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Client */}
            <div className="border border-gray-300 rounded-lg p-4">
              <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">
                Informações do Cliente
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Nome:</span>
                  <Input value={cliente.nome} onChange={e => setCliente(p => ({ ...p, nome: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Telefone:</span>
                  <Input value={cliente.telefone} onChange={e => setCliente(p => ({ ...p, telefone: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">CPF/CNPJ:</span>
                  <Input value={cliente.cpfCnpj} onChange={e => setCliente(p => ({ ...p, cpfCnpj: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Contato:</span>
                  <Input value={cliente.contato} onChange={e => setCliente(p => ({ ...p, contato: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                </div>
              </div>
            </div>

            {/* Atendimento */}
            <div className="border border-gray-300 rounded-lg p-4">
              <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">
                Dados do Atendimento
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Vendedor:</span>
                  <Input value={atendimento.vendedor} onChange={e => setAtendimento(p => ({ ...p, vendedor: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Data:</span>
                  <Input type="date" value={atendimento.data} onChange={e => setAtendimento(p => ({ ...p, data: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs no-print" onClick={() => setAtendimento(p => ({ ...p, data: new Date().toISOString().split('T')[0] }))}>
                    Hoje
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold w-24 text-right">Hora:</span>
                  <Input type="time" value={atendimento.hora} onChange={e => setAtendimento(p => ({ ...p, hora: e.target.value }))} className="flex-1 h-7 text-sm border-gray-300 bg-transparent text-black" />
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs no-print" onClick={() => setAtendimento(p => ({ ...p, hora: new Date().toTimeString().slice(0, 5) }))}>
                    Agora
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Products & Services */}
          <div className="border border-gray-300 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">
              Produtos e Serviços
            </h3>
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
                    <td className="py-1.5">
                      <Input
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                        className="h-7 text-sm border-gray-300 bg-transparent text-black"
                        placeholder="Nome do produto/serviço"
                      />
                    </td>
                    <td className="py-1.5">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                        className="h-7 text-sm text-center border-gray-300 bg-transparent text-black"
                      />
                    </td>
                    <td className="py-1.5">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.price || ''}
                        onChange={e => updateItem(item.id, 'price', Number(e.target.value))}
                        className="h-7 text-sm text-center border-gray-300 bg-transparent text-black"
                        placeholder="0,00"
                      />
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {fmt(item.quantity * item.price)}
                    </td>
                    <td className="py-1.5 text-center no-print">
                      <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="no-print mt-2">
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
                <Plus size={14} /> Adicionar Item
              </Button>
            </div>

            {/* Totals */}
            <div className="mt-4 border-t border-gray-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-end items-center gap-4">
                <span className="font-semibold">Subtotal:</span>
                <span className="w-32 text-right font-medium">{fmt(subtotal)}</span>
              </div>

              {showDesconto ? (
                <div className="flex justify-end items-center gap-4">
                  <span className="font-semibold">Desconto:</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={desconto || ''}
                    onChange={e => setDesconto(Number(e.target.value))}
                    className="w-32 h-7 text-sm text-right border-gray-300 bg-transparent text-black"
                    placeholder="0,00"
                  />
                  <button onClick={() => { setShowDesconto(false); setDesconto(0); }} className="text-red-500 no-print">
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex justify-end no-print">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowDesconto(true)} className="gap-1 text-xs">
                    <Plus size={14} /> Adicionar Desconto
                  </Button>
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
            <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">
              Forma de Pagamento
            </h3>
            <div className="flex gap-4 text-sm">
              <div className="flex-1">
                <Input
                  value={formaPagamento}
                  onChange={e => setFormaPagamento(e.target.value)}
                  className="h-8 text-sm border-gray-300 bg-transparent text-black"
                  placeholder="Ex: PIX, Cartão, Boleto..."
                />
              </div>
              <div className="flex-1">
                <Input
                  value={descricaoPagamento}
                  onChange={e => setDescricaoPagamento(e.target.value)}
                  className="h-8 text-sm border-gray-300 bg-transparent text-black"
                  placeholder="Descrição / Parcelas"
                />
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="border border-gray-300 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-sm mb-3 text-center border-b border-gray-200 pb-2">
              Observações
            </h3>
            <Textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="min-h-[80px] text-sm border-gray-300 bg-transparent text-black resize-y"
              placeholder="Observações adicionais..."
            />
          </div>

          {/* Authorization */}
          <div className="mb-8">
            <p className="text-sm font-medium text-center bg-gray-100 border border-gray-300 rounded px-4 py-2">
              Autorizo e concordo com a realização dos serviços listados conforme o combinado.
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-16 mt-12 mb-4">
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-8">
                <span className="text-sm font-medium">Responsável pelo atendimento</span>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-2 mx-8">
                <span className="text-sm font-medium">Cliente</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
