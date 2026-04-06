import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LogOut, Send, ArrowUpRight, ArrowDownLeft, CheckCircle2, Plus } from 'lucide-react';
import logoBlack from '@/assets/logo-black.png';

interface RecentEntry {
  type: 'entrada' | 'saida';
  description: string;
  amount: number;
}

export default function MobileQuickInput() {
  const { signOut } = useAuth();
  const { transactions, categories, addTransaction } = useFinance();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'entrada' | 'saida'>('saida');
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  const todayTx = transactions.filter(t => t.transaction_date === new Date().toISOString().slice(0, 10));
  const todayIn = todayTx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
  const todayOut = todayTx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.amount), 0);
  const balance = todayIn - todayOut;

  const activeCategories = categories.filter(c => c.is_active);
  const paymentMethods = ['Dinheiro', 'Pix', 'Cartão', 'Transferência'];

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Preencha a descrição e o valor');
      return;
    }
    setLoading(true);
    try {
      await addTransaction({
        transaction_date: new Date().toISOString().slice(0, 10),
        description: description.trim(),
        category_id: categoryId || null,
        type,
        amount: parsedAmount,
        payment_method: paymentMethod,
      });
      setRecent(prev => [{ type, description: description.trim(), amount: parsedAmount }, ...prev].slice(0, 5));
      setDescription('');
      setAmount('');
      toast.success(`${type === 'entrada' ? '💰 Entrada' : '📦 Saída'}: ${formatCurrency(parsedAmount)}`);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 pt-14 pb-2 flex items-center justify-between">
        <img src={logoBlack} alt="Espetos & Cia" className="h-7 object-contain" />
        <button onClick={signOut} className="text-neutral-400 hover:text-neutral-600 transition-colors p-2 -mr-2">
          <LogOut size={18} />
        </button>
      </div>

      {/* Today summary */}
      <div className="px-6 py-5">
        <p className="text-neutral-400 text-[11px] font-medium uppercase tracking-widest mb-4">Resumo de hoje</p>
        <div className="flex items-end gap-1 mb-5">
          <span className={`text-3xl font-bold tracking-tight ${balance >= 0 ? 'text-neutral-900' : 'text-red-500'}`}>
            {formatCurrency(balance)}
          </span>
          <span className="text-neutral-400 text-xs mb-1 ml-1">saldo</span>
        </div>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center">
              <ArrowUpRight size={14} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-neutral-900 text-sm font-semibold">{formatCurrency(todayIn)}</p>
              <p className="text-neutral-400 text-[10px]">Entradas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center">
              <ArrowDownLeft size={14} className="text-red-400" />
            </div>
            <div>
              <p className="text-neutral-900 text-sm font-semibold">{formatCurrency(todayOut)}</p>
              <p className="text-neutral-400 text-[10px]">Saídas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6"><div className="h-px bg-neutral-100" /></div>

      {/* Form */}
      <div className="flex-1 px-6 pt-6 flex flex-col">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Plus size={16} className="text-neutral-400" />
            <h2 className="text-neutral-900 text-base font-semibold tracking-tight">Novo registro</h2>
          </div>
        </div>

        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setType('entrada')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${type === 'entrada' ? 'bg-emerald-500 text-white' : 'bg-neutral-50 text-neutral-500 border border-neutral-200'}`}
          >
            Entrada
          </button>
          <button
            onClick={() => setType('saida')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${type === 'saida' ? 'bg-red-500 text-white' : 'bg-neutral-50 text-neutral-500 border border-neutral-200'}`}
          >
            Saída
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descrição (ex: Vendi churrasqueira)"
            className="w-full rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder:text-neutral-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all"
            disabled={loading}
          />
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Valor (ex: 5000)"
            inputMode="decimal"
            className="w-full rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder:text-neutral-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all"
            disabled={loading}
          />

          {/* Payment method */}
          <div className="flex gap-2 flex-wrap">
            {paymentMethods.map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`text-xs rounded-full px-3.5 py-2 transition-all ${paymentMethod === m ? 'bg-neutral-900 text-white' : 'bg-neutral-50 text-neutral-500 border border-neutral-200 hover:bg-neutral-100'}`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Category */}
          {activeCategories.length > 0 && (
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
            >
              <option value="">Sem categoria</option>
              {activeCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || !description.trim() || !amount.trim()}
            className="w-full h-12 rounded-2xl text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-none"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Salvando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={15} /> Registrar
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Recent entries */}
      {recent.length > 0 && (
        <div className="px-6 pb-6 mt-4">
          <p className="text-neutral-400 text-[11px] font-medium uppercase tracking-widest mb-3">Registrados agora</p>
          <div className="space-y-2">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 bg-neutral-50 rounded-2xl px-4 py-3 border border-neutral-100">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${r.type === 'entrada' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <CheckCircle2 size={13} className={r.type === 'entrada' ? 'text-emerald-500' : 'text-red-400'} />
                </div>
                <span className="text-neutral-600 text-xs flex-1 truncate">{r.description}</span>
                <span className={`text-xs font-semibold ${r.type === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {r.type === 'entrada' ? '+' : '-'}{formatCurrency(r.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
