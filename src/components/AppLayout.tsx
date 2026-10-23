import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import QuickEntryFAB from '@/components/QuickEntryFAB';
import {
  LayoutDashboard, DollarSign, Users,
  CalendarCheck, ChevronLeft, ChevronRight, LogOut, Download, Package, ClipboardList, Contact, Wrench, Menu, Target, History
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import logoWhite from '@/assets/logo-white.png';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { downloadFullBackup } from '@/lib/backup';
import { runMetaCapiInBackground } from '@/lib/meta';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  
  { to: '/funcionarios', icon: Users, label: 'Funcionários' },
  { to: '/ordem-servico', icon: ClipboardList, label: 'Pedidos' },
  { to: '/ordem-servico-tecnica', icon: Wrench, label: 'Ordem de Serviço' },
  { to: '/clientes', icon: Contact, label: 'Clientes' },
  { to: '/clientes-antigos', icon: History, label: 'Clientes antigos' },
  { to: '/fechamento', icon: CalendarCheck, label: 'Fechamento' },
  { to: '/meta', icon: Target, label: 'Meta Ads' },
];

function BackupButton() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { totalRows, failed } = await downloadFullBackup();
      if (failed.length) toast.warning(`Backup baixado (${totalRows} registros), mas falhou em: ${failed.map(f => f.table).join(', ')}`);
      else toast.success(`Backup baixado: ${totalRows} registros`);
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao gerar backup');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={run} disabled={busy} className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-primary transition-colors w-full px-1 disabled:opacity-50">
      <Download size={14} /> {busy ? 'Gerando backup...' : 'Baixar backup completo'}
    </button>
  );
}

function SidebarContent({ collapsed, location, signOut, onNavigate }: { collapsed: boolean; location: any; signOut: () => void; onNavigate?: () => void }) {
  return (
    <>


      <nav className="flex-1 py-3 space-y-0.5 px-3 overflow-y-auto">
        {navItems.map(item => {
          const active = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`sidebar-item ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-sidebar-accent shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                >
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                </motion.span>
              )}
              <item.icon size={18} className="relative" />
              {!collapsed && <span className="relative">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
          <BackupButton />
          <button onClick={signOut} className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-primary transition-colors w-full px-1">
            <LogOut size={14} /> Sair do Sistema
          </button>
          <p className="text-[10px] text-sidebar-foreground/30 px-1">Espetos & Cia v3.0</p>
        </div>
      )}
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();
  const isMobile = useIsMobile();

  // Ao abrir o sistema, reenvia para a Meta as vendas que ficaram na fila (ex.: falha de rede).
  useEffect(() => { runMetaCapiInBackground(); }, []);

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          className={`flex flex-col transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'} shrink-0`}
          style={{ background: 'linear-gradient(180deg, hsl(24, 10%, 11%) 0%, hsl(24, 12%, 6%) 100%)' }}
        >
          <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border min-h-[72px]">
            {!collapsed && (
              <img src={logoWhite} alt="Espetos & Cia" className="h-10 object-contain" />
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              className="ml-auto text-sidebar-foreground/60 hover:text-sidebar-primary transition-colors rounded-lg p-1.5 hover:bg-sidebar-accent"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          <SidebarContent collapsed={collapsed} location={location} signOut={signOut} />
        </aside>
      )}

      {/* Mobile header + sheet */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-3 left-3 z-50 h-10 w-10 rounded-xl bg-card border shadow-md"
            >
              <Menu size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[280px] p-0 border-r-0"
            style={{ background: 'linear-gradient(180deg, hsl(24, 10%, 11%) 0%, hsl(24, 12%, 6%) 100%)' }}
          >
            <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border min-h-[72px]">
              <img src={logoWhite} alt="Espetos & Cia" className="h-10 object-contain" />
            </div>
            <SidebarContent collapsed={false} location={location} signOut={signOut} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <main className="flex-1 overflow-auto bg-background">
        <div className={`${isMobile ? 'px-4 pt-16 pb-6' : 'p-8'} max-w-7xl mx-auto`}>
          {children}
        </div>
      </main>
      <QuickEntryFAB />
    </div>
  );
}
