import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, FileText, Upload, Eye, Loader2, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ClienteRow {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string;
  atendimento_data: string;
  items: any;
  os_number: string;
  order_status: string;
  nota_fiscal_url: string;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('service_orders')
      .select('id, cliente_nome, cliente_telefone, cliente_email, atendimento_data, items, os_number, order_status, nota_fiscal_url')
      .order('atendimento_data', { ascending: false });
    if (data) setClientes(data as ClienteRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const filtered = clientes.filter(c =>
    c.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.cliente_telefone?.includes(search) ||
    c.cliente_email?.toLowerCase().includes(search.toLowerCase()) ||
    c.os_number?.includes(search)
  );

  const getProducts = (items: any): string => {
    if (!items || !Array.isArray(items)) return '—';
    return items.map((i: any) => i.name).filter(Boolean).join(', ') || '—';
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('service_orders')
      .update({ order_status: newStatus })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      setClientes(prev => prev.map(c => c.id === id ? { ...c, order_status: newStatus } : c));
      toast.success(newStatus === 'enviado' ? 'Marcado como Enviado' : 'Marcado como Em Produção');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;

    setUploadingId(selectedId);
    const filePath = `notas/${selectedId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Erro ao enviar nota fiscal');
      setUploadingId(null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('service_orders')
      .update({ nota_fiscal_url: urlData.publicUrl })
      .eq('id', selectedId);

    if (updateError) {
      toast.error('Erro ao salvar nota fiscal');
    } else {
      setClientes(prev => prev.map(c => c.id === selectedId ? { ...c, nota_fiscal_url: urlData.publicUrl } : c));
      toast.success('Nota fiscal anexada com sucesso');
    }
    setUploadingId(null);
    setSelectedId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileUpload = (id: string) => {
    setSelectedId(id);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'enviado') {
      return <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">Enviado</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Em Produção</Badge>;
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileUpload}
      />

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
            placeholder="Buscar cliente ou OS..."
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
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>Nota Fiscal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.cliente_nome || '—'}</TableCell>
                  <TableCell>{c.cliente_telefone || '—'}</TableCell>
                  <TableCell>{c.cliente_email || '—'}</TableCell>
                  <TableCell>{c.atendimento_data ? new Date(c.atendimento_data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{getProducts(c.items)}</TableCell>
                  <TableCell>
                    <Select
                      value={c.order_status || 'em_producao'}
                      onValueChange={(v) => handleStatusChange(c.id, v)}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="em_producao">Em Produção</SelectItem>
                        <SelectItem value="enviado">Enviado</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                        <FileText size={14} className="text-primary" />
                        {c.os_number || '—'}
                      </span>
                      {c.os_number && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => navigate(`/ordem-servico?load=${c.id}`)}
                          title="Abrir e baixar OS"
                        >
                          <Download size={14} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {c.nota_fiscal_url ? (
                        <a href={c.nota_fiscal_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                            <Eye size={14} /> Ver
                          </Button>
                        </a>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => triggerFileUpload(c.id)}
                        disabled={uploadingId === c.id}
                      >
                        {uploadingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {c.nota_fiscal_url ? 'Trocar' : 'Anexar'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
