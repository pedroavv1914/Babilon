import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { getUserId } from '../lib/auth'
import TipsPanel from '../components/TipsPanel'

type BudgetUsage = { category_name: string; limit_amount: number; spent_amount: number }
type Summary = { month: number; year: number; income_amount: number; savings_amount: number; expenses_amount: number }
type Alert = { id: number; message: string; severity: string }
type Reserve = { current_amount: number; target_amount: number | null; target_months: number }
type SavingGoal = { id: number; name: string; target_amount: number | null; allocation_percent: number; is_active: boolean; created_at: string }
type GoalTx = { goal_id: number | null; amount: number }

export default function Dashboard() {
  const [usage, setUsage] = useState<BudgetUsage[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [reserve, setReserve] = useState<Reserve | null>(null)
  const [goals, setGoals] = useState<SavingGoal[]>([])
  const [goalSavedById, setGoalSavedById] = useState<Record<number, number>>({})

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

        const [{ data: g, error: gErr }, { data: tx, error: txErr }] = await Promise.all([
          supabase
            .from('saving_goals')
            .select('id,name,target_amount,allocation_percent,is_active,created_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false }),
          supabase
            .from('transactions')
            .select('goal_id,amount')
            .eq('user_id', uid)
            .eq('kind', 'aporte_meta')
            .not('goal_id', 'is', null)
            .limit(5000),
        ])
        if (gErr) throw gErr
        if (txErr) throw txErr

        setUsage(u || [])
        setSummary(s || null)
        setAlerts(a || [])
        setReserve(r || null)
        setGoals(
          (g || []).map((row: any) => ({
            id: Number(row?.id ?? 0),
            name: String(row?.name ?? ''),
            target_amount: row?.target_amount === null || row?.target_amount === undefined ? null : Number(row.target_amount),
            allocation_percent: Number(row?.allocation_percent ?? 0),
            is_active: Boolean(row?.is_active ?? true),
            created_at: String(row?.created_at ?? ''),
          }))
        )
        const goalMap: Record<number, number> = {}
        for (const t of (tx || []) as GoalTx[]) {
          const gid = Number((t as any).goal_id ?? 0)
          if (!gid) continue
          goalMap[gid] = (goalMap[gid] ?? 0) + Math.max(0, Number((t as any).amount ?? 0))
        }
        setGoalSavedById(goalMap)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()

    const ch = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saving_goals' }, () => load())
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
  const activeGoals = useMemo(() => goals.filter((g) => g.is_active), [goals])
  const goalsSavedTotal = useMemo(() => Object.values(goalSavedById).reduce((acc, v) => acc + Math.max(0, Number(v ?? 0)), 0), [goalSavedById])

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

  const chartColors = useMemo(
    () => ['#C2A14D', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#E11D48'],
    []
  )

  const spentPieData = useMemo(() => {
    return usage
      .map((u) => ({ name: u.category_name, value: Math.max(0, Number(u.spent_amount ?? 0)) }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0)
  }, [usage])

  const limitPieData = useMemo(() => {
    return usage
      .map((u) => ({ name: u.category_name, value: Math.max(0, Number(u.limit_amount ?? 0)) }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0)
  }, [usage])

  const spentPieTotal = useMemo(() => spentPieData.reduce((acc, d) => acc + d.value, 0), [spentPieData])
  const limitPieTotal = useMemo(() => limitPieData.reduce((acc, d) => acc + d.value, 0), [limitPieData])

  const tipsKeys = useMemo(() => {
    if (!alerts.length) return []
    return [...new Set(alerts.map((a) => (a.severity === 'critical' ? 'budget_critical' : 'budget_warning')))]
  }, [alerts])

  // UI helpers (mesmo padrão de Rendas)
  const Pill = ({
    children,
    variant = 'neutral',
  }: {
    children: React.ReactNode
    variant?: 'neutral' | 'gold' | 'sky'
  }) => {
    const cls =
      variant === 'gold'
        ? 'border-[#C2A14D]/40 bg-[#F5F2EB] text-[#5A4A1A]'
        : variant === 'sky'
          ? 'border-[#0EA5E9]/30 bg-[#E6F6FE] text-[#0B5E86]'
          : 'border-[#D6D3C8] bg-white text-[#6B7280]'
    return <span className={`text-xs rounded-full border px-2 py-1 ${cls}`}>{children}</span>
  }

  const Card = ({
    title,
    subtitle,
    right,
    children,
    className = '',
  }: {
    title?: string
    subtitle?: string
    right?: React.ReactNode
    children: React.ReactNode
    className?: string
  }) => (
    <section className={`rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_10px_30px_rgba(11,19,36,0.10)] ${className}`}>
      {(title || subtitle || right) && (
        <header className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              {title && (
                <h3 className="font-[ui-serif,Georgia,serif] text-[18px] tracking-[-0.3px] text-[#111827]">
                  {title}
                </h3>
              )}
              {subtitle && <div className="mt-1 text-xs text-[#6B7280]">{subtitle}</div>}
              <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />
            </div>
            {right}
          </div>
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  )

  const Stat = ({
    label,
    value,
    hint,
    tone = 'neutral',
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
      <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#6B7280]">{label}</div>
          <span className="h-2 w-2 rounded-full bg-[#C2A14D]" />
        </div>
        <div className={`mt-2 text-3xl font-semibold tracking-[-0.6px] ${toneCls}`}>{value}</div>
        {hint && <div className="mt-2 text-xs text-[#6B7280]">{hint}</div>}
        <div className="mt-4 h-px bg-[#E4E1D6]" />
        <div className="mt-3 text-[11px] text-[#6B7280]">Ciclo mensal</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mt-8">
        <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 text-sm text-[#6B7280] shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
          Carregando…
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="w-full py-6 space-y-6">
        {/* HERO CARD */}
        <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_14px_40px_rgba(11,19,36,0.10)] overflow-hidden">
          <div className="px-5 py-5 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl border border-[#C2A14D]/45 bg-white shadow-[0_10px_30px_rgba(11,19,36,0.12)] flex items-center justify-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#C2A14D]" />
                  </div>
                  <div>
                    <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">
                      Visão Geral
                    </div>
                    <div className="mt-1 text-xs text-[#6B7280]">
                      Disciplina, limites e progresso — o retrato do mês.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Pill variant="sky">Mês: {String(month).padStart(2, '0')}/{year}</Pill>
                  <Pill variant="gold">Poupança: {(savingsRate * 100).toFixed(1)}%</Pill>
                  <Pill>Metas: {fmt(goalsSavedTotal)}</Pill>
                  <Pill>Alertas: {alerts.length}</Pill>
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.10)]"
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
                  className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.10)]"
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
          </div>

          <div
            className="h-[3px] w-full"
            style={{ background: 'linear-gradient(90deg, rgba(194,161,77,0) 0%, rgba(194,161,77,0.9) 50%, rgba(194,161,77,0) 100%)' }}
          />
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat label="Renda do mês" value={fmt(income)} hint="Entrada total do ciclo" />
          <Stat label="Ouro guardado" value={fmt(savings)} hint={`Taxa: ${(savingsRate * 100).toFixed(1)}%`} tone="ok" />
          <Stat label="Gastos" value={fmt(expenses)} hint="Saídas registradas" tone={expenses > income ? 'warn' : 'neutral'} />
          <Stat label="Disponível" value={fmt(available)} hint={available < 0 ? 'Atenção: mês no vermelho' : 'Dentro do planejado'} tone={available < 0 ? 'bad' : 'neutral'} />
        </div>

        {/* GRID PRINCIPAL - MAIS LARGO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Card
            title="Orçamento e categorias"
            subtitle="Concentração de gastos no mês."
            right={<Pill>Orçamento</Pill>}
            className="lg:col-span-4"
          >
            {topUsage.length === 0 ? (
              <div className="text-sm text-[#6B7280]">Sem dados ainda. Registre transações para ver consumo por categoria.</div>
            ) : (
              <ul className="space-y-2">
                {topUsage.slice(0, 5).map((u) => {
                  const pct = u.limit_amount > 0 ? u.spent_amount / u.limit_amount : null
                  const pill =
                    pct === null
                      ? 'bg-[#F5F2EB] text-[#374151] border border-[#E4E1D6]'
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
                          {fmt(u.spent_amount)}{u.limit_amount > 0 ? ` / ${fmt(u.limit_amount)}` : ''}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pill}`}>
                        {pct === null ? 'sem limite' : `${Math.round(pct * 100)}%`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-5 rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#6B7280]">Uso total do orçamento</div>
                <Pill variant="gold">{budgetLimitTotal > 0 ? `${(Math.min(1, budgetUsagePct) * 100).toFixed(0)}%` : '—'}</Pill>
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
            subtitle="Progresso da proteção financeira."
            right={<Pill variant="sky">Proteção</Pill>}
            className="lg:col-span-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
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

                    <div className="mt-2 text-xs text-[#6B7280]">{Math.round((reservePct ?? 0) * 100)}% da meta</div>
                  </>
                ) : (
                  <div className="text-xs text-[#6B7280] mt-2">Defina o valor alvo em Configurações para acompanhar o progresso.</div>
                )}
              </div>

              <div className="rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
                <div className="text-xs text-[#6B7280]">Princípio</div>
                <div className="mt-2 font-[ui-serif,Georgia,serif] text-lg text-[#111827]">“O ouro reservado protege seu amanhã.”</div>
                <div className="mt-2 text-sm text-[#6B7280]">Progresso constante vale mais do que impulso.</div>
                <div className="mt-4 h-[2px] w-16 rounded-full bg-[#C2A14D]" />
              </div>
            </div>
          </Card>

          <Card
            title="Metas"
            subtitle="Acompanhe o progresso do que você decidiu construir."
            right={<Pill variant="gold">Ativas: {activeGoals.length}</Pill>}
            className="lg:col-span-12"
          >
            {activeGoals.length === 0 ? (
              <div className="text-sm text-[#6B7280]">Você ainda não ativou metas. Configure em Planejamento.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeGoals.map((g) => {
                  const saved = Math.max(0, Number(goalSavedById[g.id] ?? 0))
                  const target = g.target_amount === null || g.target_amount === undefined ? null : Math.max(0, Number(g.target_amount))
                  const pct = target && target > 0 ? Math.min(1, saved / target) : null
                  return (
                    <div key={g.id} className="rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#111827] truncate">{g.name || 'Meta'}</div>
                          <div className="mt-1 text-xs text-[#6B7280]">Percentual: {(Math.max(0, Number(g.allocation_percent ?? 0)) * 100).toFixed(1)}%</div>
                        </div>
                        <Pill variant="sky">{fmt(saved)}</Pill>
                      </div>

                      {target ? (
                        <>
                          <div className="mt-3 text-xs text-[#6B7280] flex items-center justify-between">
                            <span>Meta</span>
                            <span className="text-[#111827] font-medium">{fmt(target)}</span>
                          </div>
                          <div className="mt-3 h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${(pct ?? 0) * 100}%` }} />
                          </div>
                          <div className="mt-2 text-[11px] text-[#6B7280]">{Math.round((pct ?? 0) * 100)}% da meta</div>
                        </>
                      ) : (
                        <div className="mt-3 text-xs text-[#6B7280]">Defina um valor alvo em Planejamento para ver o progresso.</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <Card
          title="Orçamento por categoria"
          subtitle="Distribuição de gastos no mês."
          right={<Pill>Visualização</Pill>}
        >
          {usage.length === 0 ? (
            <div className="text-sm text-[#6B7280]">Sem dados ainda. Registre transações e defina limites para visualizar o gráfico.</div>
          ) : spentPieTotal > 0 ? (
            <ResponsiveContainer width="100%" height={380}>
              <PieChart>
                <Pie data={spentPieData} dataKey="value" nameKey="name" outerRadius={150}>
                  {spentPieData.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => fmt(Number(v ?? 0))}
                  contentStyle={{
                    borderRadius: 14,
                    borderColor: '#D6D3C8',
                    backgroundColor: '#FBFAF7',
                    boxShadow: '0 10px 30px rgba(11,19,36,0.10)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : limitPieTotal > 0 ? (
            <div>
              <div className="mb-3 text-xs text-[#6B7280]">Sem gastos registrados no mês. Exibindo distribuição dos limites definidos.</div>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie data={limitPieData} dataKey="value" nameKey="name" outerRadius={150}>
                    {limitPieData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => fmt(Number(v ?? 0))}
                    contentStyle={{
                      borderRadius: 14,
                      borderColor: '#D6D3C8',
                      backgroundColor: '#FBFAF7',
                      boxShadow: '0 10px 30px rgba(11,19,36,0.10)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-sm text-[#6B7280]">Sem valores para exibir. Defina limites e registre despesas para ver o gráfico.</div>
          )}
        </Card>

        <Card
          title="Alertas recentes"
          subtitle="Sinais do mês e recomendações."
          right={<Pill variant="gold">Atenção</Pill>}
        >
          {alerts.length === 0 ? (
            <div className="text-sm text-[#6B7280]">Nenhum alerta por enquanto. Continue registrando e acompanhando seus limites.</div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      a.severity === 'critical'
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

          <div className="mt-5">
            <TipsPanel keys={tipsKeys} />
          </div>
        </Card>
      </div>
    </div>
  )
}
