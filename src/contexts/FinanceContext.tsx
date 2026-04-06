import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getBusinessDaysInMonth } from '@/lib/formatters';

// Types matching Supabase schema
export interface Transaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string;
  category_id: string | null;
  category_name?: string;
  type: 'entrada' | 'saida';
  payment_method: string;
  user_id: string;
}

export interface Employee {
  id: string;
  name: string;
  salary: number;
  hire_date: string;
  status: 'ativo' | 'inativo';
  age?: number | null;
  job_function?: string;
  contract_url?: string | null;
  cpf?: string;
  pix_key?: string;
  payment_type?: 'mensal' | 'diaria';
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  presence_date: string;
  status: 'presente' | 'falta' | 'meio-periodo';
  late_hours: number;
}

export interface Vale {
  id: string;
  employee_id: string;
  vale_date: string;
  amount: number;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

export interface EmployeeClosing {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  absences: number;
  halfDays: number;
  absenceDiscount: number;
  valesTotal: number;
  finalSalary: number;
}

export interface MonthlyClosing {
  month: number;
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  totalSalaries: number;
  totalVales: number;
  netProfit: number;
  margin: number;
  employeeDetails: EmployeeClosing[];
}

interface FinanceContextType {
  transactions: Transaction[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  vales: Vale[];
  categories: Category[];
  loading: boolean;
  addTransaction: (t: Omit<Transaction, 'id' | 'user_id' | 'category_name'>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  addEmployee: (e: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (e: Employee) => Promise<void>;
  removeEmployee: (id: string) => Promise<void>;
  addAttendance: (a: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  updateAttendanceLateHours: (employeeId: string, date: string, lateHours: number) => Promise<void>;
  addVale: (v: Omit<Vale, 'id'>) => Promise<void>;
  removeVale: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  getMonthlyClosing: (month: number, year: number) => MonthlyClosing;
  getMonthTransactions: (month: number, year: number) => Transaction[];
  refreshData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [vales, setVales] = useState<Vale[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [txRes, empRes, attRes, valesRes, catRes] = await Promise.all([
        supabase.from('transactions').select('*, categories(name)').order('transaction_date', { ascending: false }),
        supabase.from('employees').select('*').order('name'),
        supabase.from('attendance').select('*'),
        supabase.from('vales').select('*').order('vale_date', { ascending: false }),
        supabase.from('categories').select('*').order('name'),
      ]);

      if (txRes.data) setTransactions(txRes.data.map((t: any) => ({
        ...t, category_name: t.categories?.name || 'Sem categoria'
      })));
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (attRes.data) setAttendance(attRes.data as AttendanceRecord[]);
      if (valesRes.data) setVales(valesRes.data as Vale[]);
      if (catRes.data) setCategories(catRes.data as Category[]);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addTransaction = useCallback(async (t: Omit<Transaction, 'id' | 'user_id' | 'category_name'>) => {
    if (!user) return;
    const { error } = await supabase.from('transactions').insert({ ...t, user_id: user.id });
    if (error) { toast.error('Erro ao salvar'); throw error; }
    await fetchAll();
  }, [user, fetchAll]);

  const removeTransaction = useCallback(async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    await fetchAll();
  }, [fetchAll]);

  const addEmployee = useCallback(async (e: Omit<Employee, 'id'>) => {
    const { error } = await supabase.from('employees').insert(e);
    if (error) { toast.error('Erro ao salvar'); throw error; }
    await fetchAll();
  }, [fetchAll]);

  const updateEmployee = useCallback(async (e: Employee) => {
    const { error } = await supabase.from('employees').update({
      name: e.name, salary: e.salary, hire_date: e.hire_date, status: e.status,
      age: (e as any).age, job_function: (e as any).job_function, contract_url: (e as any).contract_url,
      payment_type: (e as any).payment_type,
    }).eq('id', e.id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    await fetchAll();
  }, [fetchAll]);

  const removeEmployee = useCallback(async (id: string) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    await fetchAll();
  }, [fetchAll]);

  const addAttendance = useCallback(async (a: Omit<AttendanceRecord, 'id'>) => {
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('employee_id', a.employee_id)
      .eq('presence_date', a.presence_date)
      .maybeSingle();

    if (existing) {
      await supabase.from('attendance').update({ status: a.status, late_hours: a.late_hours ?? 0 }).eq('id', existing.id);
    } else {
      await supabase.from('attendance').insert({ ...a, late_hours: a.late_hours ?? 0 });
    }
    await fetchAll();
  }, [fetchAll]);

  const updateAttendanceLateHours = useCallback(async (employeeId: string, date: string, lateHours: number) => {
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('presence_date', date)
      .maybeSingle();

    if (existing) {
      await supabase.from('attendance').update({ late_hours: lateHours }).eq('id', existing.id);
    } else {
      await supabase.from('attendance').insert({ employee_id: employeeId, presence_date: date, status: 'presente', late_hours: lateHours });
    }
    await fetchAll();
  }, [fetchAll]);

  const addVale = useCallback(async (v: Omit<Vale, 'id'>) => {
    const { error } = await supabase.from('vales').insert(v);
    if (error) { toast.error('Erro ao salvar'); throw error; }
    await fetchAll();
  }, [fetchAll]);

  const removeVale = useCallback(async (id: string) => {
    const { error } = await supabase.from('vales').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    await fetchAll();
  }, [fetchAll]);

  const addCategory = useCallback(async (name: string) => {
    const { error } = await supabase.from('categories').insert({ name });
    if (error) { toast.error('Categoria já existe ou erro'); return; }
    await fetchAll();
  }, [fetchAll]);

  const removeCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    await fetchAll();
  }, [fetchAll]);

  const getMonthTransactions = useCallback((month: number, year: number) => {
    return transactions.filter(t => {
      const d = new Date(t.transaction_date + 'T12:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [transactions]);

  const getMonthlyClosing = useCallback((month: number, year: number): MonthlyClosing => {
    const monthTx = getMonthTransactions(month, year);
    const totalRevenue = monthTx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = monthTx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.amount), 0);

    const activeEmployees = employees.filter(e => e.status === 'ativo');
    const employeeDetails: EmployeeClosing[] = activeEmployees.map(emp => {
      const monthAtt = attendance.filter(a => {
        const d = new Date(a.presence_date + 'T12:00:00');
        return a.employee_id === emp.id && d.getMonth() === month && d.getFullYear() === year;
      });
      const presences = monthAtt.filter(a => a.status === 'presente').length;
      const absences = monthAtt.filter(a => a.status === 'falta').length;
      const halfDays = monthAtt.filter(a => a.status === 'meio-periodo').length;
      const empVales = vales.filter(v => {
        const d = new Date(v.vale_date + 'T12:00:00');
        return v.employee_id === emp.id && d.getMonth() === month && d.getFullYear() === year;
      });
      const valesTotal = empVales.reduce((s, v) => s + Number(v.amount), 0);

      const paymentType = (emp as any).payment_type || 'mensal';
      let absenceDiscount = 0;
      let baseSalary = Number(emp.salary);
      let finalSalary = 0;

      if (paymentType === 'diaria') {
        // Daily: salary field = daily rate, pay = (presences + halfDays*0.5) * dailyRate
        const earned = (presences + halfDays * 0.5) * baseSalary;
        absenceDiscount = 0;
        finalSalary = Math.max(0, earned - valesTotal);
      } else {
        // Monthly: fixed salary minus absences based on business days
        const businessDays = getBusinessDaysInMonth(month, year);
        const dailyRate = baseSalary / businessDays;
        absenceDiscount = (absences * dailyRate) + (halfDays * dailyRate * 0.5);
        finalSalary = Math.max(0, baseSalary - absenceDiscount - valesTotal);
      }

      return { employeeId: emp.id, employeeName: emp.name, baseSalary, absences, halfDays, absenceDiscount, valesTotal, finalSalary };
    });

    const totalSalaries = employeeDetails.reduce((s, e) => s + e.finalSalary, 0);
    const totalVales = employeeDetails.reduce((s, e) => s + e.valesTotal, 0);
    const netProfit = totalRevenue - totalExpenses - totalSalaries;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { month, year, totalRevenue, totalExpenses, totalSalaries, totalVales, netProfit, margin, employeeDetails };
  }, [transactions, employees, attendance, vales, getMonthTransactions]);

  return (
    <FinanceContext.Provider value={{
      transactions, employees, attendance, vales, categories, loading,
      addTransaction, removeTransaction, addEmployee, updateEmployee, removeEmployee,
      addAttendance, updateAttendanceLateHours, addVale, removeVale, addCategory, removeCategory,
      getMonthlyClosing, getMonthTransactions, refreshData: fetchAll,
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
