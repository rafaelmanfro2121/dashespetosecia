import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Transaction, Employee, AttendanceRecord, Vale, MonthlyClosing, EmployeeClosing } from '@/types/finance';

interface FinanceContextType {
  transactions: Transaction[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  vales: Vale[];
  categories: string[];
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  removeTransaction: (id: string) => void;
  addEmployee: (e: Omit<Employee, 'id'>) => void;
  updateEmployee: (e: Employee) => void;
  removeEmployee: (id: string) => void;
  addAttendance: (a: Omit<AttendanceRecord, 'id'>) => void;
  updateAttendance: (a: AttendanceRecord) => void;
  addVale: (v: Omit<Vale, 'id'>) => void;
  removeVale: (id: string) => void;
  addCategory: (c: string) => void;
  removeCategory: (c: string) => void;
  getMonthlyClosing: (month: number, year: number) => MonthlyClosing;
  getMonthTransactions: (month: number, year: number) => Transaction[];
}

const FinanceContext = createContext<FinanceContextType | null>(null);

const defaultCategories = [
  'Alimentação', 'Bebidas', 'Carne', 'Funcionários', 'Energia',
  'Água', 'Aluguel', 'Manutenção', 'Materiais', 'Vendas', 'Outros'
];

function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadState('fin_transactions', []));
  const [employees, setEmployees] = useState<Employee[]>(() => loadState('fin_employees', []));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => loadState('fin_attendance', []));
  const [vales, setVales] = useState<Vale[]>(() => loadState('fin_vales', []));
  const [categories, setCategories] = useState<string[]>(() => loadState('fin_categories', defaultCategories));

  useEffect(() => { localStorage.setItem('fin_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('fin_employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem('fin_attendance', JSON.stringify(attendance)); }, [attendance]);
  useEffect(() => { localStorage.setItem('fin_vales', JSON.stringify(vales)); }, [vales]);
  useEffect(() => { localStorage.setItem('fin_categories', JSON.stringify(categories)); }, [categories]);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    setTransactions(prev => [{ ...t, id: uid() }, ...prev]);
  }, []);
  const removeTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);
  const addEmployee = useCallback((e: Omit<Employee, 'id'>) => {
    setEmployees(prev => [...prev, { ...e, id: uid() }]);
  }, []);
  const updateEmployee = useCallback((e: Employee) => {
    setEmployees(prev => prev.map(x => x.id === e.id ? e : x));
  }, []);
  const removeEmployee = useCallback((id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
  }, []);
  const addAttendance = useCallback((a: Omit<AttendanceRecord, 'id'>) => {
    setAttendance(prev => {
      const existing = prev.find(x => x.employeeId === a.employeeId && x.date === a.date);
      if (existing) return prev.map(x => x.id === existing.id ? { ...a, id: existing.id } : x);
      return [...prev, { ...a, id: uid() }];
    });
  }, []);
  const updateAttendance = useCallback((a: AttendanceRecord) => {
    setAttendance(prev => prev.map(x => x.id === a.id ? a : x));
  }, []);
  const addVale = useCallback((v: Omit<Vale, 'id'>) => {
    setVales(prev => [...prev, { ...v, id: uid() }]);
  }, []);
  const removeVale = useCallback((id: string) => {
    setVales(prev => prev.filter(v => v.id !== id));
  }, []);
  const addCategory = useCallback((c: string) => {
    setCategories(prev => prev.includes(c) ? prev : [...prev, c]);
  }, []);
  const removeCategory = useCallback((c: string) => {
    setCategories(prev => prev.filter(x => x !== c));
  }, []);

  const getMonthTransactions = useCallback((month: number, year: number) => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [transactions]);

  const getMonthlyClosing = useCallback((month: number, year: number): MonthlyClosing => {
    const monthTx = getMonthTransactions(month, year);
    const totalRevenue = monthTx.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = monthTx.filter(t => t.type === 'saida').reduce((s, t) => s + t.amount, 0);

    const activeEmployees = employees.filter(e => e.status === 'ativo');
    const employeeDetails: EmployeeClosing[] = activeEmployees.map(emp => {
      const monthAttendance = attendance.filter(a => {
        const d = new Date(a.date);
        return a.employeeId === emp.id && d.getMonth() === month && d.getFullYear() === year;
      });
      const absences = monthAttendance.filter(a => a.status === 'falta').length;
      const halfDays = monthAttendance.filter(a => a.status === 'meio-periodo').length;
      const dailyRate = emp.salary / 30;
      const absenceDiscount = (absences * dailyRate) + (halfDays * dailyRate * 0.5);
      const empVales = vales.filter(v => {
        const d = new Date(v.date);
        return v.employeeId === emp.id && d.getMonth() === month && d.getFullYear() === year;
      });
      const valesTotal = empVales.reduce((s, v) => s + v.amount, 0);
      const finalSalary = Math.max(0, emp.salary - absenceDiscount - valesTotal);
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        baseSalary: emp.salary,
        absences,
        halfDays,
        absenceDiscount,
        valesTotal,
        finalSalary,
      };
    });

    const totalSalaries = employeeDetails.reduce((s, e) => s + e.finalSalary, 0);
    const totalVales = employeeDetails.reduce((s, e) => s + e.valesTotal, 0);
    const netProfit = totalRevenue - totalExpenses - totalSalaries;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { month, year, totalRevenue, totalExpenses, totalSalaries, totalVales, netProfit, margin, employeeDetails };
  }, [transactions, employees, attendance, vales, getMonthTransactions]);

  return (
    <FinanceContext.Provider value={{
      transactions, employees, attendance, vales, categories,
      addTransaction, removeTransaction, addEmployee, updateEmployee, removeEmployee,
      addAttendance, updateAttendance, addVale, removeVale,
      addCategory, removeCategory, getMonthlyClosing, getMonthTransactions,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
