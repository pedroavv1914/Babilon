import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { getUserId } from '../lib/auth'
import TipsPanel from '../components/TipsPanel'

type BudgetUsage = { category_name: string; limit_amount: number; spent_amount: number }
type Summary = { month: number; year: number; income_amount: number; savings_amount: number; expenses_amount: number }
type Alert = { id: number; message: string; severity: string }
type Reserve = { current_amount: number; target_amount: number | null; target_months: number }

export default function Dashboard() {
  const [usage, setUsage] = useState<BudgetUsage[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [reserve, setReserve] = useState<Reserve | null>(null)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const uid = await getUserId()
        if (!uid) return
        const { data: u } = await supabase
          .from('vw_budget_usage')
          .select('category_name, limit_amount, spent_amount')
          .eq('month', month)
          .eq('year', year)
          .eq('user_id', uid)
        const { data: s } = await supabase.from('vw_monthly_summary').select('*').eq('month', month).eq('year', year).eq('user_id', uid).maybeSingle()
        const { data: a } = await supabase.from('alerts').select('id,message,severity').order('created_at', { ascending: false }).limit(3)
        const { data: r } = await supabase
          .from('emergency_reserve')
          .select('current_amount,target_amount,target_months')
          .eq('user_id', uid)
          .maybeSingle()
        setUsage(u || [])
        setSummary(s || null)
        setAlerts(a || [])
        setReserve(r || null)
      } finally {
        setLoading(false)
      }
    }
    load()
    const ch = supabase
      .channel('usage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [month, year])

  if (loading) return <div className="mt-8">Carregando...</div>

  const colors = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6', '#e11d48', '#84cc16']
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const income = Number(summary?.income_amount ?? 0)
  const savings = Number(summary?.savings_amount ?? 0)
  const expenses = Number(summary?.expenses_amount ?? 0)
  const available = income - savings - expenses
  const savingsRate = income > 0 ? savings / income : 0

  const budgetLimitTotal = usage.reduce((acc, u) => acc + Number(u.limit_amount ?? 0), 0)
  const budgetSpentTotal = usage.reduce((acc, u) => acc + Number(u.spent_amount ?? 0), 0)
  const budgetUsagePct = budgetLimitTotal > 0 ? budgetSpentTotal / budgetLimitTotal : 0

  const reserveCurrent = Number(reserve?.current_amount ?? 0)
  const reserveTarget = reserve?.target_amount === null || reserve?.target_amount === undefined ? null : Number(reserve.target_amount)
  const reservePct = reserveTarget && reserveTarget > 0 ? Math.min(1, reserveCurrent / reserveTarget) : null

  const topUsage = [...usage]
    .map((u) => ({
      category_name: u.category_name,
      limit_amount: Number(u.limit_amount ?? 0),
      spent_amount: Number(u.spent_amount ?? 0),
    }))
    .sort((a, b) => b.spent_amount - a.spent_amount)
    .slice(0, 6)

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold">Visão do mês</div>
        <div className="flex gap-2">
          <select className="border rounded px-3 py-2 bg-white" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
          <select className="border rounded px-3 py-2 bg-white" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-slate-500">Renda</div>
          <div className="text-2xl font-semibold">{fmt(income)}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-slate-500">Poupança Automática</div>
          <div className="text-2xl font-semibold">{fmt(savings)}</div>
          <div className="text-xs text-slate-500 mt-1">Este dinheiro não está disponível para gastos</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-slate-500">Gastos</div>
          <div className="text-2xl font-semibold">{fmt(expenses)}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-sm text-slate-500">Saldo do Mês</div>
          <div className={`text-2xl font-semibold ${available < 0 ? 'text-red-600' : ''}`}>{fmt(available)}</div>
          <div className="text-xs text-slate-500 mt-1">Taxa de poupança: {(savingsRate * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border rounded p-4 lg:col-span-2">
          <div className="font-semibold mb-2">Orçamento por Categoria</div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={usage.map((u) => ({ name: u.category_name, value: Number(u.spent_amount ?? 0) }))} dataKey="value" nameKey="name" outerRadius={120}>
                {usage.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(Number(v ?? 0))} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border rounded p-4">
          <div className="font-semibold mb-2">Resumo do Orçamento</div>
          <div className="text-sm text-slate-500">Uso total</div>
          <div className="text-lg font-semibold">{budgetLimitTotal > 0 ? `${(Math.min(1, budgetUsagePct) * 100).toFixed(0)}%` : '—'}</div>
          <div className="mt-2 h-2 w-full rounded bg-slate-100 overflow-hidden">
            <div className={`h-full ${budgetUsagePct >= 1 ? 'bg-red-500' : budgetUsagePct >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(1, budgetUsagePct) * 100}%` }} />
          </div>
          <div className="mt-2 text-sm flex items-center justify-between">
            <span className="text-slate-500">Gasto</span>
            <span>{fmt(budgetSpentTotal)}</span>
          </div>
          <div className="mt-1 text-sm flex items-center justify-between">
            <span className="text-slate-500">Limite</span>
            <span>{fmt(budgetLimitTotal)}</span>
          </div>

          <div className="mt-4 font-semibold">Top categorias</div>
          <ul className="mt-2 space-y-2">
            {topUsage.map((u) => {
              const pct = u.limit_amount > 0 ? u.spent_amount / u.limit_amount : null
              const pill =
                pct === null ? 'bg-slate-100 text-slate-700' : pct >= 1 ? 'bg-red-100 text-red-700' : pct >= 0.8 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              return (
                <li key={u.category_name} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{u.category_name}</div>
                    <div className="text-xs text-slate-500">
                      {fmt(u.spent_amount)}{u.limit_amount > 0 ? ` / ${fmt(u.limit_amount)}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${pill}`}>{pct === null ? 'sem limite' : `${Math.round(pct * 100)}%`}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Reserva de Emergência</div>
        <div className="text-sm flex items-center justify-between">
          <span className="text-slate-500">Saldo atual</span>
          <span className="font-medium">{fmt(reserveCurrent)}</span>
        </div>
        {reserveTarget ? (
          <>
            <div className="text-sm mt-1 flex items-center justify-between">
              <span className="text-slate-500">Meta</span>
              <span className="font-medium">{fmt(reserveTarget)}</span>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-slate-100 overflow-hidden">
              <div className="h-full bg-sky-500" style={{ width: `${(reservePct ?? 0) * 100}%` }} />
            </div>
            <div className="text-xs text-slate-500 mt-2">{Math.round((reservePct ?? 0) * 100)}% da meta</div>
          </>
        ) : (
          <div className="text-xs text-slate-500 mt-2">Defina o valor alvo em Configurações para acompanhar o progresso.</div>
        )}
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

