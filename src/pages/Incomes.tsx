import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type Income = { id: number; amount: number; month: number; year: number; rule_percent: number | null }

export default function Incomes() {
  const [items, setItems] = useState<Income[]>([])
  const [amount, setAmount] = useState<number>(0)
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [rulePercent, setRulePercent] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('incomes').select('id,amount,month,year,rule_percent').order('created_at', { ascending: false }).limit(12)
    if (error) setError(error.message)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('incomes').on('postgres_changes', { event: '*', schema: 'public', table: 'incomes' }, () => load()).subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  async function addIncome(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const uid = await getUserId()
    if (!uid) return
    const { error } = await supabase.from('incomes').insert({
      user_id: uid,
      amount,
      month,
      year,
      rule_percent: rulePercent === '' ? null : Number(rulePercent)
    })
    if (error) setError(error.message)
    setAmount(0)
    setRulePercent('')
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Cadastrar Renda</div>
        <form onSubmit={addIncome} className="space-y-3">
          <div className="flex gap-2">
            <input className="border rounded px-3 py-2 w-full" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
            <input className="border rounded px-3 py-2 w-full" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <input className="border rounded px-3 py-2 w-full" type="number" step="0.01" placeholder="Valor" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <input className="border rounded px-3 py-2 w-full" type="number" step="0.01" placeholder="Percentual personalizado (opcional)" value={rulePercent} onChange={(e) => setRulePercent(e.target.value === '' ? '' : Number(e.target.value))} />
          {error ? <div className="text-red-600 text-sm">{error}</div> : null}
          <button className="bg-slate-900 text-white rounded px-4 py-2">Salvar</button>
        </form>
      </div>

      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Rendas Recentes</div>
        <ul className="space-y-2">
          {items.map(r => (
            <li key={r.id} className="flex items-center justify-between">
              <span>{String(r.month).padStart(2, '0')}/{r.year}</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

