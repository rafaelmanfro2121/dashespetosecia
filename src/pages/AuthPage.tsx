import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogIn, UserPlus } from 'lucide-react';
import logoBlack from '@/assets/logo-black.png';

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
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <img src={logoBlack} alt="Espetos & Cia" className="h-24 mx-auto mb-4 object-contain" />
          <p className="text-muted-foreground text-sm">Sistema de Gestão Financeira</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 shadow-lg">
          <h2 className="section-label mb-5">{isLogin ? 'Entrar' : 'Criar Conta'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)} required className="h-11 rounded-lg" />
            )}
            <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11 rounded-lg" />
            <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-11 rounded-lg" />
            <Button type="submit" className="w-full h-11 rounded-lg text-sm font-semibold" disabled={loading}>
              {isLogin ? <><LogIn size={16} className="mr-2" /> Entrar</> : <><UserPlus size={16} className="mr-2" /> Criar Conta</>}
            </Button>
          </form>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-center text-sm text-muted-foreground mt-5 hover:text-primary transition-colors"
          >
            {isLogin ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
