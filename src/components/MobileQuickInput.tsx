import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LogOut, Send, ArrowUpRight, ArrowDownLeft, Minus, CheckCircle2, Sparkles } from 'lucide-react';
import logoBlack from '@/assets/logo-black.png';

interface RecentEntry {
  type: 'entrada' | 'saida';
  description: string;
  amount: number;
}

export default function MobileQuickInput() {
  const { signOut } = useAuth();
  const { transactions, categories, addTransaction } = useFinance();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  const todayTx = transactions.filter(t => t.transaction_date === new Date().toISOString().slice(0, 10));
  const todayIn = todayTx.filter(t => t.type === 'entrada').reduce((s, t) => s + Number(t.amount), 0);
  const todayOut = todayTx.filter(t => t.type === 'saida').reduce((s, t) => s + Number(t.amount), 0);
  const balance = todayIn - todayOut;

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-report', {
        body: { financialData: { message: input }, type: 'parse' },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }

      const result = data.result;
      if (!result) { toast.error('Não entendi. Tente: "Vendi churrasqueira por 5000"'); return; }

      const cat = categories.find(c => c.name.toLowerCase() === (result.category || '').toLowerCase());
      await addTransaction({
        transaction_date: new Date().toISOString().slice(0, 10),
        description: result.description || input,
        category_id: cat?.id || null,
        type: result.type || 'saida',
        amount: result.amount || 0,
        payment_method: result.payment_method || 'Não especificado',
      });

      if (result.is_material_purchase && result.material_name) {
        await supabase.functions.invoke('ai-report', {
          body: { type: 'recalculate-costs', financialData: { materialName: result.material_name, newCost: result.amount, quantity: result.quantity || 1 } },
        }).catch(() => {});
        toast.info('🔄 Custos recalculados');
      }

      setRecent(prev => [{ type: result.type, description: result.description || input, amount: result.amount }, ...prev].slice(0, 5));
      setInput('');
      toast.success(`${result.type === 'entrada' ? '💰 Entrada' : '📦 Saída'}: ${formatCurrency(result.amount)}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro');
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

      <div className="px-6">
        <div className="h-px bg-neutral-100" />
      </div>

      {/* Main input area */}
      <div className="flex-1 px-6 pt-6 flex flex-col">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-neutral-400" />
            <h2 className="text-neutral-900 text-base font-semibold tracking-tight">
              Novo registro
            </h2>
          </div>
          <p className="text-neutral-400 text-xs">
            Descreva a entrada ou saída em linguagem natural
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={'Ex: "Vendi 2 churrasqueiras por 8.000"'}
            className="w-full h-28 rounded-2xl bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder:text-neutral-300 px-4 py-3.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all"
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-full h-12 rounded-2xl text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-none"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={15} /> Registrar
              </span>
            )}
          </Button>
        </div>

        {/* Quick chips */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {['Vendi churrasqueira', 'Comprei material', 'Paguei conta'].map(text => (
            <button
              key={text}
              onClick={() => setInput(text)}
              className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-3.5 py-2 hover:bg-neutral-100 hover:text-neutral-700 transition-all"
            >
              {text}
            </button>
          ))}
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

      {/* Safe area bottom spacer */}
      <div className="h-8" />
    </div>
  );
}
