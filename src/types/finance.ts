export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  type: 'entrada' | 'saida';
  amount: number;
  paymentMethod: string;
}

export interface Employee {
  id: string;
  name: string;
  salary: number;
  admissionDate: string;
  status: 'ativo' | 'inativo';
}

export type AttendanceStatus = 'presente' | 'falta' | 'meio-periodo';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatus;
}

export interface Vale {
  id: string;
  employeeId: string;
  date: string;
  amount: number;
  description?: string;
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

export interface EmployeeClosing {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  absences: number;
  halfDays: number;
  absenceDiscount: number;
  lateHours: number;
  lateDiscount: number;
  valesTotal: number;
  finalSalary: number;
}
