import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Mail,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  X,
  RefreshCw,
  Loader2,
  User,
  Calendar,
  Zap,
  AlertTriangle,
  Send,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailTemplate {
  id: string;
  dia_trigger: number;
  assunto: string;
  conteudo_html: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface AutomationUser {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
  data_cadastro: string;
  automacao_ativa: boolean;
  usuario_ativado: boolean;
  pausado: boolean;
  pacientes_cadastrados: number;
  sessoes_registradas: number;
  updated_at: string;
}

interface EmailLog {
  id: string;
  user_id: string;
  template_id: string | null;
  dia_trigger: number;
  status: string;
  erro_mensagem: string | null;
  enviado_em: string;
}

export default function EmailAutomation() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [automationUsers, setAutomationUsers] = useState<AutomationUser[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState("users");

  // Template edit state
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editAssunto, setEditAssunto] = useState("");
  const [editConteudo, setEditConteudo] = useState("");
  const [editAtivo, setEditAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  // Manual send state
  const [manualSendOpen, setManualSendOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualDia, setManualDia] = useState<string>("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesRes, usersRes, logsRes] = await Promise.all([
        supabase.from("email_automation_templates").select("*").order("dia_trigger"),
        supabase.from("email_automation_users").select("*").order("data_cadastro", { ascending: false }),
        supabase.from("email_automation_logs").select("*").order("enviado_em", { ascending: false }).limit(200),
      ]);

      if (templatesRes.data) setTemplates(templatesRes.data as unknown as EmailTemplate[]);
      if (usersRes.data) setAutomationUsers(usersRes.data as unknown as AutomationUser[]);
      if (logsRes.data) setLogs(logsRes.data as unknown as EmailLog[]);
    } catch (err) {
      console.error("Error loading email automation data:", err);
      toast.error("Erro ao carregar dados de automação.");
    } finally {
      setLoading(false);
    }
  };

  const getDayLabel = (day: number) => {
    switch (day) {
      case 0: return "Dia 0 - Boas-vindas";
      case 1: return "Dia 1 - Cadastro de pacientes";
      case 3: return "Dia 3 - Primeira sessão";
      case 5: return "Dia 5 - Aviso de avanço";
      case 6: return "Dia 6 - Último dia";
      case 7: return "Dia 7 - Pós-trial";
      case 9: return "Dia 9 - Recuperação D+2";
      default: return `Dia ${day}`;
    }
  };

  const getTrialDay = (dataCadastro: string) => {
    const start = new Date(dataCadastro);
    const today = new Date();
    return differenceInDays(today, start);
  };

  const openEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setEditAssunto(template.assunto);
    setEditConteudo(template.conteudo_html);
    setEditAtivo(template.ativo);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_automation_templates")
        .update({
          assunto: editAssunto,
          conteudo_html: editConteudo,
          ativo: editAtivo,
        })
        .eq("id", editingTemplate.id);

      if (error) throw error;
      toast.success("Template atualizado!");
      setEditingTemplate(null);
      await loadData();
    } catch (err) {
      console.error("Error saving template:", err);
      toast.error("Erro ao salvar template.");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserAutomation = async (userId: string, field: "automacao_ativa" | "pausado", value: boolean) => {
    try {
      const { error } = await supabase
        .from("email_automation_users")
        .update({ [field]: value })
        .eq("user_id", userId);

      if (error) throw error;
      toast.success("Atualizado!");
      await loadData();
    } catch (err) {
      console.error("Error toggling automation:", err);
      toast.error("Erro ao atualizar.");
    }
  };

  const runManualTrigger = async () => {
    try {
      toast.info("Executando disparo de e-mails...");
      const { data, error } = await supabase.functions.invoke("cron-trial-emails");
      if (error) throw error;
      if (data?.success) {
        toast.success(`Disparo concluído! ${data.sent} e-mails enviados, ${data.errors} erros.`);
        await loadData();
      }
    } catch (err) {
      console.error("Error running trigger:", err);
      toast.error("Erro ao executar disparo.");
    }
  };

  const handleManualSend = async () => {
    if (!manualEmail || !manualDia) {
      toast.error("Preencha o e-mail e selecione o template.");
      return;
    }
    setSending(true);
    try {
      const dia = manualDia === "all" ? undefined : parseInt(manualDia);
      const body: Record<string, unknown> = { test_email: manualEmail };
      if (dia !== undefined) body.test_dia = dia;

      const { data, error } = await supabase.functions.invoke("cron-trial-emails", { body });
      if (error) throw error;
      if (data?.success) {
        toast.success(`${data.sent} e-mail(s) enviado(s) para ${manualEmail}!`);
        setManualSendOpen(false);
        setManualEmail("");
        setManualDia("");
      }
    } catch (err) {
      console.error("Manual send error:", err);
      toast.error("Erro ao enviar e-mail.");
    } finally {
      setSending(false);
    }
  };

  // Stats
  const trialUsers = automationUsers.filter(u => {
    const day = getTrialDay(u.data_cadastro);
    return day >= 0 && day <= 7;
  });
  const activatedUsers = automationUsers.filter(u => u.usuario_ativado);
  const totalSent = logs.filter(l => l.status === "enviado").length;
  const totalErrors = logs.filter(l => l.status === "erro").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Automação de E-mails
          </h2>
          <p className="text-sm text-muted-foreground">
            Sistema de ativação guiada durante o período de teste
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={runManualTrigger}>
            <Zap className="w-4 h-4 mr-2" />
            Disparar Agora
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setManualSendOpen(true)}>
            <Send className="w-4 h-4 mr-2" />
            Enviar Manual
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{trialUsers.length}</p>
                <p className="text-xs text-muted-foreground">Em Trial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activatedUsers.length}</p>
                <p className="text-xs text-muted-foreground">Ativados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSent}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalErrors}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <User className="w-4 h-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Edit className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Calendar className="w-4 h-4" />
            Logs de Envio
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usuários em Período de Teste</CardTitle>
              <CardDescription>Controle de automação individual por usuário</CardDescription>
            </CardHeader>
            <CardContent>
              {automationUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum usuário registrado na automação ainda.</p>
                  <p className="text-sm mt-2">Os usuários serão adicionados automaticamente ao disparar o cron.</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Dia do Trial</TableHead>
                        <TableHead>Ativação</TableHead>
                        <TableHead>Pacientes</TableHead>
                        <TableHead>Sessões</TableHead>
                        <TableHead>Automação</TableHead>
                        <TableHead>Pausado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {automationUsers.map((user) => {
                        const trialDay = getTrialDay(user.data_cadastro);
                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{user.nome || "—"}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={trialDay > 7 ? "destructive" : trialDay >= 5 ? "secondary" : "default"}>
                                Dia {trialDay}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.usuario_ativado ? (
                                <Badge className="bg-success hover:bg-success/90">Ativado</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{user.pacientes_cadastrados}</TableCell>
                            <TableCell className="text-center">{user.sessoes_registradas}</TableCell>
                            <TableCell>
                              <Switch
                                checked={user.automacao_ativa}
                                onCheckedChange={(v) => toggleUserAutomation(user.user_id, "automacao_ativa", v)}
                              />
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={user.pausado}
                                onCheckedChange={(v) => toggleUserAutomation(user.user_id, "pausado", v)}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Templates de E-mail</CardTitle>
              <CardDescription>
                Edite o conteúdo dos e-mails da sequência de ativação. 
                Variáveis disponíveis: {"{nome}"}, {"{email}"}, {"{dashboard_url}"}, {"{dias_restantes}"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={template.ativo ? "default" : "secondary"} className="text-xs">
                          {template.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                        <span className="font-medium text-sm">{getDayLabel(template.dia_trigger)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{template.assunto}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEditTemplate(template)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Logs de Envio</CardTitle>
              <CardDescription>Histórico de e-mails enviados pela automação</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum envio registrado ainda.</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Dia</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const user = automationUsers.find(u => u.user_id === log.user_id);
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {format(new Date(log.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-sm">{user?.email || log.user_id.slice(0, 8)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">Dia {log.dia_trigger}</Badge>
                            </TableCell>
                            <TableCell>
                              {log.status === "enviado" ? (
                                <Badge className="bg-success hover:bg-success/90">Enviado</Badge>
                              ) : (
                                <Badge variant="destructive">Erro</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                              {log.erro_mensagem || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar Template - {editingTemplate ? getDayLabel(editingTemplate.dia_trigger) : ""}
            </DialogTitle>
            <DialogDescription>
              Edite o assunto e conteúdo HTML do e-mail. Use as variáveis {"{nome}"}, {"{email}"}, {"{dashboard_url}"}, {"{dias_restantes}"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Template ativo</Label>
              <Switch checked={editAtivo} onCheckedChange={setEditAtivo} />
            </div>

            <div className="space-y-2">
              <Label>Assunto do e-mail</Label>
              <Input value={editAssunto} onChange={(e) => setEditAssunto(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Conteúdo HTML</Label>
              <Textarea
                value={editConteudo}
                onChange={(e) => setEditConteudo(e.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                O conteúdo será automaticamente envolvido no template visual da Espetos &amp; Cia (header + footer).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Send Dialog */}
      <Dialog open={manualSendOpen} onOpenChange={setManualSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar E-mail Manualmente</DialogTitle>
            <DialogDescription>
              Escolha o template e informe o e-mail de destino.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail de destino</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Template</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={manualDia}
                onChange={(e) => setManualDia(e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="all">📨 Todos os templates</option>
                {templates.map((t) => (
                  <option key={t.id} value={String(t.dia_trigger)}>
                    {getDayLabel(t.dia_trigger)} {!t.ativo ? "(inativo)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualSendOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleManualSend} disabled={sending || !manualEmail || !manualDia}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
