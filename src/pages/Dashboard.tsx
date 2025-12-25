import { useEffect, useMemo, useState } from 'react'
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
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const uid = await getUserId()
        if (!uid || !mounted) return

        const { data: u } = await supabase
          .from('vw_budget_usage')
          .select('category_name, limit_amount, spent_amount')
          .eq('month', month)
          .eq('year', year)
          .eq('user_id', uid)

        const { data: s } = await supabase
          .from('vw_monthly_summary')
          .select('*')
          .eq('month', month)
          .eq('year', year)
          .eq('user_id', uid)
          .maybeSingle()

        // IMPORTANTE: filtrar alertas por usuário (assumindo que sua tabela possui user_id)
        const { data: a } = await supabase
          .from('alerts')
          .select('id,message,severity')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(3)

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
        if (mounted) setLoading(false)
      }
    }

    load()

    const ch = supabase
      .channel('usage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(ch)
    }
  }, [month, year])

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
  const reserveTarget =
    reserve?.target_amount === null || reserve?.target_amount === undefined ? null : Number(reserve.target_amount)
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

  // Paleta “Babilônia Moderna” (sem depender de tailwind.config)
  const chartColors = useMemo(
    () => [
      '#C2A14D', // ouro antigo
      '#0EA5E9', // céu (destaque frio)
      '#10B981', // verde (ok)
      '#F59E0B', // atenção
      '#EF4444', // crítico
      '#6366F1', // indigo
      '#14B8A6', // teal
      '#E11D48', // rose
    ],
    []
  )

  const tipsKeys = useMemo(() => {
    if (!alerts.length) return []
    return [...new Set(alerts.map((a) => (a.severity === 'critical' ? 'budget_critical' : 'budget_warning')))]
  }, [alerts])

  if (loading) {
    return (
      <div className="mt-8">
        {/* AUMENTO DE LARGURA: container mais largo + padding responsivo */}
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 text-sm text-[#6B7280] shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
            Carregando…
          </div>
        </div>
      </div>
    )
  }

  // Helpers de UI
  const Card = ({
    title,
    right,
    children,
    className = '',
  }: {
    title?: string
    right?: React.ReactNode
    children: React.ReactNode
    className?: string
  }) => (
    <section
      className={`rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_6px_18px_rgba(11,19,36,0.08)] ${className}`}
    >
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            {title && (
              <h3 className="font-[ui-serif,Georgia,serif] text-[18px] tracking-[-0.2px] text-[#111827]">
                {title}
              </h3>
            )}
            <div className="mt-2 h-[2px] w-16 rounded-full bg-[#C2A14D]" />
          </div>
          {right}
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  )

  const KPI = ({
    label,
    value,
    hint,
    tone,
  }: {
    label: string
    value: string
    hint?: string
    tone?: 'neutral' | 'ok' | 'warn' | 'bad'
  }) => {
    const toneCls =
      tone === 'ok'
        ? 'text-[#2E7D32]'
        : tone === 'warn'
          ? 'text-[#D97706]'
          : tone === 'bad'
            ? 'text-[#B91C1C]'
            : 'text-[#111827]'

    return (
      <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#6B7280]">{label}</p>
          <span className="h-2 w-2 rounded-full bg-[#C2A14D]" />
        </div>
        <p className={`mt-2 text-3xl font-semibold tracking-[-0.6px] ${toneCls}`}>{value}</p>
        {hint && <p className="mt-2 text-xs text-[#6B7280]">{hint}</p>}
        <div className="mt-4 h-px bg-[#D6D3C8]" />
        <div className="mt-3 text-xs text-[#6B7280]">Registro do mês</div>
      </div>
    )
  }

  return (
    <div className="bg-[#F5F2EB] min-h-[calc(100vh-1px)]">
      {/* AUMENTO DE LARGURA:
         - antes: max-w-6xl
         - agora: max-w-[1400px] + padding lg:px-8
      */}
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">Visão do mês</div>
            <div className="mt-1 text-xs text-[#6B7280]">Disciplina, limites e progresso</div>
          </div>

          <div className="flex gap-2">
            <select
              className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.08)]"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.08)]"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* KPIs
            Ajuste de largura:
            - antes: md:grid-cols-4
            - agora: mantém 4 em md, mas em telas grandes ganha mais “respiro” e fica mais largo pelo container maior.
        */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPI label="Renda do mês" value={fmt(income)} hint="Base do seu ciclo" />
          <KPI
            label="Ouro guardado"
            value={fmt(savings)}
            hint={`Taxa: ${(savingsRate * 100).toFixed(1)}% • Não disponível para gastos`}
            tone="ok"
          />
          <KPI label="Gasto real" value={fmt(expenses)} hint="Despesas do mês" />
          <KPI
            label="Disponível para gastar"
            value={fmt(available)}
            hint={available < 0 ? 'Atenção: mês no vermelho' : 'Dentro do planejado'}
            tone={available < 0 ? 'bad' : 'neutral'}
          />
        </div>

        {/* Linha: Orçamento (1) + Reserva (2)
            Ajuste de largura:
            - em xl, melhora a distribuição com col-span mais consistente
        */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card
            title="Top categorias (atenção)"
            right={
              <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
                Orçamento
              </span>
            }
          >
            {topUsage.length === 0 ? (
              <div className="text-sm text-[#6B7280]">
                Sem dados ainda. Registre transações para ver consumo por categoria.
              </div>
            ) : (
              <ul className="space-y-2">
                {topUsage.slice(0, 5).map((u) => {
                  const pct = u.limit_amount > 0 ? u.spent_amount / u.limit_amount : null
                  const pill =
                    pct === null
                      ? 'bg-[#F5F2EB] text-[#374151]'
                      : pct >= 1
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : pct >= 0.8
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'

                  return (
                    <li key={u.category_name} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-[#111827]">{u.category_name}</div>
                        <div className="text-xs text-[#6B7280]">
                          {fmt(u.spent_amount)}
                          {u.limit_amount > 0 ? ` / ${fmt(u.limit_amount)}` : ''}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${pill}`}>
                        {pct === null ? 'sem limite' : `${Math.round(pct * 100)}%`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-5">
              <div className="text-sm text-[#6B7280]">Uso total do orçamento</div>
              <div className="text-lg font-semibold text-[#111827]">
                {budgetLimitTotal > 0 ? `${(Math.min(1, budgetUsagePct) * 100).toFixed(0)}%` : '—'}
              </div>

              <div className="mt-2 h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(1, budgetUsagePct) * 100}%`,
                    background: budgetUsagePct >= 1 ? '#B91C1C' : budgetUsagePct >= 0.8 ? '#D97706' : '#2E7D32',
                  }}
                />
              </div>

              <div className="mt-3 text-sm flex items-center justify-between">
                <span className="text-[#6B7280]">Gasto</span>
                <span className="text-[#111827] font-medium">{fmt(budgetSpentTotal)}</span>
              </div>
              <div className="mt-1 text-sm flex items-center justify-between">
                <span className="text-[#6B7280]">Limite</span>
                <span className="text-[#111827] font-medium">{fmt(budgetLimitTotal)}</span>
              </div>
            </div>
          </Card>

          <Card
            title="Reserva de Emergência"
            right={
              <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
                Proteção
              </span>
            }
            className="lg:col-span-2"
          >
            <div className="text-sm flex items-center justify-between">
              <span className="text-[#6B7280]">Saldo atual</span>
              <span className="font-medium text-[#111827]">{fmt(reserveCurrent)}</span>
            </div>

            {reserveTarget ? (
              <>
                <div className="text-sm mt-2 flex items-center justify-between">
                  <span className="text-[#6B7280]">Meta</span>
                  <span className="font-medium text-[#111827]">{fmt(reserveTarget)}</span>
                </div>

                <div className="mt-3 h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                  <div className="h-full bg-[#0EA5E9]" style={{ width: `${(reservePct ?? 0) * 100}%` }} />
                </div>

                <div className="text-xs text-[#6B7280] mt-2">{Math.round((reservePct ?? 0) * 100)}% da meta</div>
              </>
            ) : (
              <div className="text-xs text-[#6B7280] mt-2">
                Defina o valor alvo em Configurações para acompanhar o progresso.
              </div>
            )}

            <div className="mt-4 border-t border-[#D6D3C8] pt-3 text-sm text-[#374151] italic">
              “O ouro reservado protege seu amanhã.”
            </div>
          </Card>
        </div>

        {/* Gráfico (agora ocupa bem a largura) */}
        <Card
          title="Orçamento por Categoria"
          right={
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
              Visualização
            </span>
          }
        >
          {usage.length === 0 ? (
            <div className="text-sm text-[#6B7280]">
              Sem dados ainda. Registre transações e defina limites para visualizar o gráfico.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <PieChart>
                <Pie
                  data={usage.map((u) => ({ name: u.category_name, value: Number(u.spent_amount ?? 0) }))}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={140}
                >
                  {usage.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => fmt(Number(v ?? 0))}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: '#D6D3C8',
                    backgroundColor: '#FBFAF7',
                    boxShadow: '0 10px 30px rgba(11,19,36,0.08)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Alertas + Dicas (largura total) */}
        <Card
          title="Alertas Recentes"
          right={
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
              Atenção
            </span>
          }
        >
          {alerts.length === 0 ? (
            <div className="text-sm text-[#6B7280]">
              Nenhum alerta por enquanto. Continue registrando e acompanhando seus limites.
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${a.severity === 'critical'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                  >
                    {a.severity}
                  </span>
                  <div className="text-sm text-[#111827]">{a.message}</div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <TipsPanel keys={tipsKeys} />
          </div>
        </Card>
      </div>
    </div>
  )
}
