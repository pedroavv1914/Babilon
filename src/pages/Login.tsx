import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleSignup(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${apiUrl.replace(/\/+$/, '')}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await r.json().catch(() => null)
      if (!r.ok) {
        setError((data && (data.message || data.error)) ? String(data.message || data.error) : 'Erro ao cadastrar')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12 bg-white border rounded p-6">
      <h1 className="text-lg font-semibold mb-4">Entrar</h1>
      <form onSubmit={handleLogin} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border rounded px-3 py-2" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <div className="text-red-600 text-sm">{error}</div> : null}
        <button className="w-full bg-slate-900 text-white rounded py-2" disabled={loading}>
          {loading ? 'Processando...' : 'Entrar'}
        </button>
      </form>
      <div className="text-sm mt-4">
        <button className="underline" onClick={handleSignup} disabled={loading}>
          Criar conta
        </button>
      </div>
    </div>
  )
}
