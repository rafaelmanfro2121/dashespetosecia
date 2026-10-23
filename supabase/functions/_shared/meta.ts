// Regras de normalização, hash e agrupamento para a integração com a Meta.
// Usado pela Edge Function `meta-capi` (Deno) e pelo navegador (exportação CSV).
// Só usa Web APIs (crypto.subtle, TextEncoder), que existem nos dois ambientes.
// NUNCA logue valores produzidos por este módulo: são dados pessoais.

export interface SaleRow {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_contato: string | null;
  total: number | string | null;
  payment_status: string | null;
  order_status: string | null;
  atendimento_data: string | null;
  cidade?: string | null; // vendas históricas (NF) trazem cidade e UF separadas
  uf?: string | null;
}

// No sistema, a venda está fechada quando sai de "pendente" (entrada paga ou pago total).
export const CLOSED_PAYMENT_STATUSES = ['pago', 'parcial'];
const CANCELLED_STATUSES = ['cancelado', 'cancelada', 'estornado', 'estornada'];

export function isClosedSale(sale: Pick<SaleRow, 'payment_status' | 'order_status'>): boolean {
  const pay = (sale.payment_status ?? '').toLowerCase();
  const order = (sale.order_status ?? '').toLowerCase();
  if (CANCELLED_STATUSES.includes(pay) || CANCELLED_STATUSES.includes(order)) return false;
  return CLOSED_PAYMENT_STATUSES.includes(pay);
}

/** Telefone BR: só dígitos, 55 + DDD + número. Retorna null se não ficar com 12 ou 13 dígitos. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  d = d.replace(/^0+/, ''); // "0" antes do DDD (ou do 55)
  if (d.length === 10 || d.length === 11) d = '55' + d; // DDD + número, sem país
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const e = (raw ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function cleanWord(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z]/g, '');
}

export function splitName(full: string | null | undefined): { fn: string; ln: string } {
  const parts = (full ?? '').trim().split(/\s+/).map(cleanWord).filter(Boolean);
  if (parts.length === 0) return { fn: '', ln: '' };
  return { fn: parts[0], ln: parts.length > 1 ? parts[parts.length - 1] : '' };
}

export function normalizeCity(s: string | null | undefined): string {
  return stripAccents(s ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

export function normalizeState(s: string | null | undefined): string {
  const uf = (s ?? '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(uf) ? uf : '';
}

/** CEP (8 dígitos) a partir do texto livre de endereço. */
export function extractZip(text: string | null | undefined): string {
  const m = (text ?? '').match(/\b(\d{5})[-.\s]?(\d{3})\b/);
  return m ? m[1] + m[2] : '';
}

export function toNumber(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// PARTE 1 — Conversions API

export interface CapiEvent {
  event_name: 'Purchase';
  event_time: number;
  event_id: string;
  action_source: string;
  user_data: Record<string, string[]>;
  custom_data: { currency: 'BRL'; value: number };
}

/** Monta o evento Purchase com dados já normalizados e com hash. null = sem telefone nem e-mail válidos. */
export async function buildPurchaseEvent(
  sale: SaleRow,
  eventTime: Date,
  actionSource: string,
): Promise<CapiEvent | null> {
  const phone = normalizePhone(sale.cliente_telefone);
  const email = normalizeEmail(sale.cliente_email);
  if (!phone && !email) return null;

  const user_data: Record<string, string[]> = {};
  if (phone) user_data.ph = [await sha256Hex(phone)];
  if (email) user_data.em = [await sha256Hex(email)];
  const { fn, ln } = splitName(sale.cliente_nome);
  if (fn) user_data.fn = [await sha256Hex(fn)];
  if (ln) user_data.ln = [await sha256Hex(ln)];
  const zip = extractZip(sale.cliente_contato);
  if (zip) user_data.zp = [await sha256Hex(zip)];
  user_data.country = [await sha256Hex('br')];

  return {
    event_name: 'Purchase',
    event_time: Math.floor(eventTime.getTime() / 1000),
    event_id: sale.id,
    action_source: actionSource,
    user_data,
    custom_data: { currency: 'BRL', value: Math.round(toNumber(sale.total) * 100) / 100 },
  };
}

// ---------------------------------------------------------------------------
// PARTE 2 — Exportação CSV (texto claro, sem hash: a Meta faz o hash no upload)

export const CSV_HEADER = ['phone', 'email', 'fn', 'ln', 'ct', 'st', 'zip', 'country', 'value'] as const;
export type CustomerRow = Record<(typeof CSV_HEADER)[number], string>;

export interface ExportStats {
  customers: number;
  sales: number;
  revenue: number;
  withEmail: number;
  discardedInvalidPhone: number;
  averageTicket: number;
  byYear: { year: string; sales: number; revenue: number }[];
}

/** Agrupa vendas fechadas por cliente (chave = telefone normalizado), somando o valor (LTV). */
export function aggregateCustomers(
  sales: SaleRow[],
  range: { from?: string; to?: string } = {},
): { rows: CustomerRow[]; stats: ExportStats } {
  const byPhone = new Map<string, { email: string; fn: string; ln: string; ct: string; st: string; zip: string; value: number }>();
  const byYear = new Map<string, { sales: number; revenue: number }>();
  let discarded = 0;
  let salesCount = 0;
  let revenue = 0;

  for (const s of sales) {
    if (!isClosedSale(s)) continue;
    const date = s.atendimento_data ?? '';
    if (range.from && date < range.from) continue;
    if (range.to && date > range.to) continue;

    const phone = normalizePhone(s.cliente_telefone);
    if (!phone) { discarded++; continue; }

    const value = toNumber(s.total);
    salesCount++;
    revenue += value;
    const year = date.slice(0, 4) || 'sem data';
    const y = byYear.get(year) ?? { sales: 0, revenue: 0 };
    y.sales++; y.revenue += value;
    byYear.set(year, y);

    const { fn, ln } = splitName(s.cliente_nome);
    const current = byPhone.get(phone);
    if (current) {
      current.value += value;
      current.email ||= normalizeEmail(s.cliente_email) ?? '';
      current.fn ||= fn;
      current.ln ||= ln;
      current.zip ||= extractZip(s.cliente_contato);
      current.ct ||= normalizeCity(s.cidade);
      current.st ||= normalizeState(s.uf);
    } else {
      byPhone.set(phone, {
        email: normalizeEmail(s.cliente_email) ?? '',
        fn, ln,
        ct: normalizeCity(s.cidade),
        st: normalizeState(s.uf),
        zip: extractZip(s.cliente_contato),
        value,
      });
    }
  }

  const rows: CustomerRow[] = [...byPhone.entries()].map(([phone, c]) => ({
    phone, email: c.email, fn: c.fn, ln: c.ln,
    ct: c.ct, st: c.st, // só as vendas históricas (NF) têm cidade/UF separadas
    zip: c.zip, country: 'br', value: c.value.toFixed(2),
  }));

  return {
    rows,
    stats: {
      customers: rows.length,
      sales: salesCount,
      revenue,
      withEmail: rows.filter(r => r.email).length,
      discardedInvalidPhone: discarded,
      averageTicket: salesCount ? revenue / salesCount : 0,
      byYear: [...byYear.entries()].sort().map(([year, v]) => ({ year, ...v })),
    },
  };
}

export function toCsv(rows: CustomerRow[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [CSV_HEADER.join(','), ...rows.map(r => CSV_HEADER.map(k => esc(r[k])).join(','))].join('\n') + '\n';
}
