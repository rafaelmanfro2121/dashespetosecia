// Leitura da DANFE (PDF da NF-e) a partir dos textos e posições extraídos pelo pdf.js.
// Na DANFE cada valor fica logo abaixo do seu rótulo, na mesma coluna.

export interface TextItem {
  str: string;
  x: number; // esquerda
  y: number; // base da linha (cresce para cima, como no PDF)
  w: number;
}

export interface DanfeData {
  chave: string;          // chave de acesso (44 dígitos), usada para não importar a mesma nota 2x
  numero: string;
  emissao: string | null; // AAAA-MM-DD
  natureza: string;
  nome: string;
  documento: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  total: number;
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const LINE_TOL = 2.5;      // itens na mesma linha
const VALUE_MIN_GAP = 6;   // valor fica abaixo do rótulo (rótulos vizinhos desalinhados ficam a ~4)...
const VALUE_MAX_GAP = 16;  // ...no máximo uma linha abaixo

function findLabel(items: TextItem[], label: RegExp, within?: { top: number; bottom: number }): TextItem | undefined {
  return items
    .filter(i => label.test(norm(i.str)))
    .filter(i => !within || (i.y < within.top && i.y > within.bottom))
    .sort((a, b) => b.y - a.y)[0];
}

/** Valor logo abaixo do rótulo, limitado à coluna do rótulo (até o próximo rótulo da mesma linha). */
function valueBelow(items: TextItem[], label: TextItem | undefined): string {
  if (!label) return '';
  const nextOnRow = items
    .filter(i => Math.abs(i.y - label.y) <= LINE_TOL && i.x > label.x + 1)
    .reduce((min, i) => Math.min(min, i.x), Infinity);
  const left = label.x - 6;
  const right = nextOnRow - 2;
  const gap = (i: TextItem) => label.y - i.y;
  const candidates = items.filter(i => gap(i) >= VALUE_MIN_GAP && gap(i) <= VALUE_MAX_GAP && i.x >= left && i.x < right);
  if (!candidates.length) return '';
  const topY = Math.max(...candidates.map(i => i.y)); // só a primeira linha abaixo
  return candidates
    .filter(i => Math.abs(i.y - topY) <= LINE_TOL)
    .sort((a, b) => a.x - b.x)
    .map(i => i.str.trim())
    .join(' ')
    .trim();
}

export function parseBrMoney(s: string): number {
  const m = s.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/);
  if (!m) return 0;
  return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
}

function toIsoDate(s: string): string | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Chave de acesso: de preferência o número logo abaixo do rótulo; senão, 44 dígitos seguidos em um mesmo texto. */
function findChave(items: TextItem[], all: string): string {
  const below = valueBelow(items, findLabel(items, /^CHAVE DE ACESSO/)).replace(/\D/g, '');
  if (below.length === 44) return below;
  for (const i of items) {
    const digits = i.str.replace(/[\s.]/g, '');
    const m = digits.match(/\d{44}/);
    if (m) return m[0];
  }
  // Último recurso: grupos de 4 dígitos (formato impresso da chave) no texto todo.
  return (all.match(/(?:\d{4}[ .]){10}\d{4}/)?.[0] ?? '').replace(/\D/g, '');
}

/** Retorna null quando o texto não parece uma DANFE (sem chave de acesso ou sem destinatário). */
export function parseDanfe(items: TextItem[]): DanfeData | null {
  const all = items.map(i => i.str).join(' ');
  const chave = findChave(items, all);
  const dest = findLabel(items, /^DESTINATARIO(\s*\/\s*REMETENTE)?$/);
  if (chave.length !== 44 || !dest) return null;

  // Bloco do destinatário: do título até o próximo bloco (FATURA / DUPLICATAS / CÁLCULO DO IMPOSTO).
  const nextBlock = items
    .filter(i => i.y < dest.y && /^(FATURA|DUPLICATAS?|FATURA\s*\/\s*DUPLICATAS?|CALCULO DO IMPOSTO)\b/.test(norm(i.str)))
    .reduce((max, i) => Math.max(max, i.y), -Infinity);
  const region = { top: dest.y, bottom: Number.isFinite(nextBlock) ? nextBlock : dest.y - 80 };
  const d = (re: RegExp) => valueBelow(items, findLabel(items, re, region));

  const numero = (all.match(/N[º°o]\.?\s*([\d.]{5,})/)?.[1] ?? '').replace(/\./g, '');
  const dadosAdic = findLabel(items, /^DADOS ADICIONAIS$/);
  const emailArea = dadosAdic ? items.filter(i => i.y < dadosAdic.y).map(i => i.str).join(' ') : '';

  return {
    chave,
    numero,
    emissao: toIsoDate(d(/^DATA( D[AE])? (DA )?EMISSAO$/)),
    natureza: valueBelow(items, findLabel(items, /^NATUREZA DA OPERACAO$/)),
    nome: d(/^(NOME\s*\/\s*)?RAZAO SOCIAL(\s*\/\s*NOME)?$|^NOME$/),
    documento: d(/^(CNPJ\s*\/\s*CPF|CPF\s*\/\s*CNPJ)$/),
    endereco: d(/^ENDERECO$|^LOGRADOURO$/),
    bairro: d(/^BAIRRO(\s*\/\s*DISTRITO)?$/),
    cep: d(/^CEP$/).replace(/\D/g, ''),
    cidade: d(/^MUNICIPIO$/),
    uf: d(/^UF$/).toUpperCase().slice(0, 2),
    telefone: d(/^(FONE|TELEFONE)(\s*\/\s*FAX)?$/),
    email: emailArea.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase() ?? '',
    total: parseBrMoney(valueBelow(items, findLabel(items, /^VALOR TOTAL DA NOTA$/))),
  };
}

/** Notas que não são venda (devolução, remessa, retorno…) não entram como compra do cliente. */
export function isSaleNote(n: Pick<DanfeData, 'natureza'>): boolean {
  const nat = norm(n.natureza);
  if (!nat) return true;
  return !/DEVOLU|REMESSA|RETORNO|CONSERTO|DEMONSTRA|BONIFICA|TRANSFER|ESTORNO|CANCEL/.test(nat);
}
