import { describe, it, expect } from 'vitest';
import { netRevenue, paymentEntries, methodLabel, totalsByMethod, type PaymentEntry } from '@/lib/payments';

const order = (over: Partial<{ total: number; paid_amount: number; payment_method_client: string; payments: unknown }>) => ({
  total: 10000, paid_amount: 0, payment_method_client: '', payments: [], ...over,
});

describe('pagamento misto', () => {
  it('taxa do cartão só sobre a parte paga no cartão', () => {
    const payments: PaymentEntry[] = [
      { amount: 4000, method: 'dinheiro', date: '2026-10-01' },
      { amount: 6000, method: 'cartao', date: '2026-10-10' },
    ];
    const o = order({ paid_amount: 10000, payments });
    expect(netRevenue(o)).toBeCloseTo(4000 + 6000 * (1 - 0.1177), 2); // 9293,80
    expect(methodLabel(payments)).toBe('Misto');
    expect(totalsByMethod(payments)).toEqual({ dinheiro: 4000, cartao: 6000 });
  });

  it('parcial: o que falta entra pelo valor bruto', () => {
    const o = order({ paid_amount: 3000, payments: [{ amount: 3000, method: 'dinheiro', date: '' }] });
    expect(netRevenue(o)).toBe(10000);
  });

  it('pedido antigo sem histórico mantém o cálculo de antes', () => {
    expect(netRevenue(order({ paid_amount: 10000, payment_method_client: 'Cartão de Crédito', payments: [] })))
      .toBeCloseTo(10000 * (1 - 0.1177), 2);
    expect(netRevenue(order({ paid_amount: 10000, payment_method_client: 'Dinheiro/PIX', payments: null }))).toBe(10000);
    expect(paymentEntries(order({ paid_amount: 0 }))).toEqual([]);
  });

  it('só cartão ou só dinheiro', () => {
    expect(methodLabel([{ amount: 1, method: 'cartao', date: '' }])).toBe('Cartão de Crédito');
    expect(methodLabel([{ amount: 1, method: 'dinheiro', date: '' }])).toBe('Dinheiro/PIX');
  });
});
