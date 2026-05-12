import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, MessageSquare, RefreshCw, Search, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface LeadFeedback {
  id: string;
  reason: string;
  source: string;
  page_path: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function LeadFeedbacks() {
  const [feedbacks, setFeedbacks] = useState<LeadFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchFeedbacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar feedbacks.");
    } else {
      setFeedbacks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const filtered = feedbacks.filter(
    (f) =>
      f.reason.toLowerCase().includes(search.toLowerCase()) ||
      (f.page_path?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum feedback para exportar.");
      return;
    }
    const csv = [
      ["Data", "Origem", "Página", "Motivo", "User Agent"].join(","),
      ...filtered.map((f) =>
        [
          format(new Date(f.created_at), "dd/MM/yyyy HH:mm"),
          f.source,
          f.page_path || "",
          `"${f.reason.replace(/"/g, '""')}"`,
          `"${(f.user_agent || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedbacks-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const sourceLabel = (source: string) => {
    switch (source) {
      case "exit_intent":
        return { label: "Saída do site", variant: "secondary" as const };
      default:
        return { label: source, variant: "outline" as const };
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Feedbacks dos Leads
            </CardTitle>
            <CardDescription>
              Respostas capturadas no popup de saída e outras pesquisas qualitativas.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchFeedbacks} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por motivo ou página..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <Badge variant="outline" className="ml-auto">
            {filtered.length} {filtered.length === 1 ? "feedback" : "feedbacks"}
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum feedback encontrado.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Data</TableHead>
                  <TableHead className="w-[140px]">Origem</TableHead>
                  <TableHead className="w-[180px]">Página</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => {
                  const src = sourceLabel(f.source);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(f.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={src.variant}>{src.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {f.page_path || "—"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-pre-wrap">{f.reason}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
