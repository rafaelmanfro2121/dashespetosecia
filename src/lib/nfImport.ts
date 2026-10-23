// Importação de notas fiscais (DANFE em PDF) direto no navegador.
// Aceita .rar, .zip, .7z ou PDFs soltos. Nada é enviado para fora: só os dados extraídos vão para o banco.
import { Archive } from 'libarchive.js';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseDanfe, type DanfeData, type TextItem } from './danfe';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
Archive.init({ workerUrl: new URL(`${import.meta.env.BASE_URL}libarchive/worker-bundle.js`, window.location.href) });

export interface ParsedNote extends DanfeData {
  file: string;
}

export interface ImportProgress {
  done: number;
  total: number;
  current: string;
}

export interface ImportResult {
  notes: ParsedNote[];
  pdfs: number;         // PDFs encontrados
  pages: number;        // páginas lidas
  unreadable: string[]; // PDFs que não parecem DANFE ou não puderam ser lidos
  duplicates: number;   // mesma chave de acesso repetida no arquivo
}

const isPdf = (name: string) => /\.pdf$/i.test(name);
const isArchive = (name: string) => /\.(rar|zip|7z)$/i.test(name);

/** Lê todas as páginas: um PDF pode ter várias notas (uma por página) ou uma nota com várias páginas. */
async function readDanfes(blob: Blob): Promise<{ notes: DanfeData[]; pages: number }> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  try {
    const notes: DanfeData[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const it of content.items) {
        if ('str' in it && it.str.trim()) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width });
      }
      const data = parseDanfe(items);
      if (data) notes.push(data);
      page.cleanup();
    }
    return { notes, pages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

type PdfSource = { name: string; load: () => Promise<Blob> };

/** Percorre a árvore devolvida pelo libarchive ({ pasta: { arquivo.pdf: File } }). */
function flattenTree(tree: Record<string, unknown>, prefix = ''): { name: string; file: File }[] {
  const out: { name: string; file: File }[] = [];
  for (const [key, value] of Object.entries(tree)) {
    if (value instanceof File) out.push({ name: prefix + key, file: value });
    else if (value && typeof value === 'object') out.push(...flattenTree(value as Record<string, unknown>, `${prefix}${key}/`));
  }
  return out;
}

/**
 * Lista os PDFs dos arquivos soltos e dos compactados (inclusive compactado dentro de compactado).
 * O compactado é descompactado numa passada só: extrair arquivo por arquivo relê o .rar desde o
 * início a cada nota e esgota a memória do navegador em arquivos grandes.
 */
async function collectPdfs(files: File[], onStatus: (msg: string) => void, depth = 0): Promise<PdfSource[]> {
  const out: PdfSource[] = [];
  for (const f of files) {
    if (isPdf(f.name)) {
      out.push({ name: f.name, load: async () => f });
    } else if (isArchive(f.name) && depth < 3) {
      onStatus(`Descompactando ${f.name}... (arquivos grandes levam alguns minutos)`);
      const archive = await Archive.open(f);
      const entries = flattenTree(await archive.extractFiles());
      for (const { name, file } of entries) {
        if (isPdf(name)) out.push({ name, load: async () => file });
        else if (isArchive(name)) out.push(...(await collectPdfs([file], onStatus, depth + 1)));
      }
    }
  }
  return out;
}

export async function importNotes(files: File[], onProgress: (p: ImportProgress) => void): Promise<ImportResult> {
  const pdfs = await collectPdfs(files, msg => onProgress({ done: 0, total: 0, current: msg }));
  const byKey = new Map<string, ParsedNote>();
  const unreadable: string[] = [];
  let duplicates = 0;

  let pages = 0;
  for (let i = 0; i < pdfs.length; i++) {
    const { name, load } = pdfs[i];
    onProgress({ done: i, total: pdfs.length, current: name });
    try {
      const r = await readDanfes(await load());
      pages += r.pages;
      if (!r.notes.length) { unreadable.push(name); continue; }
      for (const data of r.notes) {
        // Continuação de uma nota (página 2, 3...) repete a chave: não conta como repetida.
        if (byKey.has(data.chave)) {
          if (byKey.get(data.chave)!.file !== (name.split('/').pop() ?? name)) duplicates++;
          continue;
        }
        byKey.set(data.chave, { ...data, file: name.split('/').pop() ?? name });
      }
    } catch {
      unreadable.push(name);
    }
  }
  onProgress({ done: pdfs.length, total: pdfs.length, current: '' });
  return { notes: [...byKey.values()], pdfs: pdfs.length, pages, unreadable, duplicates };
}
