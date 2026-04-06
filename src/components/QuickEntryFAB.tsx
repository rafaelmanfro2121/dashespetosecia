import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Send } from 'lucide-react';

export default function QuickEntryFAB() {
  const { categories, addTransaction } = useFinance();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'entrada' | 'saida'>('saida');
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);

  const activeCategories = categories.filter(c => c.is_active);
  const paymentMethods = ['Dinheiro', 'Pix', 'Cartão', 'Transferência'];

  const reset = () => {
    setDescription('');
    setAmount('');
    setType('saida');
    setPaymentMethod('Pix');
    setCategoryId('');
  };

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
      toast.success(`${type === 'entrada' ? '💰 Entrada' : '📦 Saída'}: ${formatCurrency(parsedAmount)}`);
      reset();
      setOpen(false);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <button className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all flex items-center justify-center">
          <Plus size={24} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo registro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setType('entrada')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${type === 'entrada' ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground border border-border'}`}
            >
              Entrada
            </button>
            <button
              onClick={() => setType('saida')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${type === 'saida' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground border border-border'}`}
            >
              Saída
            </button>
          </div>

          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descrição (ex: Vendi churrasqueira)"
            className="w-full rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            disabled={loading}
          />
          <input
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Valor (ex: 5000)"
            inputMode="decimal"
            className="w-full rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            disabled={loading}
          />

          {/* Payment method */}
          <div className="flex gap-2 flex-wrap">
            {paymentMethods.map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`text-xs rounded-full px-3.5 py-2 transition-all ${paymentMethod === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border hover:bg-accent'}`}
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
              className="w-full rounded-xl bg-muted border border-border text-foreground px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
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
            className="w-full h-12 rounded-2xl text-sm font-semibold"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Salvando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={15} /> Registrar
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
