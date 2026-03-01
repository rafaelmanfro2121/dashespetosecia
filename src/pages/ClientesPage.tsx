import React, { useState, useEffect } from 'react';
import { Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

interface ClienteRow {
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string;
  atendimento_data: string;
  items: any;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('service_orders')
        .select('cliente_nome, cliente_telefone, cliente_email, atendimento_data, items')
        .order('atendimento_data', { ascending: false });
      if (data) setClientes(data as ClienteRow[]);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = clientes.filter(c =>
    c.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.cliente_telefone?.includes(search) ||
    c.cliente_email?.toLowerCase().includes(search.toLowerCase())
  );

  const getProducts = (items: any): string => {
    if (!items || !Array.isArray(items)) return '—';
    return items.map((i: any) => i.name).filter(Boolean).join(', ') || '—';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={22} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Clientes</h1>
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="metric-card text-center py-12 text-muted-foreground text-sm">
          {search ? 'Nenhum cliente encontrado' : 'Nenhuma ordem de serviço cadastrada ainda'}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Data da Compra</TableHead>
                <TableHead>Produto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.cliente_nome || '—'}</TableCell>
                  <TableCell>{c.cliente_telefone || '—'}</TableCell>
                  <TableCell>{c.cliente_email || '—'}</TableCell>
                  <TableCell>{c.atendimento_data ? new Date(c.atendimento_data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{getProducts(c.items)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
