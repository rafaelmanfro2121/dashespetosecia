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
  unreadable: string[]; // PDFs que não parecem DANFE ou não puderam ser lidos
  duplicates: number;   // mesma chave de acesso repetida no arquivo
}

const isPdf = (name: string) => /\.pdf$/i.test(name);
const isArchive = (name: string) => /\.(rar|zip|7z)$/i.test(name);

async function readDanfe(blob: Blob): Promise<DanfeData | null> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of content.items) {
      if ('str' in it && it.str.trim()) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width });
    }
    return parseDanfe(items);
  } finally {
    await doc.destroy();
  }
}

/** Lista os PDFs: dos arquivos compactados (sem descompactar tudo de uma vez) e dos PDFs soltos. */
async function collectPdfs(files: File[]): Promise<{ name: string; load: () => Promise<Blob> }[]> {
  const out: { name: string; load: () => Promise<Blob> }[] = [];
  for (const f of files) {
    if (isPdf(f.name)) {
      out.push({ name: f.name, load: async () => f });
    } else if (isArchive(f.name)) {
      const archive = await Archive.open(f);
      const entries = await archive.getFilesArray();
      for (const e of entries) {
        const name = `${e.path}${e.file.name}`;
        if (isPdf(name)) out.push({ name, load: () => e.file.extract() });
      }
    }
  }
  return out;
}

export async function importNotes(files: File[], onProgress: (p: ImportProgress) => void): Promise<ImportResult> {
  const pdfs = await collectPdfs(files);
  const byKey = new Map<string, ParsedNote>();
  const unreadable: string[] = [];
  let duplicates = 0;

  for (let i = 0; i < pdfs.length; i++) {
    const { name, load } = pdfs[i];
    onProgress({ done: i, total: pdfs.length, current: name });
    try {
      const data = await readDanfe(await load());
      if (!data) { unreadable.push(name); continue; }
      if (byKey.has(data.chave)) { duplicates++; continue; }
      byKey.set(data.chave, { ...data, file: name.split('/').pop() ?? name });
    } catch {
      unreadable.push(name);
    }
  }
  onProgress({ done: pdfs.length, total: pdfs.length, current: '' });
  return { notes: [...byKey.values()], unreadable, duplicates };
}
