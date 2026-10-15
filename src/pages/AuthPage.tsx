import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogIn, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { pageVariants, itemVariants } from '@/lib/motion';
import logoBlack from '@/assets/logo-black.png';

export default function AuthPage() {
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  if (!loading && user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success('Login realizado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro na autenticação');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, hsl(25 95% 58% / 0.14) 0%, transparent 70%), radial-gradient(40% 40% at 100% 100%, hsl(17 88% 40% / 0.08) 0%, transparent 70%)' }}
      />
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="relative w-full max-w-md px-6">
        <motion.div variants={itemVariants} className="text-center mb-10">
          <img src={logoBlack} alt="Espetos & Cia" className="h-28 mx-auto mb-5 object-contain mix-blend-multiply" />
          <p className="text-muted-foreground text-sm">Sistema de Gestão e CRM</p>
        </motion.div>

        <motion.div variants={itemVariants} className="metric-card shadow-lg">
          <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Bem-vindo de volta
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <Input id="login-email" autoComplete="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-xl bg-muted/30 border-muted" />
            </div>
            <div>
              <label htmlFor="login-password" className="text-xs font-medium text-muted-foreground mb-1.5 block">Senha</label>
              <Input id="login-password" autoComplete="current-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-12 rounded-xl bg-muted/30 border-muted" />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-sm font-bold mt-2" disabled={submitting}>
              {submitting
                ? <><Loader2 size={16} className="mr-2 animate-spin" /> Entrando...</>
                : <><LogIn size={16} className="mr-2" /> Entrar</>}
            </Button>
          </form>
          <p className="mt-6 pt-5 border-t border-border text-center text-xs text-muted-foreground">
            Acesso restrito. Novos usuários são cadastrados pelo administrador.
          </p>
        </motion.div>
      </motion.div>
    </div>);

}