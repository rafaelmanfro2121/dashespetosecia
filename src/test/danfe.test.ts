import { describe, it, expect } from 'vitest';
import { parseDanfe, isSaleNote, parseBrMoney, type TextItem } from '@/lib/danfe';
import { aggregateCustomers } from '../../supabase/functions/_shared/meta';

// Mesma disposição de uma DANFE retrato A4 real (posições do pdf.js), com dados fictícios.
const t = (y: number, x: number, str: string): TextItem => ({ str, x, y, w: str.length * 4 });
const danfe: TextItem[] = [
  t(813, 490, 'NF-e'), t(798, 441, 'Nº 028.045.089'),
  t(739, 97, 'MANFRO EQUIPAMENTOS'),
  t(714, 377, 'CHAVE DE ACESSO'), t(704, 383, '4322 0627 5250 8300 0199 5500 1028 0450 8919 0047 6618'),
  t(659, 36, 'NATUREZA DA OPERAÇÃO'), t(649, 35, 'Venda de mercadoria'),
  t(640, 321, 'CNPJ / CPF'), t(630, 321, '27.525.083/0001-99'), // CNPJ do emitente: não pode ser lido como do cliente
  t(616, 34, 'DESTINATÁRIO/REMETENTE'),
  t(607, 36, 'NOME/RAZÃO SOCIAL'), t(607, 390, 'CNPJ/CPF'), t(607, 487, 'DATA DA EMISSÃO'),
  t(597, 36, 'Fulano de Tal'), t(597, 389, '111.222.333-44'), t(597, 487, '15/06/2022'),
  t(587, 36, 'ENDEREÇO'), t(587, 272, 'BAIRRO/DISTRITO'), t(587, 414, 'CEP'), t(587, 486, 'DATA DE ENTRADA/SAÍDA'),
  t(577, 35, 'Rua Exemplo, 100'), t(577, 273, 'Centro'), t(577, 413, '88811-610'),
  t(567, 36, 'MUNÍCIPIO'), t(567, 273, 'FONE/FAX'), t(567, 365, 'UF'), t(567, 390, 'INSCRIÇÃO ESTADUAL'),
  t(557, 35, 'Criciúma'), t(557, 272, '(48) 99999-0000'), t(557, 369, 'SC'),
  t(541, 34, 'FATURA'),
  t(480, 378, 'VALOR DO IPI'), t(480, 473, 'VALOR TOTAL DA NOTA'),
  t(470, 447, '0,00'), t(470, 535, '2.540,00'),
  t(446, 447, 'UF'), t(436, 447, 'RS'), // UF do transportador: fora do bloco do destinatário
];

describe('parseDanfe', () => {
  it('lê os dados do destinatário, a chave e o total', () => {
    expect(parseDanfe(danfe)).toEqual({
      chave: '43220627525083000199550010280450891900476618',
      numero: '028045089',
      emissao: '2022-06-15',
      natureza: 'Venda de mercadoria',
      nome: 'Fulano de Tal',
      documento: '111.222.333-44',
      endereco: 'Rua Exemplo, 100',
      bairro: 'Centro',
      cep: '88811610',
      cidade: 'Criciúma',
      uf: 'SC',
      telefone: '(48) 99999-0000',
      email: '',
      total: 2540,
    });
  });

  it('PDF que não é DANFE retorna null', () => {
    expect(parseDanfe([t(700, 50, 'Orçamento'), t(680, 50, 'Total 1.000,00')])).toBeNull();
  });

  it('valor em reais', () => {
    expect(parseBrMoney('12.345,67')).toBe(12345.67);
    expect(parseBrMoney('980,00')).toBe(980);
  });

  it('devolução e remessa não contam como venda', () => {
    expect(isSaleNote({ natureza: 'Venda de mercadoria' })).toBe(true);
    expect(isSaleNote({ natureza: 'Devolução de venda' })).toBe(false);
    expect(isSaleNote({ natureza: 'Remessa para conserto' })).toBe(false);
  });

  it('cidade e UF da nota entram no CSV', () => {
    const { rows } = aggregateCustomers([{
      id: 'nf', cliente_nome: 'Fulano de Tal', cliente_telefone: '(48) 99999-0000', cliente_email: '',
      cliente_contato: 'Rua Exemplo, 100 - 88811610', total: 2540, payment_status: 'pago', order_status: 'historico',
      atendimento_data: '2022-06-15', cidade: 'Criciúma', uf: 'SC',
    }]);
    expect(rows[0]).toMatchObject({ phone: '5548999990000', ct: 'criciuma', st: 'sc', zip: '88811610', value: '2540.00' });
  });
});
