import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FinanceProvider } from "@/contexts/FinanceContext";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import FinanceiroPage from "@/pages/FinanceiroPage";
import FuncionariosPage from "@/pages/FuncionariosPage";
import FechamentoPage from "@/pages/FechamentoPage";
import RelatorioIAPage from "@/pages/RelatorioIAPage";
import ProdutosPage from "@/pages/ProdutosPage";

import OrdemServicoPage from "@/pages/OrdemServicoPage";
import OrdemServicoTecnicaPage from "@/pages/OrdemServicoTecnicaPage";
import ClientesPage from "@/pages/ClientesPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <FinanceProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/financeiro" element={<FinanceiroPage />} />
          <Route path="/produtos" element={<ProdutosPage />} />
          <Route path="/materiais" element={<MateriaisPage />} />
          <Route path="/funcionarios" element={<FuncionariosPage />} />
          <Route path="/fechamento" element={<FechamentoPage />} />
          <Route path="/relatorio-ia" element={<RelatorioIAPage />} />
          <Route path="/ordem-servico" element={<OrdemServicoPage />} />
          <Route path="/ordem-servico-tecnica" element={<OrdemServicoTecnicaPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          {/* Redirect old routes */}
          <Route path="/presenca" element={<Navigate to="/funcionarios" replace />} />
          <Route path="/vales" element={<Navigate to="/funcionarios" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </FinanceProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
