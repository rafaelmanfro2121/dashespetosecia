import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, Users, ClipboardCheck,
  Banknote, CalendarCheck, Brain, ChevronLeft, ChevronRight, LogOut, Package, Warehouse
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logoWhite from '@/assets/logo-white.png';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  { to: '/estoque', icon: Warehouse, label: 'Estoque' },
  { to: '/funcionarios', icon: Users, label: 'Funcionários' },
  { to: '/presenca', icon: ClipboardCheck, label: 'Presença' },
  { to: '/vales', icon: Banknote, label: 'Vales' },
  { to: '/fechamento', icon: CalendarCheck, label: 'Fechamento' },
  { to: '/relatorio-ia', icon: Brain, label: 'Relatório IA' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={`bg-sidebar flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} shrink-0`}
        style={{ background: 'linear-gradient(180deg, hsl(220, 25%, 12%) 0%, hsl(220, 30%, 8%) 100%)' }}
      >
        <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
          {!collapsed && (
            <img src={logoWhite} alt="Espetos & Cia" className="h-10 object-contain" />
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-sidebar-foreground hover:text-sidebar-primary transition-colors"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`sidebar-item ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
            <button onClick={signOut} className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-primary transition-colors w-full">
              <LogOut size={14} /> Sair
            </button>
            <p className="text-xs text-sidebar-foreground/40">ESP Insight AI v3.0</p>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto bg-background">
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
