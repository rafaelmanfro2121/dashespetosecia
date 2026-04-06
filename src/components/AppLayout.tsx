import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, Users,
  CalendarCheck, Brain, ChevronLeft, ChevronRight, LogOut, Package, Sparkles, Hammer, ClipboardList, Contact, Wrench, Menu
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import logoWhite from '@/assets/logo-white.png';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  
  { to: '/funcionarios', icon: Users, label: 'Funcionários' },
  { to: '/ordem-servico', icon: ClipboardList, label: 'Pedidos' },
  { to: '/ordem-servico-tecnica', icon: Wrench, label: 'Ordem de Serviço' },
  { to: '/clientes', icon: Contact, label: 'Clientes' },
  { to: '/fechamento', icon: CalendarCheck, label: 'Fechamento' },
];

function SidebarContent({ collapsed, location, signOut, onNavigate }: { collapsed: boolean; location: any; signOut: () => void; onNavigate?: () => void }) {
  return (
    <>
      {!collapsed && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sidebar-accent/50 border border-sidebar-border">
            <Sparkles size={14} className="text-sidebar-primary" />
            <span className="text-[11px] font-medium text-sidebar-primary">IA Ativa</span>
          </div>
        </div>
      )}

      <nav className="flex-1 py-3 space-y-0.5 px-3 overflow-y-auto">
        {navItems.map(item => {
          const active = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`sidebar-item ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
          <button onClick={signOut} className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-primary transition-colors w-full px-1">
            <LogOut size={14} /> Sair do Sistema
          </button>
          <p className="text-[10px] text-sidebar-foreground/30 px-1">ESP Insight AI v3.0</p>
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

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          className={`flex flex-col transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'} shrink-0`}
          style={{ background: 'linear-gradient(180deg, hsl(225, 30%, 12%) 0%, hsl(225, 35%, 8%) 100%)' }}
        >
          <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border min-h-[72px]">
            {!collapsed && (
              <img src={logoWhite} alt="Espetos & Cia" className="h-10 object-contain" />
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
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
            style={{ background: 'linear-gradient(180deg, hsl(225, 30%, 12%) 0%, hsl(225, 35%, 8%) 100%)' }}
          >
            <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border min-h-[72px]">
              <img src={logoWhite} alt="Espetos & Cia" className="h-10 object-contain" />
            </div>
            <SidebarContent collapsed={false} location={location} signOut={signOut} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <main className="flex-1 overflow-auto bg-background">
        <div className={`${isMobile ? 'px-4 pt-16 pb-6' : 'p-8'} max-w-7xl mx-auto animate-fade-in`}>
          {children}
        </div>
      </main>
    </div>
  );
}
