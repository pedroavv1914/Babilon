import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && !loading
  }, [email, password, loading])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg = String(error.message || '')
      const lower = msg.toLowerCase()
      if (lower.includes('email not confirmed')) {
        setError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada e spam.')
      } else if (lower.includes('invalid login credentials')) {
        setError('E-mail ou senha incorretos. Verifique os dados e tente novamente.')
      } else if (lower.includes('invalid') && (lower.includes('password') || lower.includes('credentials'))) {
        setError('Não foi possível entrar com essas credenciais. Verifique e tente novamente.')
      } else {
        setError(msg)
      }
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    setError(null)
    const safeEmail = email.trim()
    if (!safeEmail) {
      setError('Informe seu e-mail para recuperar a senha.')
      return
    }
    setLoading(true)
    try {
      // IMPORTANTE: ajuste para a URL real do seu app (onde você trata o reset)
      const redirectTo = `${window.location.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(safeEmail, { redirectTo })
      if (error) throw error
      setError('Se o e-mail existir, enviaremos um link de recuperação. Verifique sua caixa de entrada e spam.')
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao solicitar recuperação de senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full flex justify-center px-4 py-6 lg:min-h-[calc(100vh-140px)] lg:items-center">
      <div className="w-full max-w-[1040px] grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel visual / manifesto */}
        <div className="relative overflow-hidden rounded-2xl border border-[#D6D3C8] bg-[#0B1220] shadow-[0_24px_80px_rgba(11,19,36,0.30)]">
          <div
            className="absolute inset-0 opacity-[0.22]"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, rgba(194,161,77,0.65) 0%, rgba(194,161,77,0.05) 40%, transparent 60%), radial-gradient(circle at 70% 60%, rgba(14,165,233,0.55) 0%, rgba(14,165,233,0.06) 45%, transparent 60%), radial-gradient(circle at 40% 75%, rgba(16,185,129,0.55) 0%, rgba(16,185,129,0.06) 45%, transparent 60%)',
            }}
          />
          <div className="relative p-6 sm:p-8 h-full flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl border border-[#C2A14D]/45 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex items-center justify-center">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C2A14D]" />
              </div>
              <div>
                <div className="font-[ui-serif,Georgia,serif] text-[18px] tracking-[-0.2px] text-white">Babilon</div>
                <div className="text-xs text-white/70">Sabedoria financeira aplicada</div>
              </div>
            </div>

            <div className="mt-10">
              <div className="font-[ui-serif,Georgia,serif] text-3xl leading-tight tracking-[-0.8px] text-white">
                Disciplina hoje.
                <br />
                Liberdade amanhã.
              </div>
              <div className="mt-3 text-sm text-white/75 max-w-[44ch]">
                Registre suas entradas, separe seu “ouro guardado” e acompanhe seus limites com clareza.
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-[#C2A14D]" />
                  Registre
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-[#0EA5E9]" />
                  Orce
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  Invista
                </span>
              </div>
            </div>

            <div className="mt-10 border-t border-white/10 pt-5">
              <div className="text-xs text-white/70 italic">“O ouro reservado protege seu amanhã.”</div>
            </div>
          </div>
        </div>

        {/* <div className="lg:hidden">
          <button
            type="button"
            className="w-full rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] px-5 py-4 text-left shadow-[0_10px_30px_rgba(11,19,36,0.08)]"
            onClick={() => document.getElementById('cadastro')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#111827]">Novo por aqui?</div>
                <div className="mt-1 text-xs text-[#6B7280]">Role para baixo e crie sua conta.</div>
              </div>
              <span className="h-9 w-9 shrink-0 rounded-xl border border-[#D6D3C8] bg-white flex items-center justify-center text-[#111827]">
                ↓
              </span>
            </div>
          </button>
        </div> */}

        {/* Form */}
        <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_18px_60px_rgba(11,19,36,0.12)]">
          <div className="p-6 sm:p-8">
            <div>
              <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">Entrar</div>
              <div className="mt-1 text-xs text-[#6B7280]">Acesse sua conta para continuar o seu ciclo mensal.</div>
              <div className="mt-4 h-[2px] w-16 rounded-full bg-[#C2A14D]" />
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">E-mail</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/35"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-xs text-[#6B7280] mb-1">Senha</label>
                  <button
                    type="button"
                    className="text-xs text-[#0B5E86] hover:underline disabled:opacity-60"
                    onClick={handleForgotPassword}
                    disabled={loading}
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/35"
                  placeholder="Sua senha"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
                  {error}
                </div>
              ) : null}

              <button
                className="w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm text-white shadow-[0_14px_40px_rgba(11,19,36,0.20)] hover:bg-black disabled:opacity-60"
                disabled={!canSubmit}
              >
                {loading ? 'Processando…' : 'Entrar'}
              </button>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-xs text-[#6B7280]">Ainda não tem conta?</div>
                <Link
                  className="text-xs rounded-full border border-[#D6D3C8] bg-white px-3 py-1.5 text-[#111827] hover:bg-[#F5F2EB]"
                  to="/register"
                >
                  Criar conta
                </Link>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[#C2A14D]">
                  <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.352-.272-2.636-.759-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
                <span>Dados isolados e protegidos por criptografia.</span>
              </div>
            </form>

            <div className="mt-4 border-t border-[#E4E1D6] pt-4 text-xs text-[#6B7280]">
              Ao entrar, você concorda em usar o Babilon para controle pessoal de finanças.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
