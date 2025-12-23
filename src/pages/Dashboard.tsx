import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { getUserId } from '../lib/auth'
import TipsPanel from '../components/TipsPanel'

type BudgetUsage = { category_name: string; limit_amount: number; spent_amount: number }
type Summary = { month: number; year: number; income_amount: number; savings_amount: number; expenses_amount: number }
type Alert = { id: number; message: string; severity: string }

export default function Dashboard() {
  const [usage, setUsage] = useState<BudgetUsage[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    const now = new Date()
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    async function load() {
      const uid = await getUserId()
      const { data: u } = await supabase.from('vw_budget_usage').select('category_name, limit_amount, spent_amount').eq('month', m).eq('year', y).eq('user_id', uid)
      const { data: s } = await supabase.from('vw_monthly_summary').select('*').eq('month', m).eq('year', y).eq('user_id', uid).maybeSingle()
      const { data: a } = await supabase.from('alerts').select('id,message,severity').order('created_at', { ascending: false }).limit(3)
      setUsage(u || [])
      setSummary(s || null)
      setAlerts(a || [])
      setLoading(false)
    }
    load()
    const ch = supabase
      .channel('usage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  if (loading) return <div className="mt-8">Carregando...</div>

  const colors = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6', '#e11d48', '#84cc16']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-slate-500">Renda</div>
          <div className="text-2xl font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.income_amount || 0)}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-slate-500">Poupança Automática</div>
          <div className="text-2xl font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.savings_amount || 0)}</div>
          <div className="text-xs text-slate-500 mt-1">Este dinheiro não está disponível para gastos</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-slate-500">Gastos</div>
          <div className="text-2xl font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.expenses_amount || 0)}</div>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Orçamento por Categoria</div>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={usage.map(u => ({ name: u.category_name, value: u.spent_amount }))} dataKey="value" nameKey="name" outerRadius={120}>
              {usage.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Alertas Recentes</div>
        <ul className="space-y-2">
          {alerts.map(a => (
            <li key={a.id} className="flex items-start gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.severity}</span>
              <div className="text-sm">{a.message}</div>
            </li>
          ))}
        </ul>
        <TipsPanel keys={[...new Set(alerts.map(a => a.severity === 'critical' ? 'budget_critical' : 'budget_warning'))]} />
      </div>
    </div>
  )
}

