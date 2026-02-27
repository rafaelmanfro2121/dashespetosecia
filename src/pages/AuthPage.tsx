import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogIn, UserPlus } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success('Login realizado!');
      } else {
        await signUp(email, password, name);
        toast.success('Conta criada! Verifique seu email.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary tracking-tight">Espetos & Cia</h1>
          <p className="text-muted-foreground text-sm mt-1">Sistema de Gestão Financeira</p>
        </div>

        <div className="metric-card">
          <h2 className="section-label mb-4">{isLogin ? 'Entrar' : 'Criar Conta'}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <Input placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)} required />
            )}
            <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            <Button type="submit" className="w-full" disabled={loading}>
              {isLogin ? <><LogIn size={16} className="mr-2" /> Entrar</> : <><UserPlus size={16} className="mr-2" /> Criar Conta</>}
            </Button>
          </form>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"
          >
            {isLogin ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
