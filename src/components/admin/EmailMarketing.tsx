import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Mail, Upload, Plus, Edit, Save, X, Trash2,
  RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Zap,
  FileText, Users, BarChart3, Eye, Search, History,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  assunto: string;
  conteudo_html: string;
  created_at: string;
}

interface Recipient {
  id: string;
  email: string;
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

const DEFAULT_CAMPAIGN_NAME = "Disparo Automático Email";

type SubPage = "dashboard" | "import" | "templates" | "history";

export default function EmailMarketing() {
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

  // Template dialog
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [tplNome, setTplNome] = useState("");
  const [tplAssunto, setTplAssunto] = useState("");
  const [tplConteudo, setTplConteudo] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const contentEditableRef = useRef<HTMLDivElement>(null);

  // Import
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search
  const [historySearch, setHistorySearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const ensureDefaultCampaign = async (): Promise<string> => {
    if (defaultCampaignId) return defaultCampaignId;

    const { data: existing } = await supabase
      .from("email_marketing_campaigns")
      .select("id")
      .eq("nome", DEFAULT_CAMPAIGN_NAME)
      .limit(1);

    if (existing && existing.length > 0) {
      setDefaultCampaignId(existing[0].id);
      return existing[0].id;
    }

    const { data: created, error } = await supabase
      .from("email_marketing_campaigns")
      .insert({
        nome: DEFAULT_CAMPAIGN_NAME,
        status: "ativa",
        limite_diario: 35,
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
      const [tplRes, pendingRes, errorRes, logRes, pendingCountRes, errorCountRes, sentCountRes] = await Promise.all([
        supabase.from("email_marketing_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("email_marketing_recipients").select("*").eq("status", "pendente").order("created_at", { ascending: false }).limit(500),
        supabase.from("email_marketing_recipients").select("*").eq("status", "erro").order("created_at", { ascending: false }).limit(100),
        supabase.from("marketing_enviados_log").select("*").eq("tipo", "email").order("enviado_em", { ascending: false }).limit(500),
        supabase.from("email_marketing_recipients").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("email_marketing_recipients").select("*", { count: "exact", head: true }).eq("status", "erro"),
        supabase.from("marketing_enviados_log").select("*", { count: "exact", head: true }).eq("tipo", "email"),
      ]);
      if (tplRes.data) setTemplates(tplRes.data as unknown as Template[]);
      if (pendingRes.data) setPendingRecipients(pendingRes.data as unknown as Recipient[]);
      if (errorRes.data) setErrorRecipients(errorRes.data as unknown as Recipient[]);
      if (logRes.data) setSentLog(logRes.data as unknown as SentLog[]);
      setPendingCount(pendingCountRes.count ?? 0);
      setErrorCount(errorCountRes.count ?? 0);
      setSentCount(sentCountRes.count ?? 0);

      await ensureDefaultCampaign();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados.");
    } finally { setLoading(false); }
  };

  // Template CRUD
  const EMAIL_WRAPPER_START = `<div style="max-width:600px;margin:0 auto;font-family:'DM Sans','Segoe UI',Arial,sans-serif;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#1a9a8a,#22b8a5);padding:36px 30px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;">ESPETOS &amp; CIA</h1>
    <p style="color:#b2f0e8;margin:10px 0 0;font-size:14px;font-weight:400;">Gestão inteligente do seu negócio</p>
  </div>
  <div style="padding:35px 30px;">`;

  const EMAIL_WRAPPER_END = `</div>
  <div style="background:#f0faf8;padding:22px;text-align:center;border-top:1px solid #d4efe9;">
    <p style="color:#7fa8a0;font-size:12px;margin:0;">© ${new Date().getFullYear()} Espetos &amp; Cia · dashespetosecia.lovable.app</p>
  </div>
</div>`;

  const EMAIL_CTA_URL = "https://www.dashespetosecia.lovable.app";
  const EMAIL_CTA_LABEL = "Conhecer a Espetos &amp; Cia";

  const defaultBodyContent = `<h2>Olá, {nome}!</h2><p>Seu conteúdo aqui...</p>`;

  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const getPlainTextFromHtml = (html: string) => {
    if (typeof DOMParser === "undefined") {
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    return new DOMParser()
      .parseFromString(html, "text/html")
      .body.textContent?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() || "";
  };

  const getWrappedBodyContent = (html: string): string => {
    const startMarker = 'padding:35px 30px;">';
    const endMarker = '</div>\n  <div style="background:#f0faf8';
    const altEndMarker = '</div><div style="background:#f0faf8';

    let startIdx = html.indexOf(startMarker);
    if (startIdx === -1) return html;
    startIdx += startMarker.length;

    let endIdx = html.indexOf(endMarker, startIdx);
    if (endIdx === -1) endIdx = html.indexOf(altEndMarker, startIdx);
    if (endIdx === -1) {
      const footerIdx = html.lastIndexOf('<div style="background:#f0faf8');
      if (footerIdx > startIdx) endIdx = footerIdx - 6;
      else return html;
    }

    return html.substring(startIdx, endIdx).trim();
  };

  const serializeEditorInline = (parent: ParentNode): string => {
    return Array.from(parent.childNodes).map((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return escapeHtml((child.textContent ?? "").replace(/\u00a0/g, " "));
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return "";

      const element = child as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const inner = serializeEditorInline(element);

      if (tag === "br") return "<br>";
      if (tag === "a") {
        const href = element.getAttribute("href")?.trim();
        if (!href || href === EMAIL_CTA_URL) return inner;
        return `<a href="${escapeHtml(href)}">${inner || escapeHtml(element.textContent ?? href)}</a>`;
      }
      if (["strong", "b"].includes(tag)) return `<strong>${inner}</strong>`;
      if (["em", "i"].includes(tag)) return `<em>${inner}</em>`;
      if (tag === "u") return `<u>${inner}</u>`;

      return inner || escapeHtml(element.textContent ?? "");
    }).join("");
  };

  const serializeEditorBlock = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\u00a0/g, " ").trim();
      return text ? `<p>${escapeHtml(text)}</p>` : "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (["h1", "h2", "h3"].includes(tag)) {
      const inner = serializeEditorInline(element).trim();
      return inner ? `<h2>${inner}</h2>` : "";
    }

    if (tag === "p") {
      const inner = serializeEditorInline(element).trim();
      return inner ? `<p>${inner}</p>` : "";
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child) => {
          const inner = serializeEditorInline(child).trim();
          return inner ? `<li>${inner}</li>` : "";
        })
        .join("");

      return items ? `<${tag}>${items}</${tag}>` : "";
    }

    if (tag === "div") {
      const blockChildren = Array.from(element.childNodes).map(serializeEditorBlock).join("");
      if (blockChildren) return blockChildren;

      const inner = serializeEditorInline(element).trim();
      return inner ? `<p>${inner}</p>` : "";
    }

    if (tag === "br") {
      return "<p><br></p>";
    }

    const blockChildren = Array.from(element.childNodes).map(serializeEditorBlock).join("");
    if (blockChildren) return blockChildren;

    const inner = serializeEditorInline(element).trim();
    return inner ? `<p>${inner}</p>` : "";
  };

  const normalizeEditorHtml = (html: string): string => {
    const source = html.trim() || defaultBodyContent;

    if (typeof DOMParser === "undefined") {
      return source;
    }

    const doc = new DOMParser().parseFromString(`<div id="editor-root">${source}</div>`, "text/html");
    const root = doc.getElementById("editor-root");

    if (!root) return defaultBodyContent;

    root.querySelectorAll("script, style").forEach((node) => node.remove());
    root.querySelectorAll("*").forEach((element) => {
      if (element.tagName.toLowerCase() !== "a") {
        element.removeAttribute("href");
      }

      ["style", "class", "id", "target", "rel", "data-cta"].forEach((attr) => {
        element.removeAttribute(attr);
      });
    });

    const serialized = Array.from(root.childNodes).map(serializeEditorBlock).join("");
    return serialized || defaultBodyContent;
  };

  const renderEmailInline = (parent: ParentNode): string => {
    return Array.from(parent.childNodes).map((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        return escapeHtml((child.textContent ?? "").replace(/\u00a0/g, " "));
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return "";

      const element = child as HTMLElement;
      const tag = element.tagName.toLowerCase();
      const inner = renderEmailInline(element);

      if (tag === "br") return "<br>";
      if (["strong", "b"].includes(tag)) return `<strong>${inner}</strong>`;
      if (["em", "i"].includes(tag)) return `<em>${inner}</em>`;
      if (tag === "u") return `<u>${inner}</u>`;
      if (tag === "a") {
        const href = element.getAttribute("href")?.trim();
        if (!href || href === EMAIL_CTA_URL) return inner;
        return `<a href="${escapeHtml(href)}" style="color:#1a9a8a;text-decoration:underline;font-weight:600;">${inner || escapeHtml(element.textContent ?? href)}</a>`;
      }

      return inner || escapeHtml(element.textContent ?? "");
    }).join("");
  };

  const renderEmailBlock = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\u00a0/g, " ").trim();
      return text ? `<p style="color:#4a5c65;line-height:1.8;font-size:15px;margin:0 0 20px;">${escapeHtml(text)}</p>` : "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (["h1", "h2", "h3"].includes(tag)) {
      const inner = renderEmailInline(element).trim();
      if (!inner) return "";

      const fontSize = tag === "h1" ? "24px" : tag === "h2" ? "20px" : "18px";
      return `<h2 style="color:#1a2b32;margin:0 0 18px;font-size:${fontSize};font-weight:600;line-height:1.35;">${inner}</h2>`;
    }

    if (tag === "p") {
      const inner = renderEmailInline(element).trim();
      const plainText = getPlainTextFromHtml(inner);

      if (!inner) return "";
      if (!plainText && inner.includes("<br")) {
        return `<div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>`;
      }

      return `<p style="color:#4a5c65;line-height:1.8;font-size:15px;margin:0 0 20px;">${inner}</p>`;
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child) => {
          const inner = renderEmailInline(child).trim();
          return inner ? `<li style="margin:0 0 10px;">${inner}</li>` : "";
        })
        .join("");

      if (!items) return "";

      const listStyle = tag === "ul" ? "padding-left:22px;list-style-type:disc;" : "padding-left:22px;list-style-type:decimal;";
      return `<${tag} style="color:#4a5c65;line-height:1.8;font-size:15px;margin:0 0 20px;${listStyle}">${items}</${tag}>`;
    }

    if (tag === "div") {
      const blockChildren = Array.from(element.childNodes).map(renderEmailBlock).join("");
      if (blockChildren) return blockChildren;

      const inner = renderEmailInline(element).trim();
      return inner ? `<p style="color:#4a5c65;line-height:1.8;font-size:15px;margin:0 0 20px;">${inner}</p>` : "";
    }

    const blockChildren = Array.from(element.childNodes).map(renderEmailBlock).join("");
    if (blockChildren) return blockChildren;

    const inner = renderEmailInline(element).trim();
    return inner ? `<p style="color:#4a5c65;line-height:1.8;font-size:15px;margin:0 0 20px;">${inner}</p>` : "";
  };

  const buildEmailBodyContent = (editorHtml: string): string => {
    const normalized = normalizeEditorHtml(editorHtml);

    if (typeof DOMParser === "undefined") {
      return normalized;
    }

    const doc = new DOMParser().parseFromString(`<div id="editor-root">${normalized}</div>`, "text/html");
    const root = doc.getElementById("editor-root");

    if (!root) return normalized;

    const blocks = Array.from(root.childNodes).map(renderEmailBlock).join("")
      || `<p style="color:#4a5c65;line-height:1.8;font-size:15px;margin:0 0 20px;">Seu conteúdo aqui...</p>`;

    return `${blocks}
      <p style="margin:28px 0 0;text-align:center;">
        <a href="${EMAIL_CTA_URL}" style="display:inline-block;background:linear-gradient(135deg,#1a9a8a,#22b8a5);color:#ffffff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 4px 14px rgba(26,154,138,0.35);">
          ${EMAIL_CTA_LABEL}
        </a>
      </p>`;
  };

  const extractBodyContent = (html: string): string => {
    const bodyHtml = getWrappedBodyContent(html);

    if (typeof DOMParser === "undefined") {
      return bodyHtml || defaultBodyContent;
    }

    const doc = new DOMParser().parseFromString(`<div id="editor-root">${bodyHtml}</div>`, "text/html");
    const root = doc.getElementById("editor-root");

    if (!root) return defaultBodyContent;

    root.querySelectorAll("a").forEach((anchor) => {
      const href = anchor.getAttribute("href")?.trim();
      const text = anchor.textContent?.trim();

      if (href === EMAIL_CTA_URL || text === EMAIL_CTA_LABEL) {
        const parent = anchor.parentElement;
        if (parent && ["p", "div"].includes(parent.tagName.toLowerCase()) && parent.textContent?.trim() === text) {
          parent.remove();
          return;
        }

        anchor.remove();
      }
    });

    const serialized = Array.from(root.childNodes).map(serializeEditorBlock).join("");
    return serialized || defaultBodyContent;
  };

  const wrapBodyContent = (body: string): string => {
    return EMAIL_WRAPPER_START + "\n    " + body + "\n  " + EMAIL_WRAPPER_END;
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTplNome("");
    setTplAssunto("");
    setTplConteudo(defaultBodyContent);
    setTemplateDialog(true);
  };

  const openEditTemplate = (tpl: Template) => {
    setEditingTemplate(tpl);
    setTplNome(tpl.nome);
    setTplAssunto(tpl.assunto);
    setTplConteudo(extractBodyContent(tpl.conteudo_html));
    setTemplateDialog(true);
  };

  useEffect(() => {
    if (!templateDialog || !contentEditableRef.current) return;
    if (document.activeElement === contentEditableRef.current) return;

    contentEditableRef.current.innerHTML = tplConteudo || defaultBodyContent;
  }, [templateDialog, tplConteudo, editingTemplate?.id]);

  const saveTemplate = async () => {
    const normalizedContent = normalizeEditorHtml(tplConteudo);

    if (!tplNome.trim() || !tplAssunto.trim() || !getPlainTextFromHtml(normalizedContent)) {
      toast.error("Preencha todos os campos.");
      return;
    }

    setSavingTpl(true);
    const fullHtml = wrapBodyContent(buildEmailBodyContent(normalizedContent));
    try {
      if (editingTemplate) {
        const { error } = await supabase.from("email_marketing_templates").update({ nome: tplNome, assunto: tplAssunto, conteudo_html: fullHtml }).eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Template atualizado!");
      } else {
        const { error } = await supabase.from("email_marketing_templates").insert({ nome: tplNome, assunto: tplAssunto, conteudo_html: fullHtml });
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
    const { error } = await supabase.from("email_marketing_templates").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir."); return; }
    toast.success("Template excluído!");
    await loadData();
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
    if (!importText.trim()) { toast.error("Insira os e-mails."); return; }
    setImporting(true);
    try {
      const campaignId = await ensureDefaultCampaign();

      const lines = importText.split(/[\n;,]+/).map(l => l.trim()).filter(l => l.includes("@"));
      const entries: { email: string; nome: string | null }[] = [];
      const seen = new Set<string>();

      // Get already sent emails
      const { data: alreadySent } = await supabase
        .from("marketing_enviados_log")
        .select("destinatario")
        .eq("tipo", "email");
      const sentSet = new Set((alreadySent || []).map(s => s.destinatario));

      let skippedDupes = 0;

      for (const line of lines) {
        const parts = line.split(/[,;\t]+/).map(p => p.trim());
        let email = "";
        let nome: string | null = null;

        if (parts.length >= 2 && parts[1].includes("@")) {
          nome = parts[0];
          email = parts[1].toLowerCase();
        } else {
          email = parts[0].toLowerCase();
        }

        if (email && !seen.has(email)) {
          if (sentSet.has(email)) {
            skippedDupes++;
            continue;
          }
          seen.add(email);
          entries.push({ email, nome });
        }
      }

      if (entries.length === 0) {
        toast.error(skippedDupes > 0 ? `Todos os ${skippedDupes} e-mails já foram enviados anteriormente.` : "Nenhum e-mail válido encontrado.");
        setImporting(false);
        return;
      }

      const rows = entries.map(e => ({
        campaign_id: campaignId,
        email: e.email,
        nome: e.nome,
        status: "pendente",
      }));

      let imported = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { data } = await supabase
          .from("email_marketing_recipients")
          .upsert(batch, { onConflict: "campaign_id,email", ignoreDuplicates: true })
          .select();
        imported += data?.length || 0;
      }

      toast.success(`${imported} e-mails importados!${skippedDupes > 0 ? ` ${skippedDupes} já enviados (ignorados).` : ""}`);
      setImportText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error("Erro na importação.");
    } finally { setImporting(false); }
  };

  const deleteRecipient = async (id: string) => {
    const { error } = await supabase.from("email_marketing_recipients").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover."); return; }
    toast.success("Removido!");
    setPendingRecipients(prev => prev.filter(r => r.id !== id));
    setErrorRecipients(prev => prev.filter(r => r.id !== id));
  };

  const triggerSend = async () => {
    toast.info("Disparando e-mails de marketing...");
    try {
      const { data, error } = await supabase.functions.invoke("send-marketing-emails", { body: { force: true } });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Disparo concluído! ${data.sent} enviados, ${data.errors} erros.`);
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
            <Mail className="w-5 h-5 text-primary" />
            E-mail Marketing
          </h2>
          <p className="text-sm text-muted-foreground">
            Importe e-mails, configure templates e o envio é automático
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={triggerSend} className="bg-primary">
            <Zap className="w-4 h-4 mr-2" />
            Disparar Agora
          </Button>
        </div>
      </div>

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
                <Zap className="w-4 h-4 text-primary" />
                Como Funciona
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>1️⃣ <strong>Importe e-mails</strong> — cole ou envie um arquivo CSV/TXT</p>
                <p>2️⃣ <strong>Configure templates</strong> — crie templates HTML com rotação automática</p>
                <p>3️⃣ <strong>Envio automático</strong> — até 35 e-mails/dia em horário comercial de Brasília</p>
                <p>4️⃣ <strong>Após enviar</strong> — o e-mail é removido da fila e salvo no histórico (nunca repete)</p>
              </div>
            </CardContent>
          </Card>

          {/* Pending */}
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
                        <TableHead>E-mail</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingRecipients.slice(0, 20).map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.email}</TableCell>
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
                      e mais {pendingRecipients.length - 20} e-mails...
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
                <CardTitle className="text-base text-destructive">Erros de Envio ({errorRecipients.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorRecipients.slice(0, 10).map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.email}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate">{r.erro_mensagem || "Erro"}</TableCell>
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
              <CardTitle className="text-lg">Importar E-mails</CardTitle>
              <CardDescription>
                Cole e-mails ou envie um arquivo. E-mails já enviados serão ignorados automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Arquivo CSV/TXT (opcional)</Label>
                <Input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleFileUpload} className="mt-1" />
              </div>
              <div>
                <Label>E-mails (um por linha, formato: email ou nome,email)</Label>
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`joao@email.com\nMaria,maria@email.com\ncarlos@clinica.com.br`}
                  rows={10}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <Button onClick={handleImport} disabled={importing || !importText.trim()}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importing ? "Importando..." : "Importar E-mails"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="mt-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-6 border-b">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  Templates de E-mail
                </CardTitle>
                <CardDescription className="mt-1">Os templates são alternados automaticamente a cada envio</CardDescription>
              </div>
              <Button size="sm" onClick={openNewTemplate} className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              {templates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <FileText className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="font-medium text-foreground/70">Nenhum template criado</p>
                  <p className="text-sm mt-1">Crie seu primeiro template para começar os envios</p>
                  <Button size="sm" className="mt-6" onClick={openNewTemplate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Template
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((tpl, idx) => (
                    <div key={tpl.id} className="group relative border rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 bg-card">
                      {/* Mini preview */}
                      <div className="h-36 overflow-hidden bg-muted/20 border-b relative">
                        <div className="scale-[0.35] origin-top-left w-[285%] pointer-events-none p-2">
                          <div dangerouslySetInnerHTML={{ __html: tpl.conteudo_html.replace(/{nome}/g, "João").replace(/{email}/g, "joao@email.com") }} />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card/80" />
                      </div>
                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{tpl.nome}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">📧 {tpl.assunto}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 mt-3 pt-3 border-t justify-end">
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => {
                            setPreviewHtml(tpl.conteudo_html.replace(/{nome}/g, "João").replace(/{email}/g, "joao@email.com"));
                            setPreviewSubject(tpl.assunto.replace(/{nome}/g, "João"));
                            setPreviewDialog(true);
                          }}>
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Ver
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => openEditTemplate(tpl)}>
                            <Edit className="w-3.5 h-3.5 mr-1" />
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-destructive hover:text-destructive" onClick={() => deleteTemplate(tpl.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
                <CardDescription>{sentCount} e-mails enviados (nunca serão repetidos)</CardDescription>
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
                        <TableHead>E-mail</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Enviado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">{s.destinatario}</TableCell>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              {editingTemplate ? "Editar Template" : "Novo Template"}
            </DialogTitle>
            <DialogDescription>
              Edite somente o modelo visual do e-mail. Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{"{nome}"}</code> para personalizar com o nome do destinatário. O cabeçalho, rodapé e botão da Espetos &amp; Cia são adicionados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome do Template</Label>
                <Input value={tplNome} onChange={(e) => setTplNome(e.target.value)} placeholder="Ex: Template A" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assunto do E-mail</Label>
                <Input value={tplAssunto} onChange={(e) => setTplAssunto(e.target.value)} placeholder="Ex: {nome}, conheça a Espetos &amp; Cia!" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modelo do E-mail</Label>
                <div
                  ref={contentEditableRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => {
                    if (contentEditableRef.current) {
                      setTplConteudo(normalizeEditorHtml(contentEditableRef.current.innerHTML));
                    }
                  }}
                  onBlur={() => {
                    if (!contentEditableRef.current) return;
                    const normalized = normalizeEditorHtml(contentEditableRef.current.innerHTML);
                    contentEditableRef.current.innerHTML = normalized;
                    setTplConteudo(normalized);
                  }}
                  className="mt-1.5 min-h-[220px] max-h-[320px] overflow-y-auto rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>h1]:mb-4 [&>h1]:text-2xl [&>h1]:font-semibold [&>h1]:leading-tight [&>h2]:mb-4 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:leading-tight [&>h3]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:leading-tight [&>p]:mb-4 [&>p]:leading-7 [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-6 [&>ul>li]:mb-2 [&>ol>li]:mb-2 [&_a]:font-semibold [&_a]:text-primary [&_a]:underline"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  ✏️ Edite o texto como ele deve aparecer no e-mail. Os espaçamentos entre título, parágrafos e lista serão preservados automaticamente.
                </p>
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização</Label>
              <div className="border rounded-xl overflow-hidden bg-muted/40 shadow-inner">
                {/* Email client header */}
                <div className="bg-background border-b px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">De:</span>
                    <span>Lumia &lt;contato@dashespetosecia.lovable.app&gt;</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Assunto:</span>
                    <span className="text-foreground font-medium">
                      {tplAssunto ? tplAssunto.replace(/{nome}/g, "João") : "—"}
                    </span>
                  </div>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: wrapBodyContent(buildEmailBodyContent(tplConteudo))
                        .replace(/{nome}/g, "João")
                        .replace(/{email}/g, "joao@email.com")
                    }}
                    style={{ padding: "20px" }}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancelar</Button>
            <Button onClick={saveTemplate} disabled={savingTpl} className="shadow-sm">
              {savingTpl ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Pré-visualização do E-mail
            </DialogTitle>
          </DialogHeader>
          <div className="border rounded-xl overflow-hidden bg-muted/40 shadow-inner">
            {/* Email client header */}
            <div className="bg-background border-b px-5 py-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground w-14">De:</span>
                <span className="text-muted-foreground">Lumia &lt;contato@dashespetosecia.lovable.app&gt;</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground w-14">Para:</span>
                <span className="text-muted-foreground">joao@email.com</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground w-14">Assunto:</span>
                <span className="text-foreground font-medium">{previewSubject || "—"}</span>
              </div>
            </div>
            <div style={{ padding: "20px" }}>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}