// Pagamentos de um pedido: cada parcela guarda valor e forma (dinheiro/PIX ou cartão).
// A taxa do cartão incide só sobre o que foi pago no cartão.

export const CARD_FEE = 0.1177;

export type PaymentMethod = 'dinheiro' | 'cartao';

export interface PaymentEntry {
  amount: number;
  method: PaymentMethod;
  date: string; // ISO; vazio para pagamentos registrados antes do histórico existir
}

export interface PaidOrder {
  total: number | null;
  paid_amount: number | null;
  payment_method_client: string | null;
  payments?: unknown;
}

export const METHOD_LABEL = {
  dinheiro: 'Dinheiro/PIX',
  cartao: 'Cartão de Crédito',
  misto: 'Misto',
} as const;

export function isCardLabel(label: string | null | undefined): boolean {
  const m = (label ?? '').toLowerCase();
  return m.includes('cartão') || m.includes('cartao') || m.includes('crédito') || m.includes('credito');
}

/** Parcelas do pedido. Pedidos antigos (sem histórico) viram uma parcela única com a forma registrada. */
export function paymentEntries(order: PaidOrder): PaymentEntry[] {
  if (Array.isArray(order.payments) && order.payments.length > 0) {
    return (order.payments as PaymentEntry[]).filter(p => p && Number(p.amount) > 0);
  }
  const paid = Number(order.paid_amount) || 0;
  if (paid <= 0) return [];
  return [{ amount: paid, method: isCardLabel(order.payment_method_client) ? 'cartao' : 'dinheiro', date: '' }];
}

export function paidTotal(entries: PaymentEntry[]): number {
  return entries.reduce((s, p) => s + Number(p.amount), 0);
}

export function netOf(entry: Pick<PaymentEntry, 'amount' | 'method'>): number {
  return entry.method === 'cartao' ? Number(entry.amount) * (1 - CARD_FEE) : Number(entry.amount);
}

/** Receita líquida do pedido: parcelas pagas (com taxa só no cartão) + o que falta receber, pelo valor bruto. */
export function netRevenue(order: PaidOrder, entries = paymentEntries(order)): number {
  const total = Number(order.total) || 0;
  const paid = paidTotal(entries);
  const net = entries.reduce((s, p) => s + netOf(p), 0);
  return net + Math.max(0, total - paid);
}

export function methodLabel(entries: PaymentEntry[]): string {
  const methods = new Set(entries.map(p => p.method));
  if (methods.size > 1) return METHOD_LABEL.misto;
  if (methods.has('cartao')) return METHOD_LABEL.cartao;
  return METHOD_LABEL.dinheiro;
}

/** Soma por forma de pagamento, para mostrar na tela. */
export function totalsByMethod(entries: PaymentEntry[]): { dinheiro: number; cartao: number } {
  return entries.reduce(
    (acc, p) => ({ ...acc, [p.method]: acc[p.method] + Number(p.amount) }),
    { dinheiro: 0, cartao: 0 },
  );
}
