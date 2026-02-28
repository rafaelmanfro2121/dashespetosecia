import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Sparkles, LogOut, Send, TrendingUp, TrendingDown, DollarSign, CheckCircle2 } from 'lucide-react';
import logoWhite from '@/assets/logo-white.png';

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
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, hsl(225, 30%, 12%) 0%, hsl(225, 35%, 8%) 50%, hsl(225, 30%, 12%) 100%)' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <img src={logoWhite} alt="Espetos & Cia" className="h-8 object-contain" />
        <button onClick={signOut} className="text-white/40 hover:text-white/70 transition-colors p-2">
          <LogOut size={18} />
        </button>
      </div>

      {/* Today summary */}
      <div className="px-5 pb-4">
        <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3">Hoje</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <TrendingUp size={14} className="text-emerald-400 mb-1" />
            <p className="text-white font-bold text-sm">{formatCurrency(todayIn)}</p>
            <p className="text-white/40 text-[10px]">Entradas</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <TrendingDown size={14} className="text-red-400 mb-1" />
            <p className="text-white font-bold text-sm">{formatCurrency(todayOut)}</p>
            <p className="text-white/40 text-[10px]">Saídas</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <DollarSign size={14} className="text-blue-400 mb-1" />
            <p className="text-white font-bold text-sm">{formatCurrency(todayIn - todayOut)}</p>
            <p className="text-white/40 text-[10px]">Saldo</p>
          </div>
        </div>
      </div>

      {/* Main input area */}
      <div className="flex-1 px-5 flex flex-col justify-center">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <Sparkles size={24} className="text-white" />
          </div>
          <h2 className="text-white text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            O que você comprou ou vendeu?
          </h2>
          <p className="text-white/40 text-xs mt-2">
            Diga em linguagem natural. A IA registra tudo automaticamente.
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={'Ex:\n"Vendi 2 churrasqueiras por 8.000"\n"Comprei 10 chapas de inox por 1.200"\n"Paguei conta de luz 350"'}
            className="w-full h-32 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30"
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-full h-12 rounded-xl text-sm font-bold"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={16} /> Registrar com IA
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Recent entries */}
      {recent.length > 0 && (
        <div className="px-5 pb-6">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Registrados agora</p>
          <div className="space-y-2">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <CheckCircle2 size={14} className={r.type === 'entrada' ? 'text-emerald-400' : 'text-red-400'} />
                <span className="text-white/70 text-xs flex-1 truncate">{r.description}</span>
                <span className={`text-xs font-bold ${r.type === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.type === 'entrada' ? '+' : '-'}{formatCurrency(r.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-5 pb-8">
        <div className="flex gap-2">
          {['Vendi churrasqueira', 'Comprei material', 'Paguei conta'].map(text => (
            <button
              key={text}
              onClick={() => setInput(text)}
              className="flex-1 text-[10px] text-white/30 border border-white/10 rounded-xl py-2.5 hover:bg-white/5 hover:text-white/50 transition-all"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
