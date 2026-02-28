import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogIn, UserPlus, Sparkles } from 'lucide-react';
import logoBlack from '@/assets/logo-black.png';

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  if (!loading && user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-10">
          <img src={logoBlack} alt="Espetos & Cia" className="h-28 mx-auto mb-5 object-contain" />
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles size={16} className="text-primary" />
            <span className="text-sm font-medium text-primary">Powered by AI</span>
          </div>
          <p className="text-muted-foreground text-sm">Sistema Inteligente de Gestão Financeira</p>
        </div>

        <div className="metric-card">
          <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {isLogin ? 'Bem-vindo de volta' : 'Criar sua conta'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome completo</label>
                <Input placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} required className="h-12 rounded-xl bg-muted/30 border-muted" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 rounded-xl bg-muted/30 border-muted" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Senha</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-12 rounded-xl bg-muted/30 border-muted" />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold mt-2" disabled={submitting}>
              {isLogin ? <><LogIn size={16} className="mr-2" /> Entrar</> : <><UserPlus size={16} className="mr-2" /> Criar Conta</>}
            </Button>
          </form>
          <div className="mt-6 pt-5 border-t border-border">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {isLogin ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
