import { describe, it, expect } from 'vitest';
import {
  normalizePhone, normalizeEmail, sha256Hex, splitName, extractZip,
  aggregateCustomers, toCsv, buildPurchaseEvent, isClosedSale, type SaleRow,
} from '../../supabase/functions/_shared/meta';

const sale = (over: Partial<SaleRow>): SaleRow => ({
  id: 'id-' + Math.random().toString(36).slice(2),
  cliente_nome: 'João da Silva',
  cliente_telefone: '(54) 99999-8888',
  cliente_email: 'Cliente@Exemplo.com ',
  cliente_contato: 'Rua A, 10 - 95010-000',
  total: 1000,
  payment_status: 'pago',
  order_status: 'em_producao',
  atendimento_data: '2026-05-10',
  ...over,
});

describe('normalizePhone', () => {
  it('com máscara e sem 55', () => expect(normalizePhone('(54) 99999-8888')).toBe('5554999998888'));
  it('com +55 e espaços', () => expect(normalizePhone('+55 54 99999-8888')).toBe('5554999998888'));
  it('já com 55, só dígitos', () => expect(normalizePhone('5554999998888')).toBe('5554999998888'));
  it('com 0 antes do DDD', () => expect(normalizePhone('054 99999-8888')).toBe('5554999998888'));
  it('com 0 antes do DDD e com ponto', () => expect(normalizePhone('0 54.9999.8888')).toBe('555499998888'));
  it('fixo de 8 dígitos com DDD', () => expect(normalizePhone('(54) 3196-8604')).toBe('555431968604'));
  it('DDD 55 (Santa Maria) sem o 55 do país', () => expect(normalizePhone('55 99999-8888')).toBe('5555999998888'));
  it('número curto é inválido', () => expect(normalizePhone('99999-8888')).toBeNull());
  it('vazio é inválido', () => expect(normalizePhone('')).toBeNull());
});

describe('normalizeEmail', () => {
  it('minúsculas e sem espaços', () => expect(normalizeEmail('  Cliente@Exemplo.COM ')).toBe('cliente@exemplo.com'));
  it('inválido vira null', () => expect(normalizeEmail('sem-email')).toBeNull());
});

describe('sha256Hex', () => {
  it('valor conhecido → hash esperado (hex minúsculo)', async () => {
    expect(await sha256Hex('5554999998888')).toBe('93f917cc949b439e69582929050a684ba4c7b01160369eb5eddb964c6243ec80');
    expect(await sha256Hex('cliente@exemplo.com')).toBe('ad2df71d41942d725885ffc3a9ca7b4b7227b4c324735678c9ee6eb972eb01bb');
  });
});

describe('nome e CEP', () => {
  it('separa primeiro e último nome, sem acento', () => expect(splitName('  Conceição  Araújo Gonçalves ')).toEqual({ fn: 'conceicao', ln: 'goncalves' }));
  it('extrai CEP do endereço', () => expect(extractZip('Av. Sirius, 840 - Caxias do Sul/RS 95012-500')).toBe('95012500'));
});

describe('buildPurchaseEvent', () => {
  it('usa o ID da venda como event_id, hash no telefone e e-mail, valor numérico', async () => {
    const s = sale({ id: 'venda-123', total: '8900' });
    const e = await buildPurchaseEvent(s, new Date('2026-10-20T12:00:00Z'), 'chat');
    expect(e).not.toBeNull();
    expect(e!.event_id).toBe('venda-123');
    expect(e!.event_time).toBe(1792497600);
    expect(e!.user_data.ph).toEqual(['93f917cc949b439e69582929050a684ba4c7b01160369eb5eddb964c6243ec80']);
    expect(e!.user_data.em).toEqual(['ad2df71d41942d725885ffc3a9ca7b4b7227b4c324735678c9ee6eb972eb01bb']);
    expect(e!.custom_data).toEqual({ currency: 'BRL', value: 8900 });
    expect(JSON.stringify(e)).not.toContain('99999');
  });
  it('sem e-mail não envia "em"', async () => {
    const e = await buildPurchaseEvent(sale({ cliente_email: '' }), new Date(), 'chat');
    expect(e!.user_data.em).toBeUndefined();
  });
  it('sem telefone nem e-mail válidos retorna null', async () => {
    expect(await buildPurchaseEvent(sale({ cliente_telefone: '123', cliente_email: '' }), new Date(), 'chat')).toBeNull();
  });
});

describe('isClosedSale', () => {
  it('pago e parcial contam; pendente e cancelado não', () => {
    expect(isClosedSale({ payment_status: 'pago', order_status: 'enviado' })).toBe(true);
    expect(isClosedSale({ payment_status: 'parcial', order_status: 'em_producao' })).toBe(true);
    expect(isClosedSale({ payment_status: 'pendente', order_status: 'em_producao' })).toBe(false);
    expect(isClosedSale({ payment_status: 'pago', order_status: 'cancelado' })).toBe(false);
    expect(isClosedSale({ payment_status: 'estornado', order_status: 'enviado' })).toBe(false);
  });
});

describe('aggregateCustomers', () => {
  it('cliente com 3 compras vira 1 linha com a soma (LTV)', () => {
    const { rows, stats } = aggregateCustomers([
      sale({ total: 1000, cliente_telefone: '(54) 99999-8888' }),
      sale({ total: 2500.5, cliente_telefone: '54999998888' }),
      sale({ total: 500, cliente_telefone: '+55 54 99999-8888', atendimento_data: '2025-01-02' }),
      sale({ total: 700, cliente_telefone: '(11) 98888-7777', cliente_email: '' }),
    ]);
    expect(rows).toHaveLength(2);
    const joao = rows.find(r => r.phone === '5554999998888')!;
    expect(joao.value).toBe('4000.50');
    expect(joao).toMatchObject({ email: 'cliente@exemplo.com', fn: 'joao', ln: 'silva', zip: '95010000', country: 'br' });
    expect(stats).toMatchObject({ customers: 2, sales: 4, revenue: 4700.5, withEmail: 1, discardedInvalidPhone: 0 });
    expect(stats.byYear).toEqual([
      { year: '2025', sales: 1, revenue: 500 },
      { year: '2026', sales: 3, revenue: 4200.5 },
    ]);
  });

  it('filtra cancelada, pendente e telefone inválido', () => {
    const { rows, stats } = aggregateCustomers([
      sale({ order_status: 'cancelado' }),
      sale({ payment_status: 'pendente' }),
      sale({ cliente_telefone: '9999-8888' }),
      sale({ total: 300 }),
    ]);
    expect(rows).toHaveLength(1);
    expect(stats.discardedInvalidPhone).toBe(1);
    expect(stats.revenue).toBe(300);
  });

  it('respeita o período', () => {
    const { stats } = aggregateCustomers([
      sale({ atendimento_data: '2026-01-15' }),
      sale({ atendimento_data: '2026-03-01' }),
    ], { from: '2026-02-01', to: '2026-12-31' });
    expect(stats.sales).toBe(1);
  });

  it('CSV tem o cabeçalho exato e texto claro', () => {
    const { rows } = aggregateCustomers([sale({ total: 8900 })]);
    expect(toCsv(rows)).toBe('phone,email,fn,ln,ct,st,zip,country,value\n5554999998888,cliente@exemplo.com,joao,silva,,,95010000,br,8900.00\n');
  });
});
