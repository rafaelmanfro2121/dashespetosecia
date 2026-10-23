import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pageVariants, itemVariants } from '@/lib/motion';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { normalizePhone, normalizeEmail } from '../../supabase/functions/_shared/meta';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, Loader2, ChevronDown, MessageCircle, AlertTriangle, X, Users, Wallet, Receipt, Phone, Download, SlidersHorizontal, MapPin, Mail } from 'lucide-react';

/** Uma compra: de nota fiscal importada ou de pedido fechado no sistema. */
interface Note {
  nf_key: string;
  documento_venda: string; // "NF 028045089" ou "Pedido 06398"
  issued_at: string | null;
  cliente_nome: string | null;
  cliente_documento: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  total: number;
}

interface Customer {
  key: string;
  nome: string;
  telefone: string;       // normalizado (55 + DDD + número) ou vazio
  telefoneTexto: string;  // como veio na nota
  documento: string;
  cidade: string;
  uf: string;
  total: number;
  first: string | null;
  last: string | null;
  notes: Note[];
}

const PAGE_SIZE = 50;
const fmtDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '–');
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Agrupa as notas por cliente: telefone, senão CPF/CNPJ, senão nome. */
function groupCustomers(notes: Note[]): Customer[] {
  const map = new Map<string, Customer>();
  for (const n of notes) {
    const phone = normalizePhone(n.cliente_telefone) ?? '';
    const doc = (n.cliente_documento ?? '').replace(/\D/g, '');
    const key = phone || (doc ? `doc:${doc}` : `nome:${fold(n.cliente_nome ?? '')}`);
    const c = map.get(key) ?? {
      key, nome: n.cliente_nome ?? '', telefone: phone, telefoneTexto: n.cliente_telefone ?? '', documento: n.cliente_documento ?? '',
      cidade: n.cidade ?? '', uf: (n.uf ?? '').toUpperCase(), total: 0, first: null, last: null, notes: [],
    };
    c.total += Number(n.total) || 0;
    c.notes.push(n);
    if (n.issued_at) {
      if (!c.first || n.issued_at < c.first) c.first = n.issued_at;
      if (!c.last || n.issued_at > c.last) {
        c.last = n.issued_at;
        // Dados da compra mais recente
        c.nome = n.cliente_nome || c.nome;
        c.cidade = n.cidade || c.cidade;
        c.uf = (n.uf || c.uf).toUpperCase();
      }
    }
    map.set(key, c);
  }
  for (const c of map.values()) c.notes.sort((a, b) => (b.issued_at ?? '').localeCompare(a.issued_at ?? ''));
  return [...map.values()];
}

type Origin = 'all' | 'nf' | 'pedido';
type PhoneOpt = 'all' | 'with' | 'without';
type Recurrence = 'all' | 'repeat';
type ValueRange = 'all' | 'lt3' | '3to6' | '6to10' | 'gt10';
type SortKey = 'total' | 'recent' | 'count' | 'name';

const VALUE_RANGES: { id: ValueRange; label: string; test: (v: number) => boolean }[] = [
  { id: 'all', label: 'Todos', test: () => true },
  { id: 'lt3', label: 'Até R$ 3 mil', test: v => v < 3000 },
  { id: '3to6', label: 'R$ 3–6 mil', test: v => v >= 3000 && v < 6000 },
  { id: '6to10', label: 'R$ 6–10 mil', test: v => v >= 6000 && v < 10000 },
  { id: 'gt10', label: 'R$ 10 mil+', test: v => v >= 10000 },
];

const isPedido = (n: Note) => n.nf_key.startsWith('pedido:');

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
  if (days < 1) return 'hoje';
  if (days < 30) return `há ${days} dia${days > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months > 1 ? 'meses' : 'mês'}`;
  const years = Math.floor(days / 365);
  return `há ${years} ano${years > 1 ? 's' : ''}`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Grupo de opções em chips (seleção única), com destaque que desliza entre as opções. */
function ChipGroup<T extends string>({ id, label, value, options, onChange }: {
  id: string; label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">{label}</span>
      {options.map(o => {
        const active = o.id === value;
        return (
          <motion.button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(o.id)}
            className={`relative h-8 px-3 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? 'border-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/40'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`chip-${id}`}
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint?: string }) {
  return (
    <motion.div variants={itemVariants} className="metric-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={16} className="text-primary" aria-hidden="true" />
        </span>
      </div>
      <p className="text-xl sm:text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </motion.div>
  );
}

/**
 * Lista para público personalizado da Meta: uma coluna de identificação (telefone OU e-mail) e o valor
 * gasto, que permite criar o público semelhante pelo valor do cliente. Um cliente por linha, sem repetir.
 */
function downloadMetaList(list: Customer[], kind: 'phone' | 'email') {
  const byId = new Map<string, number>();
  for (const c of list) {
    const id = kind === 'phone'
      ? c.telefone
      : normalizeEmail(c.notes.find(n => normalizeEmail(n.cliente_email))?.cliente_email) ?? '';
    if (id) byId.set(id, (byId.get(id) ?? 0) + c.total);
  }
  if (!byId.size) { toast.error(kind === 'phone' ? 'Nenhum telefone válido nesta lista' : 'Nenhum e-mail nesta lista'); return; }
  const lines = [`${kind},value`, ...[...byId].map(([id, v]) => `${id},${v.toFixed(2)}`)];
  const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `meta-${kind === 'phone' ? 'telefones' : 'emails'}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success(`${byId.size} ${kind === 'phone' ? 'telefones' : 'e-mails'} no arquivo`);
}

function downloadCsv(list: Customer[]) {
  const head = ['nome', 'telefone', 'email', 'cpf_cnpj', 'cidade', 'uf', 'compras', 'total_gasto', 'primeira_compra', 'ultima_compra'];
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = list.map(c => [
    c.nome, c.telefone || c.telefoneTexto, c.notes.find(n => n.cliente_email)?.cliente_email ?? '', c.documento,
    c.cidade, c.uf, String(c.notes.length), c.total.toFixed(2).replace('.', ','), fmtDate(c.first), fmtDate(c.last),
  ].map(v => esc(v ?? '')).join(';'));
  // ";" e BOM para abrir direto no Excel em português
  const blob = new Blob(['﻿' + [head.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ClientesAntigosPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 200);
  const [origin, setOrigin] = useState<Origin>('all');
  const [phoneFilter, setPhoneFilter] = useState<PhoneOpt>('all');
  const [recurrence, setRecurrence] = useState<Recurrence>('all');
  const [valueRange, setValueRange] = useState<ValueRange>('all');
  const [ufsSel, setUfsSel] = useState<string[]>([]);
  const [showAllUfs, setShowAllUfs] = useState(false);
  const [yearFrom, setYearFrom] = useState('all');
  const [yearTo, setYearTo] = useState('all');
  const [sort, setSort] = useState<SortKey>('total');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    (async () => {
      const all: Note[] = [];
      // Clientes das notas fiscais importadas
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('historical_sales')
          .select('nf_key, nf_number, issued_at, cliente_nome, cliente_documento, cliente_telefone, cliente_email, endereco, bairro, cidade, uf, cep, total')
          .order('issued_at', { ascending: false })
          .range(from, from + 999);
        if (error) { setMissingTable(true); break; }
        all.push(...(data ?? []).map(({ nf_number, ...n }) => ({ ...n, documento_venda: nf_number ? `NF ${nf_number}` : 'NF' }) as Note));
        if (!data || data.length < 1000) break;
      }
      // Pedidos fechados no sistema (entrada ou pago): entram na base automaticamente
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('service_orders')
          .select('id, os_number, atendimento_data, cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente_email, cliente_contato, total, payment_status, order_status')
          .in('payment_status', ['pago', 'parcial'])
          .range(from, from + 999);
        if (error) break;
        for (const o of data ?? []) {
          if (/cancel|estorn/i.test(`${o.order_status} ${o.payment_status}`)) continue;
          all.push({
            nf_key: `pedido:${o.id}`,
            documento_venda: `Pedido ${o.os_number}`,
            issued_at: o.atendimento_data,
            cliente_nome: o.cliente_nome,
            cliente_documento: o.cliente_cpf_cnpj,
            cliente_telefone: o.cliente_telefone,
            cliente_email: o.cliente_email,
            endereco: o.cliente_contato,
            bairro: null,
            cidade: null,
            uf: null,
            cep: null, // o CEP já vem dentro do endereço do pedido
            total: Number(o.total) || 0,
          });
        }
        if (!data || data.length < 1000) break;
      }
      setNotes(all);
      setLoading(false);
    })();
  }, []);

  const customers = useMemo(() => groupCustomers(notes), [notes]);
  const years = useMemo(() => [...new Set(notes.map(n => n.issued_at?.slice(0, 4)).filter(Boolean))].sort() as string[], [notes]);
  const ufCounts = useMemo(() => {
    const m = new Map<string, number>();
    customers.forEach(c => c.uf && m.set(c.uf, (m.get(c.uf) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [customers]);

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    const qDigits = search.replace(/\D/g, '');
    const range = VALUE_RANGES.find(r => r.id === valueRange)!;
    const inYears = (n: Note) => {
      const y = n.issued_at?.slice(0, 4);
      if (!y) return yearFrom === 'all' && yearTo === 'all';
      return (yearFrom === 'all' || y >= yearFrom) && (yearTo === 'all' || y <= yearTo);
    };
    const list = customers.filter(c => {
      if (origin === 'nf' && !c.notes.some(n => !isPedido(n))) return false;
      if (origin === 'pedido' && !c.notes.some(isPedido)) return false;
      if (phoneFilter === 'with' && !c.telefone) return false;
      if (phoneFilter === 'without' && c.telefone) return false;
      if (recurrence === 'repeat' && c.notes.length < 2) return false;
      if (!range.test(c.total)) return false;
      if (ufsSel.length && !ufsSel.includes(c.uf)) return false;
      if ((yearFrom !== 'all' || yearTo !== 'all') && !c.notes.some(inYears)) return false;
      if (!q) return true;
      if (fold(`${c.nome} ${c.cidade} ${c.uf}`).includes(q)) return true;
      return qDigits.length >= 3 && (c.telefone.includes(qDigits) || c.documento.replace(/\D/g, '').includes(qDigits));
    });
    const by: Record<SortKey, (a: Customer, b: Customer) => number> = {
      total: (a, b) => b.total - a.total,
      recent: (a, b) => (b.last ?? '').localeCompare(a.last ?? ''),
      count: (a, b) => b.notes.length - a.notes.length || b.total - a.total,
      name: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
    };
    return list.sort(by[sort]);
  }, [customers, search, origin, phoneFilter, recurrence, valueRange, ufsSel, yearFrom, yearTo, sort]);

  useEffect(() => { setPage(0); setOpen(null); }, [search, origin, phoneFilter, recurrence, valueRange, ufsSel, yearFrom, yearTo, sort]);

  const stats = useMemo(() => {
    const revenue = filtered.reduce((s, c) => s + c.total, 0);
    const purchases = filtered.reduce((s, c) => s + c.notes.length, 0);
    const withPhone = filtered.filter(c => c.telefone).length;
    return { revenue, purchases, withPhone, avg: purchases ? revenue / purchases : 0 };
  }, [filtered]);

  const active: { label: string; clear: () => void }[] = [
    ...(searchInput ? [{ label: `"${searchInput}"`, clear: () => setSearchInput('') }] : []),
    ...(origin !== 'all' ? [{ label: origin === 'nf' ? 'Notas antigas' : 'Pedidos do sistema', clear: () => setOrigin('all') }] : []),
    ...(phoneFilter !== 'all' ? [{ label: phoneFilter === 'with' ? 'Com WhatsApp' : 'Sem telefone', clear: () => setPhoneFilter('all') }] : []),
    ...(recurrence !== 'all' ? [{ label: 'Compraram 2+ vezes', clear: () => setRecurrence('all') }] : []),
    ...(valueRange !== 'all' ? [{ label: VALUE_RANGES.find(r => r.id === valueRange)!.label, clear: () => setValueRange('all') }] : []),
    ...ufsSel.map(u => ({ label: u, clear: () => setUfsSel(s => s.filter(x => x !== u)) })),
    ...(yearFrom !== 'all' || yearTo !== 'all'
      ? [{ label: `${yearFrom === 'all' ? 'início' : yearFrom} – ${yearTo === 'all' ? 'hoje' : yearTo}`, clear: () => { setYearFrom('all'); setYearTo('all'); } }]
      : []),
  ];
  const clearAll = () => {
    setSearchInput(''); setOrigin('all'); setPhoneFilter('all'); setRecurrence('all');
    setValueRange('all'); setUfsSel([]); setYearFrom('all'); setYearTo('all');
  };

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const ufList = showAllUfs ? ufCounts : ufCounts.slice(0, 10);

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <History size={22} className="text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="page-title">Clientes antigos</h1>
            <p className="text-muted-foreground text-xs">Todos que já compraram: notas fiscais importadas e pedidos fechados no sistema</p>
          </div>
        </div>
        {!missingTable && (
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl" onClick={() => downloadMetaList(filtered, 'phone')} disabled={!filtered.length}
              title="Uma coluna de telefones (55 + DDD + número) e o valor gasto, para público personalizado da Meta">
              <Phone /> Telefones para Meta
            </Button>
            <Button className="rounded-xl" onClick={() => downloadMetaList(filtered, 'email')} disabled={!filtered.length}
              title="Uma coluna de e-mails e o valor gasto, para público personalizado da Meta">
              <Mail /> E-mails para Meta
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>
              <Download /> Lista completa (Excel)
            </Button>
          </div>
        )}
      </motion.div>

      {missingTable ? (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
          <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" aria-hidden="true" />
          <span>Rode <code>supabase/setup/7-vendas-historicas.sql</code> no Supabase e importe as notas na página Meta Ads.</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            <Kpi icon={Users} label="Clientes" value={filtered.length.toLocaleString('pt-BR')} hint={`${stats.purchases.toLocaleString('pt-BR')} compras`} />
            <Kpi icon={Wallet} label="Total vendido" value={formatCurrency(stats.revenue)} />
            <Kpi icon={Receipt} label="Ticket médio" value={formatCurrency(stats.avg)} />
            <Kpi icon={Phone} label="Com WhatsApp" value={stats.withPhone.toLocaleString('pt-BR')}
              hint={filtered.length ? `${Math.round((stats.withPhone / filtered.length) * 100)}% da lista` : undefined} />
          </div>

          <motion.div variants={itemVariants} className="metric-card p-4 sm:p-5 mb-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Buscar por nome, cidade, telefone ou CPF/CNPJ"
                  aria-label="Buscar cliente"
                  className="h-11 pl-10 pr-10 rounded-xl text-sm"
                />
                {searchInput && (
                  <button type="button" onClick={() => setSearchInput('')} aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
                  <SelectTrigger className="h-11 rounded-xl w-full md:w-52" aria-label="Ordenar"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Maior valor gasto</SelectItem>
                    <SelectItem value="recent">Compra mais recente</SelectItem>
                    <SelectItem value="count">Mais compras</SelectItem>
                    <SelectItem value="name">Nome (A–Z)</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="h-11 rounded-xl md:hidden" onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}>
                  <SlidersHorizontal /> Filtros
                </Button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showFilters && (
                <motion.div
                  key="filters"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:flex-wrap gap-x-6 gap-y-3">
                    <ChipGroup<Origin> id="origin" label="Origem" value={origin} onChange={setOrigin}
                      options={[{ id: 'all', label: 'Todos' }, { id: 'nf', label: 'Notas antigas' }, { id: 'pedido', label: 'Pedidos do sistema' }]} />
                    <ChipGroup<PhoneOpt> id="phone" label="Telefone" value={phoneFilter} onChange={setPhoneFilter}
                      options={[{ id: 'all', label: 'Todos' }, { id: 'with', label: 'Com WhatsApp' }, { id: 'without', label: 'Sem telefone' }]} />
                    <ChipGroup<Recurrence> id="rec" label="Compras" value={recurrence} onChange={setRecurrence}
                      options={[{ id: 'all', label: 'Todas' }, { id: 'repeat', label: '2+ vezes' }]} />
                  </div>
                  <ChipGroup<ValueRange> id="value" label="Valor gasto" value={valueRange} onChange={setValueRange}
                    options={VALUE_RANGES.map(r => ({ id: r.id, label: r.label }))} />

                  <div className="flex flex-col lg:flex-row gap-3 lg:items-start">
                    <div className="flex flex-wrap items-center gap-1.5 flex-1" role="group" aria-label="Estados">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-1 inline-flex items-center gap-1">
                        <MapPin size={12} aria-hidden="true" /> Estados
                      </span>
                      {ufList.map(([u, n]) => {
                        const on = ufsSel.includes(u);
                        return (
                          <motion.button key={u} type="button" whileTap={{ scale: 0.95 }} aria-pressed={on}
                            onClick={() => setUfsSel(s => (on ? s.filter(x => x !== u) : [...s, u]))}
                            className={`h-8 px-2.5 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              on ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/40'
                            }`}>
                            {u} <span className={`tabular-nums ${on ? 'opacity-80' : 'text-muted-foreground'}`}>{n}</span>
                          </motion.button>
                        );
                      })}
                      {ufCounts.length > 10 && (
                        <button type="button" onClick={() => setShowAllUfs(v => !v)} className="h-8 px-2.5 text-xs font-medium text-primary hover:underline">
                          {showAllUfs ? 'Mostrar menos' : `+${ufCounts.length - 10} estados`}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Comprou entre</span>
                      <Select value={yearFrom} onValueChange={setYearFrom}>
                        <SelectTrigger className="h-8 w-24 rounded-full text-xs" aria-label="Ano inicial"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Início</SelectItem>
                          {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">e</span>
                      <Select value={yearTo} onValueChange={setYearTo}>
                        <SelectTrigger className="h-8 w-24 rounded-full text-xs" aria-label="Ano final"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Hoje</SelectItem>
                          {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {active.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t" aria-label="Filtros ativos">
                <AnimatePresence initial={false}>
                  {active.map(f => (
                    <motion.button key={f.label} type="button" layout onClick={f.clear}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
                      className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15"
                      aria-label={`Remover filtro ${f.label}`}>
                      {f.label} <X size={12} aria-hidden="true" />
                    </motion.button>
                  ))}
                </AnimatePresence>
                <button type="button" onClick={clearAll} className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">Limpar filtros</button>
              </div>
            )}
          </motion.div>

          {loading ? (
            <div className="metric-card space-y-3" aria-busy="true" aria-label="Carregando clientes">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-muted" />
                  <div className="h-3 rounded bg-muted flex-1" />
                  <div className="h-3 rounded bg-muted w-24" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div variants={itemVariants} className="metric-card text-center py-12">
              <Users size={28} className="mx-auto text-muted-foreground mb-2" aria-hidden="true" />
              <p className="text-sm font-medium">Nenhum cliente encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Tente outra busca ou remova algum filtro.</p>
              {active.length > 0 && <Button variant="outline" size="sm" className="rounded-xl mt-4" onClick={clearAll}>Limpar filtros</Button>}
            </motion.div>
          ) : (
            <motion.div variants={itemVariants} className="metric-card p-0 overflow-hidden">
              {/* Cabeçalho (computador) */}
              <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_80px_130px_130px_36px] gap-3 px-5 py-3 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Cliente</span><span>Cidade/UF</span><span>Telefone</span>
                <span className="text-right">Compras</span><span className="text-right">Total gasto</span><span className="text-right">Última compra</span><span />
              </div>
              <ul className="divide-y">
                {visible.map(c => (
                  <CustomerRow key={c.key} c={c} open={open === c.key} onToggle={() => setOpen(open === c.key ? null : c.key)} />
                ))}
              </ul>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length.toLocaleString('pt-BR')}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}

function WhatsAppLink({ c }: { c: Customer }) {
  if (!c.telefone) return <span className="text-xs text-muted-foreground">sem telefone</span>;
  return (
    <a href={`https://wa.me/${c.telefone}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
      aria-label={`Abrir WhatsApp de ${c.nome}`}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-success/10 text-success text-xs font-medium hover:bg-success/15 transition-colors">
      <MessageCircle size={14} aria-hidden="true" />
      <span className="tabular-nums">{c.telefoneTexto || c.telefone}</span>
    </a>
  );
}

function CustomerRow({ c, open, onToggle }: { c: Customer; open: boolean; onToggle: () => void }) {
  const hasPedido = c.notes.some(isPedido);
  const email = c.notes.find(n => n.cliente_email)?.cliente_email;
  const addr = c.notes.find(n => n.endereco);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_80px_130px_130px_36px] gap-3 items-center px-4 md:px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:bg-muted/40"
      >
        {/* Cliente */}
        <div className="flex items-center gap-3 min-w-0 md:col-auto col-span-2">
          <span className="w-9 h-9 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center" aria-hidden="true">
            {initials(c.nome)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{c.nome || 'Sem nome'}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {hasPedido && <span className="inline-block mr-1.5 px-1.5 rounded bg-info/10 text-info font-medium">cliente do sistema</span>}
              <span className="md:hidden">{[c.cidade, c.uf].filter(Boolean).join('/')}</span>
            </p>
          </div>
        </div>
        <span className="hidden md:block text-sm truncate">{[c.cidade, c.uf].filter(Boolean).join('/') || '–'}</span>
        <span className="hidden md:block"><WhatsAppLink c={c} /></span>
        <span className="hidden md:block text-right text-sm tabular-nums">{c.notes.length}</span>
        {/* Total: aparece também no celular */}
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums">{formatCurrency(c.total)}</p>
          <p className="md:hidden text-[11px] text-muted-foreground">{c.notes.length} compra{c.notes.length > 1 ? 's' : ''}</p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-sm tabular-nums">{fmtDate(c.last)}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(c.last)}</p>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="hidden md:flex justify-center text-muted-foreground" aria-hidden="true">
          <ChevronDown size={16} />
        </motion.span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2 }}
            className="px-4 md:px-5 pb-4"
          >
            <div className="rounded-xl border bg-muted/20 p-4 grid md:grid-cols-[1fr_1.4fr] gap-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs content-start">
                <dt className="text-muted-foreground">Telefone</dt><dd><span className="md:hidden"><WhatsAppLink c={c} /></span><span className="hidden md:inline">{c.telefoneTexto || '–'}</span></dd>
                <dt className="text-muted-foreground">CPF/CNPJ</dt><dd>{c.documento || '–'}</dd>
                <dt className="text-muted-foreground">E-mail</dt><dd className="break-all">{email || '–'}</dd>
                <dt className="text-muted-foreground">Endereço</dt><dd>{addr ? [addr.endereco, addr.bairro, addr.cep].filter(Boolean).join(' · ') : '–'}</dd>
                <dt className="text-muted-foreground">Cliente desde</dt><dd>{fmtDate(c.first)}</dd>
              </dl>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Compras</p>
                <ul className="space-y-1.5">
                  {c.notes.map(n => (
                    <li key={n.nf_key} className="flex items-center justify-between gap-3 text-xs rounded-lg bg-card border px-3 py-2">
                      <span className="tabular-nums">{fmtDate(n.issued_at)}</span>
                      <span className={`px-1.5 rounded font-medium ${isPedido(n) ? 'bg-info/10 text-info' : 'bg-muted text-muted-foreground'}`}>{n.documento_venda}</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatCurrency(Number(n.total) || 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
