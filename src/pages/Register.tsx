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
      } else {
        setSuccess(`Conta criada com sucesso. Enviamos um e-mail de confirmação para ${safeEmail}.`)
      }
      setName('')
      setEmail('')
      setPassword('')
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao cadastrar. Tente novamente.')
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
              <div className="mt-1 text-xs text-[#6B7280]">Ative seu acesso por e-mail após o cadastro.</div>
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
                  {success}
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
            </form>

            <div className="mt-6 border-t border-[#E4E1D6] pt-4 text-xs text-[#6B7280]">
              Ao criar uma conta, você concorda em usar o Babilon para controle pessoal de finanças.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
