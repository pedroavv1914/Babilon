import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

type Investment = { id: number; type: 'poupanca' | 'renda_fixa' | 'renda_variavel'; amount: number; expected_rate: number | null }

export default function Investments() {
  const [items, setItems] = useState<Investment[]>([])
  const [type, setType] = useState<Investment['type']>('poupanca')
  const [amount, setAmount] = useState<number>(0)
  const [rate, setRate] = useState<number>(0.08)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('investments').select('id,type,amount,expected_rate').order('created_at', { ascending: false })
    if (error) setError(error.message)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('investments').on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, () => load()).subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  async function addInvestment(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const uid = await getUserId()
    if (!uid) return
    const { error } = await supabase.from('investments').insert({ user_id: uid, type, amount, expected_rate: rate })
    if (error) setError(error.message)
    setAmount(0)
    setRate(0.08)
  }

  const simulation = useMemo(() => {
    const months = 12
    const data = []
    for (let m = 1; m <= months; m++) {
      let total = 0
      for (const inv of items) {
        const r = (inv.expected_rate ?? 0) / 12
        total += inv.amount * Math.pow(1 + r, m)
      }
      data.push({ month: m, value: total })
    }
    return data
  }, [items])

  if (loading) return <div>Carregando...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Novo Investimento</div>
        <form onSubmit={addInvestment} className="space-y-3">
          <select className="border rounded px-3 py-2 w-full" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="poupanca">Poupança</option>
            <option value="renda_fixa">Renda Fixa</option>
            <option value="renda_variavel">Renda Variável</option>
          </select>
          <input className="border rounded px-3 py-2 w-full" type="number" step="0.01" placeholder="Valor" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <label className="block text-sm">Taxa esperada (anual, ex.: 0.08 = 8%)</label>
          <input className="border rounded px-3 py-2 w-full" type="number" step="0.001" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          {error ? <div className="text-red-600 text-sm">{error}</div> : null}
          <button className="bg-slate-900 text-white rounded px-4 py-2">Adicionar</button>
        </form>
      </div>

      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Simulação 12 meses</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={simulation}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v as number)} />
            <Tooltip formatter={(v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)} />
            <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

