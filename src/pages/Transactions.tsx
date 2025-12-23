import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import TipsPanel from '../components/TipsPanel'

type Category = { id: number; name: string }
type Alert = { id: number; type: string; severity: string; message: string; created_at: string }

export default function Transactions() {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [kind, setKind] = useState<'despesa' | 'aporte_reserva'>('despesa')
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data: cats } = await supabase.from('categories').select('id,name').order('name')
    setCategories(cats || [])
    const { data: al } = await supabase.from('alerts').select('id,type,severity,message,created_at').order('created_at', { ascending: false }).limit(20)
    setAlerts(al || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch1 = supabase.channel('transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load()).subscribe()
    const ch2 = supabase.channel('alerts').on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => load()).subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [])

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const uid = await getUserId()
    if (!uid) return
    const payload: any = { user_id: uid, amount, kind, occurred_at: date }
    if (categoryId) payload.category_id = categoryId
    const { error } = await supabase.from('transactions').insert(payload)
    if (error) setError(error.message)
    setAmount(0)
    setKind('despesa')
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Nova Transação</div>
        <form onSubmit={addTransaction} className="space-y-3">
          <select className="border rounded px-3 py-2 w-full" value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))}>
            <option value="">Sem categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="border rounded px-3 py-2 w-full" value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="despesa">Despesa</option>
            <option value="aporte_reserva">Aporte à Reserva</option>
          </select>
          <input className="border rounded px-3 py-2 w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="border rounded px-3 py-2 w-full" type="number" step="0.01" placeholder="Valor" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          {error ? <div className="text-red-600 text-sm">{error}</div> : null}
          <button className="bg-slate-900 text-white rounded px-4 py-2">Adicionar</button>
        </form>
      </div>

      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Alertas</div>
        <ul className="space-y-2">
          {alerts.map(a => (
            <li key={a.id} className="flex items-start gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.severity}</span>
              <div>
                <div className="text-sm">{a.message}</div>
                <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString('pt-BR')}</div>
              </div>
            </li>
          ))}
        </ul>
        <TipsPanel keys={[...new Set(alerts.map(a => a.severity === 'critical' ? 'budget_critical' : a.type === 'reserva' ? 'reserve_warning' : 'budget_warning'))]} />
      </div>
    </div>
  )
}
