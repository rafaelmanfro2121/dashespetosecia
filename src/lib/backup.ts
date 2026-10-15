import { supabase } from '@/integrations/supabase/client';

// Todas as tabelas do banco (schema public).
const TABLES = [
  'attendance', 'categories', 'email_automation_logs', 'email_automation_templates',
  'email_automation_users', 'email_marketing_campaigns', 'email_marketing_recipients',
  'email_marketing_templates', 'employees', 'fixed_costs', 'inventory', 'lead_feedback',
  'marketing_enviados_log', 'marketing_schedule_settings', 'material_purchases',
  'monthly_closings', 'product_materials', 'products', 'profiles', 'salary_payments',
  'service_orders', 'transactions', 'user_roles', 'vales', 'warranty_costs',
  'whatsapp_marketing_campaigns', 'whatsapp_marketing_recipients', 'whatsapp_marketing_templates',
] as const;

const PAGE = 1000;
const SQL_CHUNK = 500;

type Row = Record<string, unknown>;

async function fetchAll(table: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)(table).select('*').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function dollarTag(text: string): string {
  let tag = 'bk';
  while (text.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$`;
}

// Gera um SQL para colar no SQL Editor do novo Supabase.
// json_populate_recordset converte cada valor para o tipo certo da coluna (datas, arrays, jsonb...).
export function buildSql(data: Record<string, Row[]>, exportedAt: string): string {
  const out: string[] = [
    `-- Backup Espetos & Cia — ${exportedAt}`,
    '-- Cole no SQL Editor do Supabase novo (depois de criar as tabelas) e clique em Run.',
    '-- Apaga o conteúdo atual dessas tabelas e coloca o do backup.',
    'BEGIN;',
    '-- Desliga as checagens de chave estrangeira e os gatilhos durante a importação.',
    'SET LOCAL session_replication_role = replica;',
  ];
  for (const [table, rows] of Object.entries(data)) {
    out.push('', `TRUNCATE public.${table} CASCADE;`);
    for (let i = 0; i < rows.length; i += SQL_CHUNK) {
      const json = JSON.stringify(rows.slice(i, i + SQL_CHUNK));
      const tag = dollarTag(json);
      out.push(
        `INSERT INTO public.${table} SELECT * FROM json_populate_recordset(NULL::public.${table}, ${tag}${json}${tag});`,
      );
    }
  }
  out.push('', 'COMMIT;', '');
  return out.join('\n');
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface BackupResult {
  totalRows: number;
  failed: { table: string; message: string }[];
}

export async function downloadFullBackup(): Promise<BackupResult> {
  const exportedAt = new Date().toISOString();
  const data: Record<string, Row[]> = {};
  const failed: BackupResult['failed'] = [];

  for (const table of TABLES) {
    try {
      data[table] = await fetchAll(table);
    } catch (err) {
      failed.push({ table, message: (err as { message?: string }).message ?? String(err) });
    }
  }

  const stamp = exportedAt.slice(0, 10);
  download(
    `backup-espetos-${stamp}.json`,
    JSON.stringify({ exported_at: exportedAt, source: import.meta.env.VITE_SUPABASE_URL, failed, tables: data }, null, 2),
    'application/json',
  );
  download(`backup-espetos-${stamp}.sql`, buildSql(data, exportedAt), 'application/sql');

  const totalRows = Object.values(data).reduce((n, rows) => n + rows.length, 0);
  return { totalRows, failed };
}
