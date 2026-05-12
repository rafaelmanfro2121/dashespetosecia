import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MessageSquare, Upload, Plus, Edit, Save, X, Trash2,
  RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Zap,
  FileText, Users, BarChart3, Eye, Search, History, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Template {
  id: string;
  nome: string;
  conteudo: string;
  image_url: string | null;
  link_url: string | null;
  pre_link_message: string | null;
  created_at: string;
}

interface Recipient {
  id: string;
  telefone: string;
  nome: string | null;
  status: string;
  erro_mensagem: string | null;
  created_at: string;
}

interface SentLog {
  id: string;
  destinatario: string;
  nome: string | null;
  template_usado: string | null;
  enviado_em: string;
}

// Fixed default campaign ID - auto-created on first import
const DEFAULT_CAMPAIGN_NAME = "Disparo Automático WhatsApp";

type SubPage = "dashboard" | "import" | "templates" | "history";

interface ValidationStats {
  total: number;
  validated: number;
  valid: number;
  invalid: number;
  unvalidated: number;
}

export default function WhatsAppMarketing() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pendingRecipients, setPendingRecipients] = useState<Recipient[]>([]);
  const [errorRecipients, setErrorRecipients] = useState<Recipient[]>([]);
  const [sentLog, setSentLog] = useState<SentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [subPage, setSubPage] = useState<SubPage>("dashboard");
  const [defaultCampaignId, setDefaultCampaignId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStats, setValidationStats] = useState<ValidationStats | null>(null);

  // Template dialog
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [tplNome, setTplNome] = useState("");
  const [tplConteudo, setTplConteudo] = useState("");
  const [tplImageUrl, setTplImageUrl] = useState("");
  const [tplPreLinkMessage, setTplPreLinkMessage] = useState("");
  const [tplLinkUrl, setTplLinkUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewText, setPreviewText] = useState("");

  // Import
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search
  const [historySearch, setHistorySearch] = useState("");

  useEffect(() => { loadData(); }, []);

  // Load validation stats
  const loadValidationStats = async () => {
    const [totalRes, validatedRes, validRes, invalidRes] = await Promise.all([
      supabase.from("whatsapp_marketing_recipients").select("*", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("whatsapp_marketing_recipients").select("*", { count: "exact", head: true }).eq("status", "pendente").eq("is_validated", true),
      supabase.from("whatsapp_marketing_recipients").select("*", { count: "exact", head: true }).eq("status", "pendente").eq("is_validated", true).eq("whatsapp_exists", true),
      supabase.from("whatsapp_marketing_recipients").select("*", { count: "exact", head: true }).eq("status", "invalido"),
    ]);
    const total = totalRes.count ?? 0;
    const validated = validatedRes.count ?? 0;
    const valid = validRes.count ?? 0;
    const invalid = invalidRes.count ?? 0;
    setValidationStats({ total, validated, valid, invalid, unvalidated: total - validated });
  };

  const ensureDefaultCampaign = async (): Promise<string> => {
    if (defaultCampaignId) return defaultCampaignId;

    // Check if exists
    const { data: existing } = await supabase
      .from("whatsapp_marketing_campaigns")
      .select("id")
      .eq("nome", DEFAULT_CAMPAIGN_NAME)
      .limit(1);

    if (existing && existing.length > 0) {
      setDefaultCampaignId(existing[0].id);
      return existing[0].id;
    }

    // Create it
    const { data: created, error } = await supabase
      .from("whatsapp_marketing_campaigns")
      .insert({
        nome: DEFAULT_CAMPAIGN_NAME,
        status: "ativa",
        limite_diario: 480,
        horario_inicio: "08:00",
        horario_fim: "18:00",
      })
      .select("id")
      .single();

    if (error) throw error;
    setDefaultCampaignId(created.id);
    return created.id;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [tplRes, pendingRes, errorRes, logRes, scheduleRes, pendingCountRes, errorCountRes, sentCountRes] = await Promise.all([
        supabase.from("whatsapp_marketing_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("whatsapp_marketing_recipients").select("*").eq("status", "pendente").order("created_at", { ascending: false }).limit(500),
        supabase.from("whatsapp_marketing_recipients").select("*").eq("status", "erro").order("created_at", { ascending: false }).limit(100),
        supabase.from("marketing_enviados_log").select("*").eq("tipo", "whatsapp").order("enviado_em", { ascending: false }).limit(500),
        supabase.from("marketing_schedule_settings").select("is_active").eq("channel", "whatsapp").single(),
        supabase.from("whatsapp_marketing_recipients").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("whatsapp_marketing_recipients").select("*", { count: "exact", head: true }).eq("status", "erro"),
        supabase.from("marketing_enviados_log").select("*", { count: "exact", head: true }).eq("tipo", "whatsapp"),
      ]);
      if (tplRes.data) setTemplates(tplRes.data as unknown as Template[]);
      if (pendingRes.data) setPendingRecipients(pendingRes.data as unknown as Recipient[]);
      if (errorRes.data) setErrorRecipients(errorRes.data as unknown as Recipient[]);
      if (logRes.data) setSentLog(logRes.data as unknown as SentLog[]);
      if (scheduleRes.data) setIsPaused(!scheduleRes.data.is_active);
      setPendingCount(pendingCountRes.count ?? 0);
      setErrorCount(errorCountRes.count ?? 0);
      setSentCount(sentCountRes.count ?? 0);
      await loadValidationStats();

      // Ensure default campaign exists
      await ensureDefaultCampaign();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidateNumbers = async () => {
    setValidating(true);
    toast.info("Validando números via WhatsApp... Isso pode levar alguns minutos.");
    try {
      const { data, error } = await supabase.functions.invoke("validate-whatsapp-numbers");
      if (error) throw error;
      if (data?.success) {
        toast.success(`Validação concluída! ${data.valid} válidos, ${data.invalid} inválidos de ${data.validated} verificados.`);
        await loadData();
      } else {
        toast.error(data?.error || "Erro na validação");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao validar números.");
    } finally {
      setValidating(false);
    }
  };

  const handlePauseToggle = async () => {
    const newActive = isPaused; // if paused, we want to activate
    try {
      const { error } = await supabase
        .from("marketing_schedule_settings")
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq("channel", "whatsapp");
      if (error) throw error;
      setIsPaused(!newActive);
      toast.success(newActive ? "Envios retomados!" : "Envios pausados!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status.");
    }
  };

  const retryAllErrors = async () => {
    if (!errorRecipients.length) return;
    try {
      const { error } = await supabase
        .from("whatsapp_marketing_recipients")
        .update({
          status: "pendente",
          erro_mensagem: null,
          is_validated: false,
          whatsapp_exists: null,
          enviado_em: null,
        })
        .eq("status", "erro");
      if (error) throw error;
      toast.success(`${errorRecipients.length} números voltaram para a validação.`);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao reprocessar.");
    }
  };

  // Template CRUD
  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTplNome("");
    setTplImageUrl("");
    setTplPreLinkMessage("Esse é a *Espetos &amp; Cia* em ação.\nPara conhecer melhor: 👉");
    setTplLinkUrl("https://www.dashespetosecia.lovable.app");
    setTplConteudo(`Olá, {nome}! 👋

Você conhece a *Espetos &amp; Cia*? O sistema completo para gestão da sua clínica de fisioterapia.

✅ Agendamento online
✅ Prontuário eletrônico
✅ Controle financeiro
✅ Lembretes automáticos

Experimente grátis por 7 dias! 🚀`);
    setTemplateDialog(true);
  };

  const openEditTemplate = (tpl: Template) => {
    setEditingTemplate(tpl);
    setTplNome(tpl.nome);
    setTplConteudo(tpl.conteudo);
    setTplImageUrl(tpl.image_url || "");
    setTplPreLinkMessage(tpl.pre_link_message || "");
    setTplLinkUrl(tpl.link_url || "");
    setTemplateDialog(true);
  };

  const handleTemplateImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB."); return; }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `whatsapp-templates/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("email-assets").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("email-assets").getPublicUrl(path);
      setTplImageUrl(pub.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar imagem.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const saveTemplate = async () => {
    if (!tplNome || !tplConteudo) { toast.error("Preencha nome e mensagem."); return; }
    if (tplLinkUrl && !/^https?:\/\//i.test(tplLinkUrl)) { toast.error("URL do link deve começar com http(s)://"); return; }
    if (tplImageUrl && !/^https?:\/\//i.test(tplImageUrl)) { toast.error("URL da imagem inválida."); return; }
    setSavingTpl(true);
    try {
      const payload = {
        nome: tplNome,
        conteudo: tplConteudo,
        image_url: tplImageUrl || null,
        pre_link_message: tplPreLinkMessage || null,
        link_url: tplLinkUrl || null,
      };
      if (editingTemplate) {
        const { error } = await supabase.from("whatsapp_marketing_templates").update(payload).eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Template atualizado!");
      } else {
        const { error } = await supabase.from("whatsapp_marketing_templates").insert(payload);
        if (error) throw error;
        toast.success("Template criado!");
      }
      setTemplateDialog(false);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar template.");
    } finally { setSavingTpl(false); }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    const { error } = await supabase.from("whatsapp_marketing_templates").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Template excluído!");
    await loadData();
  };

  // Normalize phone
  const normalizePhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return digits;
  };

  // File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportText(ev.target?.result as string);
    reader.readAsText(file);
  };

  // Import with dedup against sent log
  const handleImport = async () => {
    if (!importText.trim()) { toast.error("Insira os números."); return; }
    setImporting(true);
    try {
      const campaignId = await ensureDefaultCampaign();

      const lines = importText.split(/[\n;]+/).map(l => l.trim()).filter(Boolean);
      const entries: { telefone: string; nome: string | null }[] = [];
      const seen = new Set<string>();

      // Get already sent numbers to skip
      const { data: alreadySent } = await supabase
        .from("marketing_enviados_log")
        .select("destinatario")
        .eq("tipo", "whatsapp");
      const sentSet = new Set((alreadySent || []).map(s => s.destinatario));

      let skippedDupes = 0;

      for (const line of lines) {
        const parts = line.split(/[,;\t]+/).map(p => p.trim());
        let telefone = "";
        let nome: string | null = null;

        if (parts.length >= 2) {
          const phoneIdx = parts.findIndex(p => /\d{8,}/.test(p.replace(/\D/g, "")));
          if (phoneIdx >= 0) {
            telefone = normalizePhone(parts[phoneIdx]);
            nome = parts[phoneIdx === 0 ? 1 : 0] || null;
          } else {
            telefone = normalizePhone(parts[0]);
          }
        } else {
          telefone = normalizePhone(parts[0]);
        }

        if (telefone.length >= 10 && !seen.has(telefone)) {
          if (sentSet.has(telefone)) {
            skippedDupes++;
            continue;
          }
          seen.add(telefone);
          entries.push({ telefone, nome });
        }
      }

      if (entries.length === 0) {
        toast.error(skippedDupes > 0 ? `Todos os ${skippedDupes} números já foram enviados anteriormente.` : "Nenhum número válido encontrado.");
        setImporting(false);
        return;
      }

      const rows = entries.map(e => ({
        campaign_id: campaignId,
        telefone: e.telefone,
        nome: e.nome,
        status: "pendente",
      }));

      let imported = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { data } = await supabase
          .from("whatsapp_marketing_recipients")
          .upsert(batch, { onConflict: "campaign_id,telefone", ignoreDuplicates: true })
          .select();
        imported += data?.length || 0;
      }

      toast.success(`${imported} números importados!${skippedDupes > 0 ? ` ${skippedDupes} já enviados anteriormente (ignorados).` : ""}`);
      setImportText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error("Erro na importação.");
    } finally { setImporting(false); }
  };

  const deleteRecipient = async (id: string) => {
    const { error } = await supabase.from("whatsapp_marketing_recipients").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover."); return; }
    toast.success("Removido!");
    setPendingRecipients(prev => prev.filter(r => r.id !== id));
    setErrorRecipients(prev => prev.filter(r => r.id !== id));
  };

  const triggerSend = async () => {
    // Check if there are unvalidated numbers
    if (validationStats && validationStats.unvalidated > 0) {
      toast.error(`Ainda há ${validationStats.unvalidated} números não validados. Valide todos antes de disparar.`);
      return;
    }
    if (validationStats && validationStats.valid === 0) {
      toast.error("Nenhum número válido para enviar.");
      return;
    }
    toast.info("Disparando mensagens de WhatsApp Marketing...");
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-marketing", { body: { force: true } });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Disparo concluído! ${data.sent} enviados, ${data.errors} erros.`);
        await loadData();
      } else {
        toast.error(data?.error || data?.message || "Não foi possível iniciar o disparo.");
        await loadData();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao disparar.");
    }
  };

  const filteredHistory = useMemo(() => {
    if (!historySearch) return sentLog;
    const q = historySearch.toLowerCase();
    return sentLog.filter(s => s.destinatario.includes(q) || s.nome?.toLowerCase().includes(q));
  }, [sentLog, historySearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-success" />
            WhatsApp Marketing
          </h2>
          <p className="text-sm text-muted-foreground">
            Importe → Valide → Dispare com segurança anti-bloqueio
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePauseToggle} className="gap-1.5">
            {isPaused ? <Zap className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4 text-warning" />}
            {isPaused ? "Retomar Envios" : "Pausar Envios"}
          </Button>
          <Button size="sm" onClick={triggerSend} disabled={isPaused} className="bg-success hover:bg-success/90 text-success-foreground">
            <Zap className="w-4 h-4 mr-2" />
            Disparar Agora
          </Button>
        </div>
      </div>

      {/* Validation Status Banner */}
      {validationStats && validationStats.total > 0 && (
        <Card className={validationStats.unvalidated > 0 ? "border-warning" : "border-success"}>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                {validationStats.unvalidated > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-success shrink-0" />
                )}
                <div className="text-sm">
                  <span className="font-semibold text-success">{validationStats.valid}</span> válidos
                  {" · "}
                  <span className="font-semibold text-destructive">{validationStats.invalid}</span> inválidos
                  {validationStats.unvalidated > 0 && (
                    <>
                      {" · "}
                      <span className="font-semibold text-warning">{validationStats.unvalidated}</span> aguardando validação
                    </>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={validationStats.unvalidated > 0 ? "default" : "outline"}
                onClick={handleValidateNumbers}
                disabled={validating || validationStats.unvalidated === 0}
                className="gap-1.5"
              >
                {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {validating ? "Validando..." : validationStats.unvalidated > 0 ? `Validar ${validationStats.unvalidated} Números` : "Todos Validados ✓"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anti-block info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Proteção anti-bloqueio ativa:</strong> Intervalos aleatórios (10-60s), pausa de 3-6min a cada 5 msgs,
              delay de início 15-30min, rotação de templates sem repetição, variação automática de texto e indicador "digitando...".
              Somente números validados com WhatsApp ativo recebem mensagens.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={subPage} onValueChange={(v) => setSubPage(v as SubPage)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-1.5">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Importar</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-warning/10 rounded-lg">
                    <Clock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-success/10 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sentCount}</p>
                    <p className="text-xs text-muted-foreground">Total Enviados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-destructive/10 rounded-lg">
                    <XCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{errorCount}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-lg">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{templates.length}</p>
                    <p className="text-xs text-muted-foreground">Templates</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-success" />
                Como Funciona
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>1️⃣ <strong>Importe números</strong> — cole ou envie um arquivo CSV/TXT</p>
                <p>2️⃣ <strong>Configure templates</strong> — crie pelo menos 10 para rotação automática</p>
                <p>3️⃣ <strong>Envio automático</strong> — com limites diário e por hora configuráveis, em horário comercial</p>
                <p>4️⃣ <strong>Após enviar</strong> — o número é removido da fila e salvo no histórico (nunca repete)</p>
              </div>
            </CardContent>
          </Card>

          {/* Pending list */}
          {pendingRecipients.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fila de Envio ({pendingRecipients.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRecipients.slice(0, 20).map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-sm">{r.telefone}</TableCell>
                          <TableCell>{r.nome || "—"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => deleteRecipient(r.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {pendingRecipients.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      e mais {pendingRecipients.length - 20} números...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {errorRecipients.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-destructive">Erros de Envio ({errorRecipients.length})</CardTitle>
                  <Button size="sm" variant="outline" onClick={retryAllErrors} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reenviar Todos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorRecipients.slice(0, 10).map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-sm">{r.telefone}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate">{r.erro_mensagem || "Erro desconhecido"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => deleteRecipient(r.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* IMPORT */}
        <TabsContent value="import" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Importar Números</CardTitle>
              <CardDescription>
                Cole números ou envie um arquivo. Números já enviados anteriormente serão ignorados automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Arquivo CSV/TXT (opcional)</Label>
                <Input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleFileUpload} className="mt-1" />
              </div>
              <div>
                <Label>Números (um por linha, formato: telefone ou nome,telefone)</Label>
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`11999887766\nJoão,11988776655\n55219876543210`}
                  rows={10}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <Button onClick={handleImport} disabled={importing || !importText.trim()}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importing ? "Importando..." : "Importar Números"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Templates de Mensagem</CardTitle>
                <CardDescription>Crie pelo menos 10 templates para rotação automática</CardDescription>
              </div>
              <Button size="sm" onClick={openNewTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum template criado.</p>
                  <Button size="sm" className="mt-4" onClick={openNewTemplate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Template
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((tpl, idx) => (
                    <div key={tpl.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success/10 text-success font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{tpl.nome}</p>
                          {tpl.image_url && <Badge variant="secondary" className="text-xs">📷 Imagem</Badge>}
                          {tpl.link_url && <Badge variant="secondary" className="text-xs">🔗 Link</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{tpl.conteudo}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => { setPreviewText(tpl.conteudo.replace(/\{nome\}/g, "João")); setPreviewDialog(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditTemplate(tpl)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTemplate(tpl.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Histórico de Envios</CardTitle>
                <CardDescription>{sentCount} números enviados (nunca serão repetidos)</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="pl-9" />
              </div>
            </CardHeader>
            <CardContent>
              {filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum envio registrado ainda.</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Enviado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-sm">{s.destinatario}</TableCell>
                          <TableCell>{s.nome || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{s.template_usado || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(s.enviado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
            <DialogDescription>
              Sequência humanizada: 1) mensagem, 2) imagem (opcional), 3) link (opcional). Use {"{nome}"} para personalizar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Template</Label>
              <Input value={tplNome} onChange={(e) => setTplNome(e.target.value)} placeholder="Ex: Template A" className="mt-1" />
            </div>
            <div>
              <Label>1. Mensagem</Label>
              <Textarea value={tplConteudo} onChange={(e) => setTplConteudo(e.target.value)} rows={7} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">{tplConteudo.length} caracteres — evite incluir links aqui (use o campo abaixo).</p>
            </div>
            <div>
              <Label>2. Imagem (opcional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="url"
                  value={tplImageUrl}
                  onChange={(e) => setTplImageUrl(e.target.value)}
                  placeholder="https://... ou faça upload"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" disabled={uploadingImage} asChild>
                  <label className="cursor-pointer">
                    {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleTemplateImageUpload} />
                  </label>
                </Button>
                {tplImageUrl && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setTplImageUrl("")}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {tplImageUrl && (
                <img src={tplImageUrl} alt="Preview" className="mt-2 max-h-40 rounded border" />
              )}
            </div>
            <div>
              <Label>3. Mensagem antes do link (opcional)</Label>
              <Textarea
                value={tplPreLinkMessage}
                onChange={(e) => setTplPreLinkMessage(e.target.value)}
                rows={3}
                placeholder="Ex: Esse é a *Espetos &amp; Cia* em ação. Para conhecer melhor: 👉"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Enviada logo antes do link, separadamente.</p>
            </div>
            <div>
              <Label>4. Link de acesso (opcional)</Label>
              <Input
                type="url"
                value={tplLinkUrl}
                onChange={(e) => setTplLinkUrl(e.target.value)}
                placeholder="https://www.dashespetosecia.lovable.app"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Enviado sozinho, sem preview de site, para parecer mais natural.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancelar</Button>
            <Button onClick={saveTemplate} disabled={savingTpl}>
              {savingTpl ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
          </DialogHeader>
          <div className="bg-[#e5ddd5] rounded-lg p-4">
            <div className="bg-[#dcf8c6] rounded-lg p-3 max-w-[85%] ml-auto shadow-sm">
              <p className="text-sm whitespace-pre-wrap">{previewText}</p>
              <p className="text-[10px] text-muted-foreground text-right mt-1">agora ✓✓</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
