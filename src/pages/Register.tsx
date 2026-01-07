import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && email.trim().length > 3 && password.length >= 8 && agree && !loading
  }, [name, email, password, agree, loading])

  function formatRegisterError(message: string, fallback: string) {
    const msg = String(message ?? '').trim()
    const lower = msg.toLowerCase()

    if (lower.includes('already') && (lower.includes('registered') || lower.includes('exists'))) {
      return 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.'
    }
    if (lower.includes('invalid') && lower.includes('email')) {
      return 'E-mail inválido. Verifique o formato (ex.: voce@exemplo.com).'
    }
    if (lower.includes('password') && (lower.includes('weak') || lower.includes('minimum') || lower.includes('short'))) {
      return 'Sua senha parece fraca. Use pelo menos 8 caracteres (misture letras, números e símbolos).'
    }
    return msg || fallback
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    setPendingEmail(null)
    setNeedsEmailConfirm(false)

    try {
      const safeEmail = email.trim()
      const safeName = name.trim()

      const { data, error } = await supabase.auth.signUp({
        email: safeEmail,
        password,
        options: {
          data: { name: safeName },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (error) {
        setError(formatRegisterError(error.message, 'Erro ao cadastrar'))
        return
      }

      if (data.session) {
        setSuccess('Conta criada com sucesso. Você já pode entrar.')
        setNeedsEmailConfirm(false)
      } else {
        setSuccess(
          `Conta criada com sucesso. Enviamos um e-mail de confirmação para ${safeEmail}. Verifique sua caixa de entrada e spam.`
        )
        setNeedsEmailConfirm(true)
      }
      setPendingEmail(safeEmail)
      setName('')
      setEmail('')
      setPassword('')
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao cadastrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendConfirmation() {
    const safeEmail = String(pendingEmail ?? '').trim()
    if (!safeEmail) return
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: safeEmail,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      })
      if (error) {
        setError(formatRegisterError(error.message, 'Erro ao reenviar e-mail de confirmação'))
        return
      }
      setSuccess(`E-mail de confirmação reenviado para ${safeEmail}. Verifique sua caixa de entrada e spam.`)
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao reenviar e-mail de confirmação.')
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
                Comece o ciclo.
                <br />
                Proteja o futuro.
              </div>
              <div className="mt-3 text-sm text-white/75 max-w-[48ch]">
                Crie sua conta para registrar rendas, controlar limites e transformar disciplina em progresso.
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-[#C2A14D]" />
                  Pague-se primeiro
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-[#0EA5E9]" />
                  Limites por categoria
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                  <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                  Consistência mensal
                </span>
              </div>
            </div>

            <div className="mt-10 border-t border-white/10 pt-5">
              <div className="text-xs text-white/70 italic">“A riqueza cresce onde há disciplina.”</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_18px_60px_rgba(11,19,36,0.12)]">
          <div className="p-6 sm:p-8">
            <div>
              <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">Criar conta</div>
              <div className="mt-1 text-xs text-[#6B7280]">Ative seu acesso por e-mail após o cadastro (verifique o spam).</div>
              <div className="mt-4 h-[2px] w-16 rounded-full bg-[#C2A14D]" />
            </div>

            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Nome</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/35"
                  placeholder="Como você quer ser chamado(a)"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-xs text-[#6B7280] mb-1">E-mail</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/35"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Senha</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/35"
                  placeholder="Mínimo de 8 caracteres"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <div className="mt-1 text-[11px] text-[#6B7280]">
                  Dica: use uma frase curta com números (ex.: <span className="italic">MeuCiclo2025!</span>).
                </div>
              </div>

              <label className="flex items-start gap-2 rounded-xl border border-[#E4E1D6] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span className="text-xs text-[#374151]">
                  Eu entendo que este é um sistema para controle pessoal e aceito receber e-mails de confirmação de acesso.
                </span>
              </label>

              {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <div>{success}</div>
                  {needsEmailConfirm && pendingEmail ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-emerald-900/80">Não chegou? Verifique o spam/lixo eletrônico.</div>
                      <button
                        type="button"
                        className="text-xs rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                        onClick={handleResendConfirmation}
                        disabled={loading}
                      >
                        Reenviar e-mail
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
                  {error}
                </div>
              ) : null}

              <button
                className="w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm text-white shadow-[0_14px_40px_rgba(11,19,36,0.20)] hover:bg-black disabled:opacity-60"
                disabled={!canSubmit}
              >
                {loading ? 'Processando…' : 'Criar conta'}
              </button>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-xs text-[#6B7280]">Já tem conta?</div>
                <Link
                  className="text-xs rounded-full border border-[#D6D3C8] bg-white px-3 py-1.5 text-[#111827] hover:bg-[#F5F2EB]"
                  to="/login"
                >
                  Entrar
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
              Ao criar uma conta, você concorda em usar o Babilon para controle pessoal de finanças.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
