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
import PresencaPage from "@/pages/PresencaPage";
import ValesPage from "@/pages/ValesPage";
import FechamentoPage from "@/pages/FechamentoPage";
import RelatorioIAPage from "@/pages/RelatorioIAPage";
import ProdutosPage from "@/pages/ProdutosPage";
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
          <Route path="/funcionarios" element={<FuncionariosPage />} />
          <Route path="/presenca" element={<PresencaPage />} />
          <Route path="/vales" element={<ValesPage />} />
          <Route path="/fechamento" element={<FechamentoPage />} />
          <Route path="/relatorio-ia" element={<RelatorioIAPage />} />
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
