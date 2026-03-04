import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, getDaysInMonth, getBusinessDaysInMonth } from '@/lib/formatters';
import { ClipboardCheck } from 'lucide-react';

type AttendanceStatus = 'presente' | 'falta' | 'meio-periodo';

const statusColors: Record<AttendanceStatus, string> = {
  'presente': 'bg-success/15 text-success border-success/30',
  'falta': 'bg-destructive/15 text-destructive border-destructive/30',
  'meio-periodo': 'bg-warning/15 text-warning border-warning/30',
};

const statusLabels: Record<AttendanceStatus, string> = {
  'presente': 'P',
  'falta': 'F',
  'meio-periodo': '½',
};

export default function PresencaPage() {
  const { employees, attendance, addAttendance } = useFinance();
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const daysInMonth = getDaysInMonth(month, year);
  const businessDays = getBusinessDaysInMonth(month, year);
  const activeEmployees = employees.filter(e => e.status === 'ativo');
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isWeekend = (day: number) => {
    const d = new Date(year, month, day).getDay();
    return d === 0 || d === 6;
  };

  const getStatus = (empId: string, day: number): AttendanceStatus | null => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = attendance.find(a => a.employee_id === empId && a.presence_date === dateStr);
    return (record?.status as AttendanceStatus) || null;
  };

  const cycleStatus = (empId: string, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const current = getStatus(empId, day);
    const cycle: AttendanceStatus[] = ['presente', 'falta', 'meio-periodo'];
    const nextIdx = current ? (cycle.indexOf(current) + 1) % cycle.length : 0;
    addAttendance({ employee_id: empId, presence_date: dateStr, status: cycle[nextIdx] });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="page-title">Controle de Presença</h1>
          <p className="text-muted-foreground text-xs">{getMonthName(month)} de {year} — {businessDays} dias úteis — Clique para alternar: P / F / ½</p>
        </div>
      </div>

      <div className="h-6" />

      {activeEmployees.length === 0 ? (
        <div className="metric-card text-center py-12 text-muted-foreground">
          Cadastre funcionários primeiro
        </div>
      ) : (
        <div className="metric-card overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left font-medium text-muted-foreground sticky left-0 bg-card min-w-[130px] text-xs">Funcionário</th>
                {days.map(d => (
                  <th key={d} className={`pb-3 text-center font-medium w-8 ${isWeekend(d) ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => (
                <tr key={emp.id} className="border-b border-muted/40">
                  <td className="py-2 font-medium sticky left-0 bg-card">{emp.name}</td>
                  {days.map(d => {
                    const weekend = isWeekend(d);
                    const status = getStatus(emp.id, d);
                    return (
                      <td key={d} className={`py-2 text-center ${weekend ? 'bg-muted/10' : ''}`}>
                        {weekend ? (
                          <span className="w-7 h-7 rounded-lg text-[10px] font-bold inline-flex items-center justify-center text-muted-foreground/20">—</span>
                        ) : (
                          <button
                            onClick={() => cycleStatus(emp.id, d)}
                            className={`w-7 h-7 rounded-lg text-[10px] font-bold border transition-all duration-150 hover:scale-110 ${status ? statusColors[status] : 'bg-muted/20 text-muted-foreground/30 border-transparent hover:bg-muted/50'}`}
                          >
                            {status ? statusLabels[status] : '·'}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
