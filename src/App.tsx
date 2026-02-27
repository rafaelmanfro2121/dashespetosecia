import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FinanceProvider } from "@/contexts/FinanceContext";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import FinanceiroPage from "@/pages/FinanceiroPage";
import FuncionariosPage from "@/pages/FuncionariosPage";
import PresencaPage from "@/pages/PresencaPage";
import ValesPage from "@/pages/ValesPage";
import FechamentoPage from "@/pages/FechamentoPage";
import RelatorioIAPage from "@/pages/RelatorioIAPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <FinanceProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/financeiro" element={<FinanceiroPage />} />
              <Route path="/funcionarios" element={<FuncionariosPage />} />
              <Route path="/presenca" element={<PresencaPage />} />
              <Route path="/vales" element={<ValesPage />} />
              <Route path="/fechamento" element={<FechamentoPage />} />
              <Route path="/relatorio-ia" element={<RelatorioIAPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </FinanceProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
