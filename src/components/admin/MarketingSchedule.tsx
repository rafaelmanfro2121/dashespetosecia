import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Save, Loader2, Mail, MessageSquare, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ScheduleSettings {
  id: string;
  channel: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  daily_limit: number;
  interval_seconds: number;
}

export default function MarketingSchedule() {
  const [settings, setSettings] = useState<ScheduleSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketing_schedule_settings")
      .select("*")
      .order("channel");

    if (error) {
      console.error("Error loading schedule settings:", error);
      toast.error("Erro ao carregar configurações de horário");
    } else {
      setSettings((data as any[]) || []);
    }
    setLoading(false);
  };

  const handleUpdate = (channel: string, field: string, value: any) => {
    setSettings(prev =>
      prev.map(s => s.channel === channel ? { ...s, [field]: value } : s)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const s of settings) {
        // Validate times
        if (s.start_time >= s.end_time) {
          toast.error(`Horário de início deve ser anterior ao fim (${s.channel === 'email' ? 'E-mail' : 'WhatsApp'})`);
          setSaving(false);
          return;
        }

        const { error } = await supabase
          .from("marketing_schedule_settings")
          .update({
            start_time: s.start_time,
            end_time: s.end_time,
            is_active: s.is_active,
            daily_limit: s.daily_limit,
            interval_seconds: s.interval_seconds,
            ...((s as any).hourly_limit !== undefined ? { hourly_limit: (s as any).hourly_limit } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", s.id);

        if (error) throw error;
      }
      toast.success("Horários salvos com sucesso!");
    } catch (err) {
      console.error("Error saving:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (time: string) => {
    // Ensure HH:MM format
    return time.substring(0, 5);
  };

  // Get current Brasília time
  const getBrasiliaTime = () => {
    const now = new Date();
    return now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const [brasiliaTime, setBrasiliaTime] = useState(getBrasiliaTime());

  useEffect(() => {
    const interval = setInterval(() => setBrasiliaTime(getBrasiliaTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const emailSettings = settings.find(s => s.channel === "email");
  const whatsappSettings = settings.find(s => s.channel === "whatsapp");

  return (
    <div className="space-y-6">
      {/* Header with Brasília clock */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Horários de Disparo — Marketing
              </CardTitle>
              <CardDescription>
                Configure os horários e limites de envio para e-mail e WhatsApp marketing.
                Todos os horários são no fuso de Brasília (UTC-3).
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Horário de Brasília</p>
              <p className="text-2xl font-mono font-bold text-primary">{brasiliaTime}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Email Schedule */}
        {emailSettings && (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="w-5 h-5 text-blue-500" />
                  E-mail Marketing
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="email-active" className="text-sm text-muted-foreground">
                    {emailSettings.is_active ? "Ativo" : "Pausado"}
                  </Label>
                  <Switch
                    id="email-active"
                    checked={emailSettings.is_active}
                    onCheckedChange={(v) => handleUpdate("email", "is_active", v)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={formatTime(emailSettings.start_time)}
                    onChange={(e) => handleUpdate("email", "start_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={formatTime(emailSettings.end_time)}
                    onChange={(e) => handleUpdate("email", "end_time", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Limite diário</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={emailSettings.daily_limit}
                    onChange={(e) => handleUpdate("email", "daily_limit", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo (seg)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={300}
                    value={emailSettings.interval_seconds}
                    onChange={(e) => handleUpdate("email", "interval_seconds", parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  E-mails são enviados de <strong>{formatTime(emailSettings.start_time)}</strong> às{" "}
                  <strong>{formatTime(emailSettings.end_time)}</strong> (Brasília), com intervalo de{" "}
                  <strong>{emailSettings.interval_seconds}s</strong> entre envios. Máximo de{" "}
                  <strong>{emailSettings.daily_limit}</strong> por dia.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* WhatsApp Schedule */}
        {whatsappSettings && (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  WhatsApp Marketing
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="whatsapp-active" className="text-sm text-muted-foreground">
                    {whatsappSettings.is_active ? "Ativo" : "Pausado"}
                  </Label>
                  <Switch
                    id="whatsapp-active"
                    checked={whatsappSettings.is_active}
                    onCheckedChange={(v) => handleUpdate("whatsapp", "is_active", v)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={formatTime(whatsappSettings.start_time)}
                    onChange={(e) => handleUpdate("whatsapp", "start_time", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={formatTime(whatsappSettings.end_time)}
                    onChange={(e) => handleUpdate("whatsapp", "end_time", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Limite diário
                    <Badge variant="outline" className="text-[9px] px-1 py-0">Fixo</Badge>
                  </Label>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted/30 text-sm font-semibold">
                    40 msgs
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Limite por hora
                    <Badge variant="outline" className="text-[9px] px-1 py-0">Fixo</Badge>
                  </Label>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted/30 text-sm font-semibold">
                    5 msgs
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Intervalo
                    <Badge variant="outline" className="text-[9px] px-1 py-0">Fixo</Badge>
                  </Label>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted/30 text-sm font-semibold">
                    3-12 min
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-amber-700">🛡️ Proteção Anti-Bloqueio Ativa</p>
                  <p>
                    Limites fixos para proteger seu número: máximo <strong>5 mensagens por hora</strong> e{" "}
                    <strong>40 por dia</strong>. Intervalos aleatórios de <strong>3 a 12 minutos</strong>{" "}
                    entre cada envio com simulação de digitação humana. Esses limites não podem ser alterados.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2" size="lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Horários
        </Button>
      </div>
    </div>
  );
}
