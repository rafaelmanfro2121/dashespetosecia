import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, Users, ClipboardCheck,
  Banknote, CalendarCheck, Brain, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/funcionarios', icon: Users, label: 'Funcionários' },
  { to: '/presenca', icon: ClipboardCheck, label: 'Presença' },
  { to: '/vales', icon: Banknote, label: 'Vales' },
  { to: '/fechamento', icon: CalendarCheck, label: 'Fechamento' },
  { to: '/relatorio-ia', icon: Brain, label: 'Relatório IA' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={`bg-sidebar flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'} shrink-0`}
      >
        <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border">
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-primary tracking-tight">
              Espetos & Cia
            </span>
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
          <div className="px-4 py-4 border-t border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/60">Sistema Interno v1.0</p>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
