import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, Zap, Clock, MessageCircle, Megaphone } from "lucide-react";
import EmailMarketing from "@/components/admin/EmailMarketing";
import WhatsAppMarketing from "@/components/admin/WhatsAppMarketing";
import EmailAutomation from "@/components/admin/EmailAutomation";
import MarketingSchedule from "@/components/admin/MarketingSchedule";
import LeadFeedbacks from "@/components/admin/LeadFeedbacks";

export default function MarketingPage() {
  const [tab, setTab] = useState("email");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" />
          Marketing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Email Marketing, WhatsApp, Automações e Configurações de Envio
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="email" className="gap-1.5 py-2">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Email Marketing</span>
            <span className="sm:hidden">Email</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5 py-2">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp Marketing</span>
            <span className="sm:hidden">WhatsApp</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-1.5 py-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Automações de Email</span>
            <span className="sm:hidden">Automações</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5 py-2">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Configurações de Envio</span>
            <span className="sm:hidden">Configs</span>
          </TabsTrigger>
          <TabsTrigger value="feedbacks" className="gap-1.5 py-2">
            <MessageCircle className="w-4 h-4" />
            Feedbacks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-6"><EmailMarketing /></TabsContent>
        <TabsContent value="whatsapp" className="mt-6"><WhatsAppMarketing /></TabsContent>
        <TabsContent value="automation" className="mt-6"><EmailAutomation /></TabsContent>
        <TabsContent value="schedule" className="mt-6"><MarketingSchedule /></TabsContent>
        <TabsContent value="feedbacks" className="mt-6"><LeadFeedbacks /></TabsContent>
      </Tabs>
    </div>
  );
}
