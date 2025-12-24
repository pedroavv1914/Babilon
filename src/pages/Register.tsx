import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const payload: any = { email, password, name: name.trim() }
      const r = await fetch(`${apiUrl.replace(/\/+$/, '')}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await r.json().catch(() => null)
      if (!r.ok) {
        setError((data && (data.message || data.error)) ? String(data.message || data.error) : 'Erro ao cadastrar')
        return
      }
      setSuccess('Conta criada. Confira seu e-mail e clique no link de confirmação para ativar o acesso.')
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12 bg-white border rounded p-6">
      <h1 className="text-lg font-semibold mb-4">Criar conta</h1>
      <form onSubmit={handleRegister} className="space-y-3">
        <input className="w-full border rounded px-3 py-2" placeholder="Nome" required value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full border rounded px-3 py-2" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border rounded px-3 py-2" placeholder="Senha (mín. 8 caracteres)" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        {success ? <div className="text-green-700 text-sm">{success}</div> : null}
        {error ? <div className="text-red-600 text-sm">{error}</div> : null}
        <button className="w-full bg-slate-900 text-white rounded py-2" disabled={loading}>
          {loading ? 'Processando...' : 'Criar conta'}
        </button>
      </form>
      <div className="text-sm mt-4">
        <Link className="underline" to="/login">
          Já tenho conta
        </Link>
      </div>
    </div>
  )
}
