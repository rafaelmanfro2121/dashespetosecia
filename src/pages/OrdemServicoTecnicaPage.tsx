import React, { useState, useRef, useCallback } from 'react';
import { Printer, FileDown, Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import logoBlack from '@/assets/logo-black.png';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CheckOption {
  label: string;
  checked: boolean;
}

function CheckboxGroup({ options, onChange, columns = 4 }: { options: CheckOption[]; onChange: (idx: number) => void; columns?: number }) {
  return (
    <div className={`grid gap-x-4 gap-y-1`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((opt, i) => (
        <label key={i} className="flex items-center gap-2 text-xs cursor-pointer select-none py-0.5">
          <input
            type="checkbox"
            checked={opt.checked}
            onChange={() => onChange(i)}
            className="w-3.5 h-3.5 rounded border-muted-foreground/40 accent-primary"
          />
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

export default function OrdemServicoTecnicaPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [osNumber, setOsNumber] = useState('');
  const [dataPedido, setDataPedido] = useState(new Date().toISOString().split('T')[0]);
  const [clienteNome, setClienteNome] = useState('');

  // Material
  const [material, setMaterial] = useState<CheckOption[]>([
    { label: 'INOX POLIDO', checked: false },
    { label: 'INOX ESCOVADO', checked: false },
  ]);

  // Churrasqueira
  const [churrasqueira, setChurrasqueira] = useState<CheckOption[]>([
    { label: 'SIM', checked: false },
    { label: 'NÃO', checked: false },
  ]);

  const [qtdEspetos, setQtdEspetos] = useState('');

  // Modelo
  const [modelo, setModelo] = useState<CheckOption[]>([
    { label: 'CLASSIC', checked: false },
    { label: 'ELEVAÇÃO', checked: false },
    { label: 'SEMI SUSPENSA', checked: false },
    { label: 'SUSPENSA S/GRELHA', checked: false },
  ]);

  // Cabos
  const [cabos, setCabos] = useState<CheckOption[]>([
    { label: 'INOX', checked: false },
    { label: 'ALUMÍNIO TÉRMICO', checked: false },
    { label: 'MADEIRA', checked: false },
  ]);

  // Voltagem
  const [voltagem, setVoltagem] = useState<CheckOption[]>([
    { label: '110 VOLTS', checked: false },
    { label: '220 VOLTS', checked: false },
  ]);

  const [extras, setExtras] = useState<CheckOption[]>([
    { label: 'CONTROLE REMOTO', checked: false },
    { label: 'FONTE CHAVEADA', checked: false },
    { label: 'DIMER EMBUTIDO', checked: false },
  ]);

  // Fechamento lateral
  const [fechamento, setFechamento] = useState<CheckOption[]>([
    { label: '06 CM', checked: false },
    { label: '12 CM', checked: false },
    { label: '15 CM', checked: false },
  ]);

  // Grelha modelo classic
  const [grelhaClassic, setGrelhaClassic] = useState<CheckOption[]>([
    { label: 'GRELHA EMBUTIDA', checked: false },
    { label: 'GRELHA LATERAL SIMPLES', checked: false },
    { label: 'GRELHA LATERAL DUPLA', checked: false },
  ]);

  const [grelhaLado, setGrelhaLado] = useState<CheckOption[]>([
    { label: 'ESQUERDA', checked: false },
    { label: 'DIREITA', checked: false },
  ]);

  // Modelo grelha
  const [modeloGrelha, setModeloGrelha] = useState<CheckOption[]>([
    { label: 'ARGENTINA', checked: false },
    { label: 'URUGUAIA', checked: false },
    { label: 'DESCANSO URUGUAIA', checked: false },
  ]);

  const [obs, setObs] = useState('');

  // Medidas do diagrama
  const [medidaLargura, setMedidaLargura] = useState('');
  const [medidaProfundidade, setMedidaProfundidade] = useState('');
  const [medidaAltura, setMedidaAltura] = useState('');
  const [obsMedidas, setObsMedidas] = useState('');

  const clearForm = () => {
    setOsNumber('');
    setDataPedido(new Date().toISOString().split('T')[0]);
    setClienteNome('');
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

  const handlePrint = () => {
    window.print();
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border border-muted rounded-lg p-3 mb-3">
      <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2 border-b border-muted pb-1">{title}</h3>
      {children}
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #os-tecnica-print, #os-tecnica-print * { visibility: visible; }
          #os-tecnica-print { position: absolute; left: 0; top: 0; width: 100%; padding: 8mm !important; font-size: 11px !important; }
          #os-tecnica-print input { height: 20px !important; font-size: 11px !important; padding: 1px 4px !important; }
          #os-tecnica-print textarea { font-size: 11px !important; padding: 1px 4px !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-white">
        <div className="no-print bg-muted/30 border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-bold text-foreground">Ordem de Serviço Técnica</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearForm} className="gap-1"><Plus size={14} /> Nova</Button>
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
                <span className="font-semibold">Nº</span>
                <Input value={osNumber} onChange={e => setOsNumber(e.target.value)} className="w-24 h-7 text-xs text-center font-mono border-muted" />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold whitespace-nowrap">DATA DO PEDIDO:</span>
                <Input type="date" value={dataPedido} onChange={e => setDataPedido(e.target.value)} className="w-32 h-7 text-xs border-muted" />
              </div>
            </div>
          </div>

          {/* Dados do Cliente */}
          <Section title="Dados do Cliente">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold whitespace-nowrap">NOME DO CLIENTE:</span>
              <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} className="h-7 text-xs flex-1 border-muted" />
            </div>
          </Section>

          {/* Dados dos Produtos */}
          <Section title="Dados dos Produtos">
            <div className="space-y-3">
              {/* Material */}
              <div>
                <span className="text-xs font-semibold block mb-1">MATERIAL:</span>
                <RadioGroup options={material} onChange={i => setMaterial(prev => toggleOne(prev, i))} columns={2} />
              </div>

              {/* Churrasqueira */}
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs font-semibold block mb-1">CHURRASQUEIRA:</span>
                  <RadioGroup options={churrasqueira} onChange={i => setChurrasqueira(prev => toggleOne(prev, i))} columns={2} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold whitespace-nowrap">QTD. ESPETOS:</span>
                  <Input value={qtdEspetos} onChange={e => setQtdEspetos(e.target.value)} className="w-20 h-7 text-xs border-muted" />
                </div>
              </div>

              {/* Modelo */}
              <div>
                <span className="text-xs font-semibold block mb-1">MODELO:</span>
                <RadioGroup options={modelo} onChange={i => setModelo(prev => toggleOne(prev, i))} columns={4} />
              </div>

              {/* Cabos */}
              <div>
                <span className="text-xs font-semibold block mb-1">CABOS:</span>
                <RadioGroup options={cabos} onChange={i => setCabos(prev => toggleOne(prev, i))} columns={3} />
              </div>

              {/* Voltagem */}
              <div>
                <span className="text-xs font-semibold block mb-1">VOLTAGEM:</span>
                <div className="flex items-start gap-8">
                  <RadioGroup options={voltagem} onChange={i => setVoltagem(prev => toggleOne(prev, i))} columns={2} />
                  <CheckboxGroup options={extras} onChange={i => setExtras(prev => toggleMulti(prev, i))} columns={3} />
                </div>
              </div>

              {/* Fechamento Lateral */}
              <div>
                <span className="text-xs font-semibold block mb-1">FECHAMENTO LATERAL:</span>
                <RadioGroup options={fechamento} onChange={i => setFechamento(prev => toggleOne(prev, i))} columns={3} />
              </div>

              {/* Grelha - Modelo Classic */}
              <div>
                <span className="text-xs font-semibold block mb-1">MODELO CLASSIC - GRELHA:</span>
                <div className="flex items-start gap-6">
                  <RadioGroup options={grelhaClassic} onChange={i => setGrelhaClassic(prev => toggleOne(prev, i))} columns={3} />
                  <RadioGroup options={grelhaLado} onChange={i => setGrelhaLado(prev => toggleOne(prev, i))} columns={2} />
                </div>
              </div>

              {/* Modelo da Grelha */}
              <div>
                <span className="text-xs font-semibold block mb-1">MODELO DA GRELHA:</span>
                <RadioGroup options={modeloGrelha} onChange={i => setModeloGrelha(prev => toggleOne(prev, i))} columns={3} />
              </div>
            </div>
          </Section>

          {/* OBS */}
          <Section title="Observações">
            <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações gerais..." className="text-xs border-muted min-h-[60px]" />
          </Section>

          {/* Medidas do Vão */}
          <Section title="Desenho - Especificar as Medidas do Vão">
            <div className="flex gap-6">
              {/* Diagram visual */}
              <div className="border-2 border-muted-foreground/30 rounded-md p-3 flex-1 relative" style={{ minHeight: 180 }}>
                <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-medium">
                  ESPAÇO PARA ENGRENAGEM — 6cm
                </div>
                <div className="border-2 border-dashed border-muted-foreground/20 rounded mt-5 mx-4 flex items-center justify-center" style={{ height: 80 }}>
                  <span className="text-[10px] text-muted-foreground">(tubo) ESPAÇO PARA FOGO</span>
                </div>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-medium">
                  SOLEIRA — 20cm
                </div>
              </div>

              {/* Medidas */}
              <div className="space-y-2 min-w-[180px]">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold w-24">LARGURA:</span>
                  <Input value={medidaLargura} onChange={e => setMedidaLargura(e.target.value)} placeholder="cm" className="h-7 text-xs border-muted w-20" />
                  <span className="text-muted-foreground">cm</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold w-24">PROFUNDIDADE:</span>
                  <Input value={medidaProfundidade} onChange={e => setMedidaProfundidade(e.target.value)} placeholder="cm" className="h-7 text-xs border-muted w-20" />
                  <span className="text-muted-foreground">cm</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold w-24">ALTURA:</span>
                  <Input value={medidaAltura} onChange={e => setMedidaAltura(e.target.value)} placeholder="cm" className="h-7 text-xs border-muted w-20" />
                  <span className="text-muted-foreground">cm</span>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xs font-semibold block mb-1">OBS:</span>
              <Textarea value={obsMedidas} onChange={e => setObsMedidas(e.target.value)} placeholder="Observações sobre medidas..." className="text-xs border-muted min-h-[40px]" />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
