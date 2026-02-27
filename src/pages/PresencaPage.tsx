import { useFinance } from '@/contexts/FinanceContext';
import { getCurrentMonth, getCurrentYear, getMonthName, getDaysInMonth } from '@/lib/formatters';

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
  const activeEmployees = employees.filter(e => e.status === 'ativo');
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

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
      <h1 className="page-title mb-1">Controle de Presença</h1>
      <p className="text-muted-foreground text-sm mb-6">{getMonthName(month)} de {year} — Clique para alternar: P (Presente) / F (Falta) / ½ (Meio Período)</p>

      {activeEmployees.length === 0 ? (
        <div className="metric-card text-center py-8 text-muted-foreground">Cadastre funcionários primeiro</div>
      ) : (
        <div className="metric-card overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-2 text-left font-medium text-muted-foreground sticky left-0 bg-card min-w-[120px]">Funcionário</th>
                {days.map(d => (
                  <th key={d} className="pb-2 text-center font-medium text-muted-foreground w-8">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map(emp => (
                <tr key={emp.id} className="border-b border-muted/50">
                  <td className="py-1.5 font-medium sticky left-0 bg-card">{emp.name}</td>
                  {days.map(d => {
                    const status = getStatus(emp.id, d);
                    return (
                      <td key={d} className="py-1.5 text-center">
                        <button
                          onClick={() => cycleStatus(emp.id, d)}
                          className={`w-7 h-7 rounded text-[10px] font-bold border transition-colors ${status ? statusColors[status] : 'bg-muted/30 text-muted-foreground/40 border-transparent hover:bg-muted'}`}
                        >
                          {status ? statusLabels[status] : '·'}
                        </button>
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
