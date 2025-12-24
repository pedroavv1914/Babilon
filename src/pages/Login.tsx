import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
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
        <Link className="underline" to="/register">
          Criar conta
        </Link>
      </div>
    </div>
  )
}
