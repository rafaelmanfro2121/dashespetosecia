import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  os_tecnica_data?: any;
}

// MOVED OUTSIDE component to prevent re-mount on state changes
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

// MOVED OUTSIDE component — stronger border for B&W print
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="os-section border-2 border-foreground/40 rounded-lg p-3 mb-3">
      <h3 className="text-xs font-bold uppercase text-foreground mb-2 border-b-2 border-foreground/30 pb-1">{title}</h3>
      {children}
    </div>
  );
}

function toggleOne(options: CheckOption[], idx: number): CheckOption[] {
  return options.map((o, i) => ({ ...o, checked: i === idx ? !o.checked : false }));
}
function toggleMulti(options: CheckOption[], idx: number): CheckOption[] {
  return options.map((o, i) => ({ ...o, checked: i === idx ? !o.checked : o.checked }));
}

function detectEspetosFromItems(items: any[]): string {
  for (const item of items) {
    const name = (item.name || '').toUpperCase();
    const match = name.match(/(\d+)\s*ESPETO/);
    if (match) return match[1];
  }
  return '';
}

/** Auto-detect model, cabo, posição da grelha from item names */
function detectFromItems(items: any[]) {
  let detectedModelo = { legacy: false, imperial: false, faze: false, imperialGManual: false };
  let hasGA = false;
  let hasGL = false;
  let hasChurrasqueira = false;

  for (const item of items) {
    const name = (item.name || '').toUpperCase();

    if (name.includes('IMPERIAL')) detectedModelo.imperial = true;
    if (name.includes('LEGACY')) detectedModelo.legacy = true;
    if (name.includes('FAZE')) detectedModelo.faze = true;
    if (name.includes('GMANUAL') || name.includes('G MANUAL') || name.includes('G/MANUAL')) {
      detectedModelo.imperialGManual = true;
    }
    // GA = Grelha Embutida, GL = Grelha Lateral Dupla
    if (/\bGA\b/.test(name) || name.includes('GRELHA ACOPLADA')) hasGA = true;
    if (/\bGL\b/.test(name) || name.includes('GRELHA LATERAL')) hasGL = true;
    if (name.includes('CHURRASQUEIRA')) hasChurrasqueira = true;
  }

  // Determine cabo: Imperial → INOX, Faze/Legacy → ALUMÍNIO TÉRMICO
  let caboInox = false;
  let caboAluminio = false;
  if (detectedModelo.imperial || detectedModelo.imperialGManual) caboInox = true;
  if (detectedModelo.legacy || detectedModelo.faze) caboAluminio = true;

  return { detectedModelo, hasGA, hasGL, hasChurrasqueira, caboInox, caboAluminio };
}

export default function OrdemServicoTecnicaPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

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
  const [modeloEspetos, setModeloEspetos] = useState('');
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

  useEffect(() => {
    const fetchPedidos = async () => {
      const { data } = await supabase
        .from('service_orders')
        .select('id, os_number, cliente_nome, atendimento_data, items, total, os_tecnica_salva, os_tecnica_data')
        .order('created_at', { ascending: false });
      if (data) setPedidos(data as any as PedidoOS[]);
    };
    fetchPedidos();
  }, []);

  const restoreOsData = useCallback((data: any) => {
    if (!data) return;
    if (data.material) setMaterial(data.material);
    if (data.churrasqueira) setChurrasqueira(data.churrasqueira);
    if (data.qtdEspetos !== undefined) setQtdEspetos(data.qtdEspetos);
    if (data.modeloEspetos !== undefined) setModeloEspetos(data.modeloEspetos);
    if (data.modelo) setModelo(data.modelo);
    if (data.cabos) setCabos(data.cabos);
    if (data.voltagem) setVoltagem(data.voltagem);
    if (data.extras) setExtras(data.extras);
    if (data.fechamento) setFechamento(data.fechamento);
    if (data.grelhaClassic) setGrelhaClassic(data.grelhaClassic);
    if (data.grelhaLado) setGrelhaLado(data.grelhaLado);
    if (data.modeloGrelha) setModeloGrelha(data.modeloGrelha);
    
    if (data.obs !== undefined) setObs(data.obs);
    if (data.medidaLargura !== undefined) setMedidaLargura(data.medidaLargura);
    if (data.medidaAltura !== undefined) setMedidaAltura(data.medidaAltura);
    if (data.medidaFosso !== undefined) setMedidaFosso(data.medidaFosso);
  }, []);

  const selectPedido = (pedido: PedidoOS) => {
    setSelectedPedido(pedido);
    setOsNumber(pedido.os_number);
    setDataPedido(pedido.atendimento_data);
    setClienteNome(pedido.cliente_nome);

    const items = pedido.items || [];
    const prodText = items.map((it: any) => `${it.quantity || 1}x ${it.name}`).join('\n');
    setProdutosTexto(prodText);

    // If OS was previously saved, restore all data
    if (pedido.os_tecnica_salva && pedido.os_tecnica_data) {
      restoreOsData(pedido.os_tecnica_data);
    } else {
      // Auto-detect from items
      const { detectedModelo, hasGA, hasGL, hasChurrasqueira, caboInox, caboAluminio } = detectFromItems(items);

      setChurrasqueira([
        { label: 'SIM', checked: hasChurrasqueira },
        { label: 'NÃO', checked: !hasChurrasqueira },
      ]);

      const espetos = detectEspetosFromItems(items);
      setQtdEspetos(espetos);
      setModeloEspetos('');

      // Auto-fill modelo
      setModelo([
        { label: 'LEGACY', checked: detectedModelo.legacy },
        { label: 'IMPERIAL', checked: detectedModelo.imperial },
        { label: 'FAZE', checked: detectedModelo.faze },
        { label: 'IMPERIAL/GMANUAL', checked: detectedModelo.imperialGManual },
      ]);

      // Auto-fill cabos based on model
      setCabos([
        { label: 'INOX', checked: caboInox },
        { label: 'ALUMÍNIO TÉRMICO', checked: caboAluminio },
        { label: 'MADEIRA', checked: false },
      ]);

      // Auto-fill posição da grelha: GA → Embutida, GL → Lateral Dupla
      setGrelhaClassic([
        { label: 'GRELHA EMBUTIDA', checked: hasGA },
        { label: 'GRELHA LATERAL SIMPLES', checked: false },
        { label: 'GRELHA LATERAL DUPLA', checked: hasGL },
      ]);

      // Reset remaining fields
      setMaterial(m => m.map(o => ({ ...o, checked: false })));
      setVoltagem(v => v.map(o => ({ ...o, checked: false })));
      setExtras(e => e.map(o => ({ ...o, checked: false })));
      setFechamento(f => f.map(o => ({ ...o, checked: false })));
      setGrelhaLado(g => g.map(o => ({ ...o, checked: false })));
      setModeloGrelha(g => g.map(o => ({ ...o, checked: false })));
      setObs('');
      setMedidaLargura('');
      setMedidaAltura('');
      setMedidaFosso('');
    }

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
    setModeloEspetos('');
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

  const getOsTecnicaData = () => ({
    material, churrasqueira, qtdEspetos, modeloEspetos, modelo, cabos, voltagem, extras,
    fechamento, grelhaClassic, grelhaLado, modeloGrelha, obs,
    medidaLargura, medidaAltura, medidaFosso,
  });

  const generatePDF = async () => {
    if (!printRef.current) return;
    setLoadingPdf(true);
    try {
      const noPrintEls = printRef.current.querySelectorAll('.no-print');
      noPrintEls.forEach(el => (el as HTMLElement).style.display = 'none');

      // Replace textareas with divs for PDF
      const textareas = printRef.current.querySelectorAll('textarea');
      const replacements: { ta: HTMLTextAreaElement; div: HTMLDivElement }[] = [];
      textareas.forEach(ta => {
        const div = document.createElement('div');
        div.style.cssText = 'white-space: pre-wrap; font-size: 10px; padding: 4px 6px; min-height: 20px; width: 100%;';
        div.textContent = ta.value;
        ta.parentNode?.insertBefore(div, ta);
        ta.style.display = 'none';
        replacements.push({ ta, div });
      });

      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      
      // Restore textareas
      replacements.forEach(({ ta, div }) => {
        div.remove();
        ta.style.display = '';
      });
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
    const osData = getOsTecnicaData();
    const { error } = await supabase
      .from('service_orders')
      .update({ os_tecnica_salva: true, os_tecnica_data: osData } as any)
      .eq('id', selectedPedido.id);
    if (error) { toast.error('Erro ao salvar'); return; }
    setPedidos(prev => prev.map(p => p.id === selectedPedido.id ? { ...p, os_tecnica_salva: true, os_tecnica_data: osData } : p));
    setSelectedPedido({ ...selectedPedido, os_tecnica_salva: true, os_tecnica_data: osData });
    toast.success('OS Técnica salva com sucesso!');
  };

  const filteredPedidos = pedidos.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.os_number.toLowerCase().includes(term) || p.cliente_nome.toLowerCase().includes(term);
  });

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
          @page { size: A4; margin: 5mm; }
          html, body { margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          #os-tecnica-print, #os-tecnica-print * { visibility: visible; }
          #os-tecnica-print { 
            position: absolute; left: 0; top: 0; width: 100%; 
            padding: 3mm !important; margin: 0 !important;
            font-size: 8px !important; 
            box-sizing: border-box;
          }
          #os-tecnica-print h1 { font-size: 12px !important; }
          #os-tecnica-print h3 { font-size: 8px !important; margin-bottom: 1px !important; padding-bottom: 1px !important; }
          #os-tecnica-print .os-section { border: 2px solid #333 !important; margin-bottom: 3px !important; padding: 3px 5px !important; }
          #os-tecnica-print .os-section h3 { border-bottom: 2px solid #555 !important; }
          #os-tecnica-print .spec-box { border: 1.5px solid #555 !important; padding: 3px 5px !important; }
          #os-tecnica-print .rounded-lg { border-radius: 3px !important; }
          #os-tecnica-print .mb-3 { margin-bottom: 3px !important; }
          #os-tecnica-print .mb-2 { margin-bottom: 2px !important; }
          #os-tecnica-print .gap-2 { gap: 3px !important; }
          #os-tecnica-print input { height: 20px !important; font-size: 12px !important; font-weight: 700 !important; padding: 0 3px !important; text-align: center !important; }
          #os-tecnica-print textarea { display: none !important; }
          #os-tecnica-print .print-obs-mirror { display: block !important; white-space: pre-wrap !important; font-size: 9px !important; padding: 3px 5px !important; overflow: visible !important; }
          #os-tecnica-print img { height: 28px !important; }
          #os-tecnica-print .gap-x-4 { gap: 4px !important; }
          #os-tecnica-print .gap-y-1 { gap: 0px !important; }
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
          <div className="flex items-center justify-between mb-3 border-b-2 border-black pb-2">
            <img src={logoBlack} alt="Logo" className="h-10 object-contain" />
            <div className="text-center flex-1">
              <h1 className="text-base font-bold tracking-wide">ORDEM DE SERVIÇO TÉCNICA</h1>
            </div>
            <div className="text-right space-y-0.5">
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

          <Section title="Dados do Cliente">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold whitespace-nowrap">NOME DO CLIENTE:</span>
              <span className="text-xs font-medium">{clienteNome}</span>
            </div>
          </Section>

          <Section title="Produtos do Pedido">
            <p className="text-xs whitespace-pre-line">{produtosTexto}</p>
          </Section>

          <Section title="Especificações Técnicas">
            <div className="grid grid-cols-2 gap-2">
              {/* Material */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Material</span>
                <CheckboxGroup options={material} onChange={i => setMaterial(prev => toggleMulti(prev, i))} columns={2} />
              </div>

              {/* Churrasqueira + Espetos */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Churrasqueira</span>
                <div className="flex items-center gap-3">
                  <CheckboxGroup options={churrasqueira} onChange={i => setChurrasqueira(prev => toggleMulti(prev, i))} columns={2} />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold whitespace-nowrap">QTD:</span>
                    <Input value={qtdEspetos} onChange={e => setQtdEspetos(e.target.value)} className="w-14 h-7 text-sm font-bold text-center border-foreground/30" />
                  </div>
                </div>
              </div>

              {/* Modelo */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30 col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Modelo</span>
                <CheckboxGroup options={modelo} onChange={i => setModelo(prev => toggleMulti(prev, i))} columns={4} />
              </div>

              {/* Modelo dos Espetos */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30 col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Modelo dos Espetos</span>
                <Input
                  value={modeloEspetos}
                  onChange={e => setModeloEspetos(e.target.value)}
                  placeholder="Descreva o modelo dos espetos..."
                  className="h-7 text-xs border-foreground/30"
                />
              </div>

              {/* Cabos */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Cabos</span>
                <CheckboxGroup options={cabos} onChange={i => setCabos(prev => toggleMulti(prev, i))} columns={1} />
              </div>

              {/* Voltagem / Extras */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Voltagem / Extras</span>
                <div className="flex items-start gap-4">
                  <CheckboxGroup options={voltagem} onChange={i => setVoltagem(prev => toggleMulti(prev, i))} columns={1} />
                  <CheckboxGroup options={extras} onChange={i => setExtras(prev => toggleMulti(prev, i))} columns={1} />
                </div>
              </div>

              {/* Fechamento */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Fechamento Lateral</span>
                <CheckboxGroup options={fechamento} onChange={i => setFechamento(prev => toggleMulti(prev, i))} columns={3} />
              </div>

              {/* Grelha Acoplada (GA) */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Grelha Acoplada (GA)</span>
                <CheckboxGroup options={grelhaAcoplada} onChange={i => setGrelhaAcoplada(prev => toggleMulti(prev, i))} columns={2} />
              </div>

              {/* Modelo da Grelha */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30 col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Modelo da Grelha</span>
                <CheckboxGroup options={modeloGrelha} onChange={i => setModeloGrelha(prev => toggleMulti(prev, i))} columns={3} />
              </div>

              {/* Modelo e Posição da Grelha */}
              <div className="spec-box rounded-md p-2 border-2 border-foreground/30 col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider block mb-1">Posição da Grelha</span>
                <div className="flex items-start gap-6">
                  <CheckboxGroup options={grelhaClassic} onChange={i => setGrelhaClassic(prev => toggleMulti(prev, i))} columns={3} />
                  <CheckboxGroup options={grelhaLado} onChange={i => setGrelhaLado(prev => toggleMulti(prev, i))} columns={2} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Observações">
            <Textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                }
              }}
              placeholder="Observações gerais... (Enter para novo parágrafo)"
              className="print-textarea text-xs border-foreground/30 min-h-[60px] resize-y"
              style={{ whiteSpace: 'pre-wrap' }}
            />
            <div
              className="print-obs-mirror hidden text-xs border-2 border-foreground/30 rounded-md bg-white"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {obs || ' '}
            </div>
          </Section>

          <Section title="Medidas do Vão">
            <div className="flex gap-4">
              <div className="border-2 border-foreground/40 rounded-md p-2 flex-1 relative" style={{ minHeight: 140 }}>
                <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] text-foreground/60 font-medium">
                  ESPAÇO PARA ENGRENAGEM
                </div>
                <div className="border-2 border-dashed border-foreground/30 rounded mt-4 mx-3 flex items-center justify-center" style={{ height: 60 }}>
                  <span className="text-[9px] text-foreground/60">FOSSO / TUBO</span>
                </div>
                <div className="flex items-center gap-1 mx-3 mt-1">
                  <span className="text-foreground/50 text-[9px]">◄</span>
                  <div className="flex-1 border-t border-foreground/40" />
                  <span className="text-[8px] text-foreground/60 font-medium">LARGURA</span>
                  <div className="flex-1 border-t border-foreground/40" />
                  <span className="text-foreground/50 text-[9px]">►</span>
                </div>
              </div>
              <div className="space-y-2 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-24">LARGURA:</span>
                  <Input value={medidaLargura} onChange={e => setMedidaLargura(e.target.value)} placeholder="cm" className="h-8 text-sm font-bold text-center border-foreground/30 w-20" />
                  <span className="text-xs font-medium text-foreground/60">cm</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-24">ALTURA:</span>
                  <Input value={medidaAltura} onChange={e => setMedidaAltura(e.target.value)} placeholder="cm" className="h-8 text-sm font-bold text-center border-foreground/30 w-20" />
                  <span className="text-xs font-medium text-foreground/60">cm</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-24">FOSSO / TUBO:</span>
                  <Input value={medidaFosso} onChange={e => setMedidaFosso(e.target.value)} placeholder="cm" className="h-8 text-sm font-bold text-center border-foreground/30 w-20" />
                  <span className="text-xs font-medium text-foreground/60">cm</span>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
