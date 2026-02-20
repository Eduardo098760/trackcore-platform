'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth';
import { Loader2, MapPin, ArrowRight } from 'lucide-react';

/* Ícones sociais (outline) */
function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(email, password);
      setAuth(response.user, response.token, email, password, rememberMe);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { email: savedEmail } = useAuthStore.getState().getCredentials();
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Coluna esquerda - Welcome (desktop) */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-primary">
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-72 h-72 rounded-3xl bg-white/30 rotate-12 translate-x-1/4" />
          <div className="absolute w-56 h-56 rounded-3xl bg-white/20 -rotate-6 -translate-x-1/4 translate-y-1/4" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center px-12 text-left w-full [color:hsl(var(--primary-foreground))]">
          <div className="w-full max-w-xs flex flex-col items-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 mb-8">
              <MapPin className="w-10 h-10 text-inherit" strokeWidth={2} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight"> TrackCore</h1>
            <p className="text-white/95 text-base mt-2 font-normal">
              Entre para acessar o sistema
            </p>
          </div>
        </div>
      </div>

      {/* Mobile: barra superior com marca */}
      <div className="lg:hidden flex items-center justify-center gap-2 py-5 px-4 w-full bg-primary shrink-0 [color:hsl(var(--primary-foreground))]">
        <MapPin className="w-8 h-8 text-inherit" strokeWidth={2} />
        <span className="text-xl font-bold">TrackCore</span>
      </div>

      {/* Coluna direita - Formulário */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-muted/80 min-h-0">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-xl p-8 sm:p-10 border border-border">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                Entrar
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Entre para acessar o sistema
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 rounded-xl bg-muted border-0 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <Input
                  id="password"
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 rounded-xl bg-muted border-0 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-ring"
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer text-muted-foreground">
                  Manter-me conectado
                </Label>
              </div>

              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring border-0 shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    ENTRAR
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
            </form>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            © {new Date().getFullYear()} Track Core. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
