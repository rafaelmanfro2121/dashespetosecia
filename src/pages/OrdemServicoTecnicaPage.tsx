import React, { useState, useRef, useEffect } from 'react';
import { Printer, FileDown, Plus, Search, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoBlack from '@/assets/logo-black.png';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CheckOption {
  label: string;
  checked: boolean;
}

interface PedidoOS {
  id: string;
  os_number: string;
  cliente_nome: string;
  atendimento_data: string;
  items: any[];
  total: number;
  os_tecnica_salva: boolean;
}

function CheckboxGroup({ options, onChange, columns = 4 }: { options: CheckOption[]; onChange: (idx: number) => void; columns?: number }) {
  return (
    <div className={`grid gap-x-4 gap-y-1`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((opt, i) => (
        <label key={i} className="flex items-center gap-2 text-xs cursor-pointer select-none py-0.5">
          <input type="checkbox" checked={opt.checked} onChange={() => onChange(i)} className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-primary" />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function RadioGroup({ options, onChange, columns = 4 }: { options: CheckOption[]; onChange: (idx: number) => void; columns?: number }) {
  return (
    <div className={`grid gap-x-4 gap-y-1`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((opt, i) => (
        <label key={i} className="flex items-center gap-2 text-xs cursor-pointer select-none py-0.5">
          <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${opt.checked ? 'border-primary' : 'border-muted-foreground/40'}`}>
            {opt.checked && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </span>
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function toggleOne(options: CheckOption[], idx: number): CheckOption[] {
  return options.map((o, i) => ({ ...o, checked: i === idx ? !o.checked : false }));
}
function toggleMulti(options: CheckOption[], idx: number): CheckOption[] {
  return options.map((o, i) => ({ ...o, checked: i === idx ? !o.checked : o.checked }));
}

// Detect model from item names
function detectModelFromItems(items: any[]): string | null {
  const allNames = items.map((it: any) => (it.name || '').toUpperCase()).join(' ');
  if (allNames.includes('FAZE')) return 'FAZE';
  if (allNames.includes('LEGACY')) return 'LEGACY';
  if (allNames.includes('IMPERIAL')) return 'IMPERIAL';
  return null;
}

// Detect espetos quantity from item names
function detectEspetosFromItems(items: any[]): string {
  for (const item of items) {
    const name = (item.name || '').toUpperCase();
    const match = name.match(/(\d+)\s*ESPETO/);
    if (match) return match[1];
  }
  return '';
}

export default function OrdemServicoTecnicaPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Pedido selection
  const [pedidos, setPedidos] = useState<PedidoOS[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<PedidoOS | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSelector, setShowSelector] = useState(true);

  const [osNumber, setOsNumber] = useState('');
  const [dataPedido, setDataPedido] = useState(new Date().toISOString().split('T')[0]);
  const [clienteNome, setClienteNome] = useState('');
  const [produtosTexto, setProdutosTexto] = useState('');

  const [material, setMaterial] = useState<CheckOption[]>([
    { label: 'INOX POLIDO', checked: false },
    { label: 'INOX ESCOVADO', checked: false },
  ]);
  const [churrasqueira, setChurrasqueira] = useState<CheckOption[]>([
    { label: 'SIM', checked: false },
    { label: 'NÃO', checked: false },
  ]);
  const [qtdEspetos, setQtdEspetos] = useState('');
  const [modelo, setModelo] = useState<CheckOption[]>([
    { label: 'LEGACY', checked: false },
    { label: 'IMPERIAL', checked: false },
    { label: 'FAZE', checked: false },
    { label: 'IMPERIAL/GMANUAL', checked: false },
  ]);
  const [cabos, setCabos] = useState<CheckOption[]>([
    { label: 'INOX', checked: false },
    { label: 'ALUMÍNIO TÉRMICO', checked: false },
    { label: 'MADEIRA', checked: false },
  ]);
  const [voltagem, setVoltagem] = useState<CheckOption[]>([
    { label: '110 VOLTS', checked: false },
    { label: '220 VOLTS', checked: false },
  ]);
  const [extras, setExtras] = useState<CheckOption[]>([
    { label: 'CONTROLE REMOTO', checked: false },
    { label: 'FONTE CHAVEADA', checked: false },
    { label: 'DIMER EMBUTIDO', checked: false },
  ]);
  const [fechamento, setFechamento] = useState<CheckOption[]>([
    { label: '06 CM', checked: false },
    { label: '12 CM', checked: false },
    { label: '15 CM', checked: false },
  ]);
  const [grelhaClassic, setGrelhaClassic] = useState<CheckOption[]>([
    { label: 'GRELHA EMBUTIDA', checked: false },
    { label: 'GRELHA LATERAL SIMPLES', checked: false },
    { label: 'GRELHA LATERAL DUPLA', checked: false },
  ]);
  const [grelhaLado, setGrelhaLado] = useState<CheckOption[]>([
    { label: 'ESQUERDA', checked: false },
    { label: 'DIREITA', checked: false },
  ]);
  const [modeloGrelha, setModeloGrelha] = useState<CheckOption[]>([
    { label: 'ARGENTINA', checked: false },
    { label: 'URUGUAIA', checked: false },
    { label: 'DESCANSO URUGUAIA', checked: false },
  ]);
  const [obs, setObs] = useState('');
  const [medidaLargura, setMedidaLargura] = useState('');
  const [medidaProfundidade, setMedidaProfundidade] = useState('');
  const [medidaAltura, setMedidaAltura] = useState('');
  const [medidaFosso, setMedidaFosso] = useState('');
  const [obsMedidas, setObsMedidas] = useState('');

  // Fetch pedidos
  useEffect(() => {
    const fetchPedidos = async () => {
      const { data } = await supabase
        .from('service_orders')
        .select('id, os_number, cliente_nome, atendimento_data, items, total, os_tecnica_salva')
        .order('created_at', { ascending: false });
      if (data) setPedidos(data as PedidoOS[]);
    };
    fetchPedidos();
  }, []);

  const selectPedido = (pedido: PedidoOS) => {
    setSelectedPedido(pedido);
    setOsNumber(pedido.os_number);
    setDataPedido(pedido.atendimento_data);
    setClienteNome(pedido.cliente_nome);

    const items = pedido.items || [];
    // Build produtos text
    const prodText = items.map((it: any) => `${it.quantity || 1}x ${it.name}`).join('\n');
    setProdutosTexto(prodText);

    // Auto-detect churrasqueira
    const hasChurrasqueira = items.some((it: any) => (it.name || '').toUpperCase().includes('CHURRASQUEIRA'));
    setChurrasqueira([
      { label: 'SIM', checked: hasChurrasqueira },
      { label: 'NÃO', checked: !hasChurrasqueira },
    ]);

    // Auto-detect espetos
    const espetos = detectEspetosFromItems(items);
    setQtdEspetos(espetos);

    // Auto-detect model line (FAZE/LEGACY/IMPERIAL) - map to CLASSIC/ELEVAÇÃO etc won't match exactly, 
    // but we can try to detect known patterns
    // For now reset modelo and let user pick
    setModelo(m => m.map(o => ({ ...o, checked: false })));

    setShowSelector(false);
    toast.success(`Pedido #${pedido.os_number} carregado`);
  };

  const clearForm = () => {
    setSelectedPedido(null);
    setShowSelector(true);
    setOsNumber('');
    setDataPedido(new Date().toISOString().split('T')[0]);
    setClienteNome('');
    setProdutosTexto('');
    setMaterial(m => m.map(o => ({ ...o, checked: false })));
    setChurrasqueira(c => c.map(o => ({ ...o, checked: false })));
    setQtdEspetos('');
    setModelo(m => m.map(o => ({ ...o, checked: false })));
    setCabos(c => c.map(o => ({ ...o, checked: false })));
    setVoltagem(v => v.map(o => ({ ...o, checked: false })));
    setExtras(e => e.map(o => ({ ...o, checked: false })));
    setFechamento(f => f.map(o => ({ ...o, checked: false })));
    setGrelhaClassic(g => g.map(o => ({ ...o, checked: false })));
    setGrelhaLado(g => g.map(o => ({ ...o, checked: false })));
    setModeloGrelha(g => g.map(o => ({ ...o, checked: false })));
    setObs('');
    setMedidaLargura('');
    setMedidaProfundidade('');
    setMedidaAltura('');
    setMedidaFosso('');
    setObsMedidas('');
  };

  const generatePDF = async () => {
    if (!printRef.current) return;
    setLoadingPdf(true);
    try {
      const noPrintEls = printRef.current.querySelectorAll('.no-print');
      noPrintEls.forEach(el => (el as HTMLElement).style.display = 'none');
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      noPrintEls.forEach(el => (el as HTMLElement).style.display = '');
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`OS_TECNICA_${osNumber || 'sem-numero'}_${clienteNome || 'cliente'}.pdf`);
      toast.success('PDF gerado com sucesso');
    } catch {
      toast.error('Erro ao gerar PDF');
    }
    setLoadingPdf(false);
  };

  const handlePrint = () => window.print();

  const saveOsTecnica = async () => {
    if (!selectedPedido) return;
    const { error } = await supabase
      .from('service_orders')
      .update({ os_tecnica_salva: true } as any)
      .eq('id', selectedPedido.id);
    if (error) { toast.error('Erro ao salvar'); return; }
    // Update local state
    setPedidos(prev => prev.map(p => p.id === selectedPedido.id ? { ...p, os_tecnica_salva: true } : p));
    setSelectedPedido({ ...selectedPedido, os_tecnica_salva: true });
    toast.success('OS Técnica salva com sucesso!');
  };

  const filteredPedidos = pedidos.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.os_number.toLowerCase().includes(term) || p.cliente_nome.toLowerCase().includes(term);
  });

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border border-muted rounded-lg p-3 mb-3">
      <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2 border-b border-muted pb-1">{title}</h3>
      {children}
    </div>
  );

  // Show pedido selector if no pedido selected
  if (showSelector) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-lg font-bold text-foreground mb-4">Selecione o Pedido para gerar a Ordem de Serviço</h1>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº do pedido ou nome do cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {filteredPedidos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum pedido encontrado</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {filteredPedidos.map(p => {
              const items = (p.items || []) as any[];
              const prodNames = items.map((it: any) => it.name).filter(Boolean).join(', ');
              return (
                <div
                  key={p.id}
                  onClick={() => selectPedido(p)}
                  className={`metric-card cursor-pointer hover:border-primary/50 transition-colors ${p.os_tecnica_salva ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {p.os_tecnica_salva ? (
                        <CheckCircle size={16} className="text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-red-500 shrink-0" />
                      )}
                      <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Pedido #{p.os_number}
                      </span>
                      <span className="font-semibold text-sm">{p.cliente_nome}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.os_tecnica_salva ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.os_tecnica_salva ? 'OS Gerada' : 'Pendente'}
                      </span>
                      <span className="font-mono text-sm font-medium">{fmt(Number(p.total))}</span>
                    </div>
                  </div>
                  {prodNames && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{prodNames}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(p.atendimento_data).toLocaleDateString('pt-BR')}
                  </p>
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
        @media print {
          @page { size: A4; margin: 6mm; }
          html, body { margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          #os-tecnica-print, #os-tecnica-print * { visibility: visible; }
          #os-tecnica-print { 
            position: absolute; left: 0; top: 0; width: 100%; 
            padding: 4mm !important; margin: 0 !important;
            font-size: 9px !important; 
            box-sizing: border-box;
          }
          #os-tecnica-print h1 { font-size: 13px !important; }
          #os-tecnica-print h3 { font-size: 8px !important; margin-bottom: 2px !important; padding-bottom: 1px !important; }
          #os-tecnica-print .border { border-width: 1px !important; }
          #os-tecnica-print .rounded-lg { border-radius: 4px !important; }
          #os-tecnica-print .p-3 { padding: 4px 6px !important; }
          #os-tecnica-print .mb-3 { margin-bottom: 4px !important; }
          #os-tecnica-print .mb-4 { margin-bottom: 6px !important; }
          #os-tecnica-print .space-y-3 > * + * { margin-top: 4px !important; }
          #os-tecnica-print .space-y-2 > * + * { margin-top: 3px !important; }
          #os-tecnica-print input { height: 22px !important; font-size: 13px !important; font-weight: 700 !important; padding: 0 4px !important; text-align: center !important; }
          #os-tecnica-print textarea { font-size: 10px !important; padding: 4px 6px !important; min-height: auto !important; height: auto !important; white-space: pre-wrap !important; overflow: visible !important; }
          #os-tecnica-print .print-textarea { overflow: visible !important; height: auto !important; max-height: none !important; }
          #os-tecnica-print img { height: 32px !important; }
          #os-tecnica-print .gap-x-4 { gap: 6px !important; }
          #os-tecnica-print .gap-y-1 { gap: 1px !important; }
          #os-tecnica-print .py-0\\.5 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        <div className="no-print bg-muted/30 border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">
              OS Técnica — Pedido #{osNumber}
            </h1>
            <span className="text-sm text-muted-foreground">• {clienteNome}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearForm} className="gap-1"><Plus size={14} /> Trocar Pedido</Button>
            <Button variant="outline" size="sm" onClick={saveOsTecnica} className="gap-1 text-green-600 border-green-300 hover:bg-green-50"><Save size={14} /> Salvar</Button>
            <Button variant="outline" size="sm" onClick={generatePDF} disabled={loadingPdf} className="gap-1">
              <FileDown size={14} /> {loadingPdf ? 'Gerando...' : 'PDF'}
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1"><Printer size={14} /> Imprimir</Button>
          </div>
        </div>

        <div id="os-tecnica-print" ref={printRef} className="max-w-3xl mx-auto p-6 bg-white text-black">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <img src={logoBlack} alt="Logo" className="h-12 object-contain" />
            <div className="text-center flex-1">
              <h1 className="text-lg font-bold tracking-wide">ORDEM DE SERVIÇO</h1>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold">Nº PEDIDO:</span>
                <span className="font-mono font-bold text-sm">{osNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold whitespace-nowrap">DATA:</span>
                <span className="text-sm">{new Date(dataPedido).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* Dados do Cliente */}
          <Section title="Dados do Cliente">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold whitespace-nowrap">NOME DO CLIENTE:</span>
              <span className="text-xs font-medium">{clienteNome}</span>
            </div>
          </Section>

          {/* Produtos do Pedido */}
          <Section title="Produtos do Pedido">
            <p className="text-xs whitespace-pre-line">{produtosTexto}</p>
          </Section>

          {/* Dados dos Produtos */}
          <Section title="Especificações Técnicas">
            <div className="grid grid-cols-2 gap-2">
              {/* Material */}
              <div className="bg-muted/30 rounded-md p-2.5 border border-muted">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">Material</span>
                <CheckboxGroup options={material} onChange={i => setMaterial(prev => toggleMulti(prev, i))} columns={2} />
              </div>

              {/* Churrasqueira + Espetos */}
              <div className="bg-muted/30 rounded-md p-2.5 border border-muted">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">Churrasqueira</span>
                <div className="flex items-center gap-4">
                  <CheckboxGroup options={churrasqueira} onChange={i => setChurrasqueira(prev => toggleMulti(prev, i))} columns={2} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold whitespace-nowrap">QTD. ESPETOS:</span>
                    <Input value={qtdEspetos} onChange={e => setQtdEspetos(e.target.value)} className="w-20 h-8 text-base font-bold text-center border-muted" />
                  </div>
                </div>
              </div>

              {/* Modelo */}
              <div className="bg-muted/30 rounded-md p-2.5 border border-muted col-span-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">Modelo</span>
                <CheckboxGroup options={modelo} onChange={i => setModelo(prev => toggleMulti(prev, i))} columns={4} />
              </div>

              {/* Cabos */}
              <div className="bg-muted/30 rounded-md p-2.5 border border-muted">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">Cabos</span>
                <CheckboxGroup options={cabos} onChange={i => setCabos(prev => toggleMulti(prev, i))} columns={1} />
              </div>

              {/* Voltagem + Extras */}
              <div className="bg-muted/30 rounded-md p-2.5 border border-muted">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">Voltagem / Extras</span>
                <div className="flex items-start gap-6">
                  <CheckboxGroup options={voltagem} onChange={i => setVoltagem(prev => toggleMulti(prev, i))} columns={1} />
                  <CheckboxGroup options={extras} onChange={i => setExtras(prev => toggleMulti(prev, i))} columns={1} />
                </div>
              </div>

              {/* Fechamento Lateral */}
              <div className="bg-muted/30 rounded-md p-2.5 border border-muted">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">Fechamento Lateral</span>
                <CheckboxGroup options={fechamento} onChange={i => setFechamento(prev => toggleMulti(prev, i))} columns={3} />
              </div>

              {/* Modelo da Grelha */}
              <div className="bg-muted/30 rounded-md p-2.5 border border-muted">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">Modelo da Grelha</span>
                <CheckboxGroup options={modeloGrelha} onChange={i => setModeloGrelha(prev => toggleMulti(prev, i))} columns={3} />
              </div>

              {/* Grelha Classic + Lado */}
              <div className="bg-muted/30 rounded-md p-2.5 border border-muted col-span-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1.5">Modelo e Posição da Grelha</span>
                <div className="flex items-start gap-8">
                  <CheckboxGroup options={grelhaClassic} onChange={i => setGrelhaClassic(prev => toggleMulti(prev, i))} columns={3} />
                  <CheckboxGroup options={grelhaLado} onChange={i => setGrelhaLado(prev => toggleMulti(prev, i))} columns={2} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Observações">
            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações gerais... (Enter para novo parágrafo)" className="print-textarea text-xs border-muted min-h-[80px] resize-y" style={{ whiteSpace: 'pre-wrap' }} />
          </Section>

          <Section title="Desenho - Especificar as Medidas do Vão">

            <div className="flex gap-6">
              <div className="border-2 border-muted-foreground/30 rounded-md p-3 flex-1 relative" style={{ minHeight: 180 }}>
                <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-medium">
                  ESPAÇO PARA ENGRENAGEM
                </div>
                <div className="border-2 border-dashed border-muted-foreground/20 rounded mt-5 mx-4 flex items-center justify-center" style={{ height: 80 }}>
                  <span className="text-[10px] text-muted-foreground">FOSSO / TUBO</span>
                </div>
                <div className="flex items-center gap-1 mx-4 mt-1">
                  <span className="text-muted-foreground text-[10px]">◄</span>
                  <div className="flex-1 border-t border-muted-foreground/40" />
                  <span className="text-[9px] text-muted-foreground font-medium">LARGURA</span>
                  <div className="flex-1 border-t border-muted-foreground/40" />
                  <span className="text-muted-foreground text-[10px]">►</span>
                </div>
              </div>
              <div className="space-y-3 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-24">LARGURA:</span>
                  <Input value={medidaLargura} onChange={e => setMedidaLargura(e.target.value)} placeholder="cm" className="h-9 text-base font-bold text-center border-muted w-24" />
                  <span className="text-sm font-medium text-muted-foreground">cm</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-24">ALTURA:</span>
                  <Input value={medidaAltura} onChange={e => setMedidaAltura(e.target.value)} placeholder="cm" className="h-9 text-base font-bold text-center border-muted w-24" />
                  <span className="text-sm font-medium text-muted-foreground">cm</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-24">FOSSO / TUBO:</span>
                  <Input value={medidaFosso} onChange={e => setMedidaFosso(e.target.value)} placeholder="cm" className="h-9 text-base font-bold text-center border-muted w-24" />
                  <span className="text-sm font-medium text-muted-foreground">cm</span>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
