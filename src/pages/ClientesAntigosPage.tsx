import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { normalizePhone } from '../../supabase/functions/_shared/meta';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, Loader2, ChevronDown, ChevronUp, MessageCircle, AlertTriangle } from 'lucide-react';

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

export default function ClientesAntigosPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('all');
  const [year, setYear] = useState('all');
  const [phoneFilter, setPhoneFilter] = useState('all');
  const [sort, setSort] = useState<'total' | 'recent' | 'name' | 'count'>('total');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

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
  const ufs = useMemo(() => [...new Set(customers.map(c => c.uf).filter(Boolean))].sort(), [customers]);
  const years = useMemo(() => [...new Set(notes.map(n => n.issued_at?.slice(0, 4)).filter(Boolean))].sort().reverse() as string[], [notes]);

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    const qDigits = search.replace(/\D/g, '');
    const list = customers.filter(c => {
      if (uf !== 'all' && c.uf !== uf) return false;
      if (year !== 'all' && !c.notes.some(n => n.issued_at?.startsWith(year))) return false;
      if (phoneFilter === 'with' && !c.telefone) return false;
      if (phoneFilter === 'without' && c.telefone) return false;
      if (!q) return true;
      if (fold(`${c.nome} ${c.cidade} ${c.uf}`).includes(q)) return true;
      return qDigits.length >= 3 && (c.telefone.includes(qDigits) || c.documento.replace(/\D/g, '').includes(qDigits));
    });
    const by = {
      total: (a: Customer, b: Customer) => b.total - a.total,
      recent: (a: Customer, b: Customer) => (b.last ?? '').localeCompare(a.last ?? ''),
      name: (a: Customer, b: Customer) => a.nome.localeCompare(b.nome, 'pt-BR'),
      count: (a: Customer, b: Customer) => b.notes.length - a.notes.length || b.total - a.total,
    }[sort];
    return list.sort(by);
  }, [customers, search, uf, year, phoneFilter, sort]);

  useEffect(() => { setPage(0); }, [search, uf, year, phoneFilter, sort]);

  const totalValue = filtered.reduce((s, c) => s + c.total, 0);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <History size={22} className="text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="page-title">Clientes antigos</h1>
          <p className="text-muted-foreground text-xs">Todos que já compraram: notas fiscais importadas e pedidos fechados no sistema (entram sozinhos)</p>
        </div>
      </div>

      {missingTable ? (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
          <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" aria-hidden="true" />
          <span>Rode <code>supabase/setup/7-vendas-historicas.sql</code> no Supabase e importe as notas na página Meta Ads.</span>
        </div>
      ) : (
        <>
          <div className="metric-card mb-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="relative md:col-span-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, cidade, telefone ou CPF/CNPJ" aria-label="Buscar cliente" className="pl-9 rounded-xl" />
              </div>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger className="rounded-xl md:col-span-2" aria-label="Estado"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  {ufs.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="rounded-xl md:col-span-2" aria-label="Ano da compra"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {years.map(y => <SelectItem key={y} value={y}>Comprou em {y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={phoneFilter} onValueChange={setPhoneFilter}>
                <SelectTrigger className="rounded-xl md:col-span-2" aria-label="Telefone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Telefone: todos</SelectItem>
                  <SelectItem value="with">Com telefone</SelectItem>
                  <SelectItem value="without">Sem telefone</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={v => setSort(v as typeof sort)}>
                <SelectTrigger className="rounded-xl md:col-span-2" aria-label="Ordenar"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Maior valor gasto</SelectItem>
                  <SelectItem value="recent">Compra mais recente</SelectItem>
                  <SelectItem value="count">Mais compras</SelectItem>
                  <SelectItem value="name">Nome (A–Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground mt-3 tabular-nums">
              {filtered.length} clientes · {filtered.reduce((s, c) => s + c.notes.length, 0)} compras · {formatCurrency(totalValue)}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-6"><Loader2 size={16} className="animate-spin" /> Carregando...</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Nenhum cliente encontrado.</p>
          ) : (
            <div className="metric-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="text-left font-medium px-4 py-2.5">Cliente</th>
                      <th scope="col" className="text-left font-medium px-4 py-2.5">Cidade/UF</th>
                      <th scope="col" className="text-left font-medium px-4 py-2.5">Telefone</th>
                      <th scope="col" className="text-right font-medium px-4 py-2.5">Compras</th>
                      <th scope="col" className="text-right font-medium px-4 py-2.5">Total gasto</th>
                      <th scope="col" className="text-right font-medium px-4 py-2.5">Última compra</th>
                      <th scope="col" className="w-10"><span className="sr-only">Detalhes</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.map(c => (
                      <FragmentRow key={c.key} c={c} open={open === c.key} onToggle={() => setOpen(open === c.key ? null : c.key)} />
                    ))}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="tabular-nums">Página {page + 1} de {pages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FragmentRow({ c, open, onToggle }: { c: Customer; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="hover:bg-muted/30 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2.5 font-medium">{c.nome || '–'}</td>
        <td className="px-4 py-2.5">{[c.cidade, c.uf].filter(Boolean).join('/') || '–'}</td>
        <td className="px-4 py-2.5">
          {c.telefone ? (
            <a
              href={`https://wa.me/${c.telefone}`}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-success hover:underline"
              aria-label={`Abrir WhatsApp de ${c.nome}`}
            >
              <MessageCircle size={14} aria-hidden="true" /> {c.telefoneTexto || c.telefone}
            </a>
          ) : <span className="text-muted-foreground">sem telefone</span>}
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums">{c.notes.length}</td>
        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatCurrency(c.total)}</td>
        <td className="px-4 py-2.5 text-right tabular-nums">{fmtDate(c.last)}</td>
        <td className="px-2 py-2.5 text-muted-foreground">
          <button type="button" aria-expanded={open} aria-label={open ? 'Fechar detalhes' : 'Ver detalhes'} onClick={e => { e.stopPropagation(); onToggle(); }} className="p-1 rounded hover:bg-muted">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs mb-3">
              <p><span className="text-muted-foreground">CPF/CNPJ:</span> {c.documento || '–'}</p>
              <p><span className="text-muted-foreground">E-mail:</span> {c.notes.find(n => n.cliente_email)?.cliente_email || '–'}</p>
              <p className="sm:col-span-2"><span className="text-muted-foreground">Endereço:</span> {(() => { const a = c.notes.find(n => n.endereco); return a ? [a.endereco, a.bairro, a.cep].filter(Boolean).join(' · ') : '–'; })()}</p>
            </div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr><th scope="col" className="text-left font-medium py-1">Data da compra</th><th scope="col" className="text-left font-medium py-1">Nota / pedido</th><th scope="col" className="text-right font-medium py-1">Valor</th></tr>
              </thead>
              <tbody>
                {c.notes.map(n => (
                  <tr key={n.nf_key}>
                    <td className="py-1 tabular-nums">{fmtDate(n.issued_at)}</td>
                    <td className="py-1 tabular-nums">{n.documento_venda}</td>
                    <td className="py-1 text-right tabular-nums">{formatCurrency(Number(n.total) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
