import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import TipsPanel from '../components/TipsPanel'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

type Category = { id: number; name: string }
type Alert = { id: number; type: string; severity: string; message: string; created_at: string }
type TransactionKind = 'despesa' | 'aporte_reserva' | 'aporte_meta' | 'pagamento_cartao'
type TxRow = { id: number; amount: number; kind: TransactionKind; occurred_at: string; category_id: number | null; goal_id: number | null }
type BudgetRow = { category_id: number; limit_amount: number }
type GoalLite = { id: number; name: string }

export default function Transactions() {
  const [categories, setCategories] = useState<Category[]>([])
  const [goals, setGoals] = useState<GoalLite[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [goalId, setGoalId] = useState<number | null>(null)
  const [amount, setAmount] = useState<number>(0)
  const [kind, setKind] = useState<TransactionKind>('despesa')
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [items, setItems] = useState<TxRow[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const now = useMemo(() => new Date(), [])
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth() + 1)
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear())
  const [dataMonth, setDataMonth] = useState<number>(now.getMonth() + 1)
  const [dataYear, setDataYear] = useState<number>(now.getFullYear())
  const loadSeq = useRef(0)

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const yearOptions = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], [now])
  const fmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  const categoryNameById = useMemo(() => {
    const map: Record<number, string> = {}
    for (const c of categories) map[Number(c.id)] = c.name
    return map
  }, [categories])

  const goalNameById = useMemo(() => {
    const map: Record<number, string> = {}
    for (const g of goals) map[Number(g.id)] = g.name
    return map
  }, [goals])

  const budgetLimitByCategoryId = useMemo(() => {
    const map: Record<number, number> = {}
    for (const b of budgets) map[Number(b.category_id)] = Number(b.limit_amount ?? 0)
    return map
  }, [budgets])

  const monthLabel = `${String(dataMonth).padStart(2, '0')}/${dataYear}`
  const isUpdating = loading && (filterMonth !== dataMonth || filterYear !== dataYear)

  const spentByCategoryId = useMemo(() => {
    const map: Record<number, number> = {}
    for (const t of items) {
      if (t.kind !== 'despesa') continue
      const cid = Number(t.category_id ?? 0)
      if (!cid) continue
      map[cid] = (map[cid] ?? 0) + Number(t.amount ?? 0)
    }
    return map
  }, [items])

  const totals = useMemo(() => {
    const expenseTotal = items.reduce((acc, t) => acc + (t.kind === 'despesa' ? Number(t.amount ?? 0) : 0), 0)
    const reserveTotal = items.reduce((acc, t) => acc + (t.kind === 'aporte_reserva' ? Number(t.amount ?? 0) : 0), 0)
    const goalsTotal = items.reduce((acc, t) => acc + (t.kind === 'aporte_meta' ? Number(t.amount ?? 0) : 0), 0)
    const cardPaymentTotal = items.reduce((acc, t) => acc + (t.kind === 'pagamento_cartao' ? Number(t.amount ?? 0) : 0), 0)
    const savingsTotal = reserveTotal + goalsTotal
    const total = expenseTotal + savingsTotal + cardPaymentTotal
    const txCount = items.length
    const expenseCount = items.filter((t) => t.kind === 'despesa').length
    const avgExpense = expenseCount > 0 ? expenseTotal / expenseCount : 0

    let warningCount = 0
    let criticalCount = 0
    for (const [cidStr, spent] of Object.entries(spentByCategoryId)) {
      const cid = Number(cidStr)
      const lim = Number(budgetLimitByCategoryId[cid] ?? 0)
      if (lim <= 0) continue
      if (spent >= lim) criticalCount += 1
      else if (spent >= lim * 0.8) warningCount += 1
    }

    return { expenseTotal, reserveTotal, goalsTotal, savingsTotal, cardPaymentTotal, total, txCount, avgExpense, warningCount, criticalCount }
  }, [budgetLimitByCategoryId, items, spentByCategoryId])

  const expenseRows = useMemo(() => {
    const rows = Object.entries(spentByCategoryId)
      .map(([cidStr, spent]) => {
        const category_id = Number(cidStr)
        const name = categoryNameById[category_id] ?? 'Categoria'
        const limit = Number(budgetLimitByCategoryId[category_id] ?? 0)
        const pct = limit > 0 ? spent / limit : null
        return { category_id, name, spent: Number(spent ?? 0), limit, pct }
      })
      .filter((r) => Number.isFinite(r.spent) && r.spent > 0)
      .sort((a, b) => b.spent - a.spent)
    return rows
  }, [budgetLimitByCategoryId, categoryNameById, spentByCategoryId])

  const chartColors = useMemo(
    () => ['#C2A14D', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#E11D48'],
    []
  )

  const expensePie = useMemo(() => {
    const top = expenseRows.slice(0, 6).map((r) => ({ name: r.name, value: r.spent }))
    const rest = expenseRows.slice(6).reduce((acc, r) => acc + Number(r.spent ?? 0), 0)
    const out = [...top]
    if (rest > 0) out.push({ name: 'Outros', value: rest })
    return out
  }, [expenseRows])

  const [listKind, setListKind] = useState<'all' | TransactionKind>('all')
  const [listCategoryId, setListCategoryId] = useState<number | null>(null)

  const filteredItems = useMemo(() => {
    return items.filter((t) => {
      if (listKind !== 'all' && t.kind !== listKind) return false
      if (typeof listCategoryId === 'number') {
        if (t.category_id === null) return false
        if (Number(t.category_id) !== listCategoryId) return false
      }
      return true
    })
  }, [items, listCategoryId, listKind])

  const tipsKeys = useMemo(() => {
    const s = new Set<string>()
    for (const a of alerts) {
      if (a.severity === 'critical') s.add('budget_critical')
      else if (a.type === 'reserva') s.add('reserve_warning')
      else s.add('budget_warning')
    }
    if (totals.criticalCount > 0) s.add('budget_critical')
    else if (totals.warningCount > 0) s.add('budget_warning')
    return [...s]
  }, [alerts, totals.criticalCount, totals.warningCount])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setError(null)
    setLoading(true)
    try {
      const uid = await getUserId()
      if (!uid) return
      if (seq !== loadSeq.current) return

      const { data: cats, error: catsError } = await supabase.from('categories').select('id,name').order('name')
      if (catsError) throw catsError
      if (seq !== loadSeq.current) return
      setCategories((cats || []).map((c: any) => ({ id: Number(c.id), name: String(c.name) })))

      const { data: gs, error: goalsError } = await supabase.from('saving_goals').select('id,name').eq('user_id', uid).order('created_at', { ascending: false })
      if (goalsError) throw goalsError
      if (seq !== loadSeq.current) return
      setGoals((gs || []).map((g: any) => ({ id: Number(g.id), name: String(g.name ?? '') })))

      const { data: budgetRows, error: budgetsError } = await supabase
        .from('budgets')
        .select('category_id,limit_amount')
        .eq('user_id', uid)
        .eq('month', filterMonth)
        .eq('year', filterYear)
      if (budgetsError) throw budgetsError
      if (seq !== loadSeq.current) return
      setBudgets((budgetRows || []).map((b: any) => ({ category_id: Number(b.category_id), limit_amount: Number(b.limit_amount ?? 0) })))

      const startISO = new Date(Date.UTC(filterYear, filterMonth - 1, 1)).toISOString()
      const endISO = new Date(Date.UTC(filterYear, filterMonth, 1)).toISOString()
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('id,amount,kind,occurred_at,category_id,goal_id')
        .eq('user_id', uid)
        .gte('occurred_at', startISO)
        .lt('occurred_at', endISO)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(100)
      if (txError) throw txError
      if (seq !== loadSeq.current) return
      setItems(
        (tx || []).map((t: any) => ({
          id: Number(t.id),
          amount: Number(t.amount ?? 0),
          kind:
            t.kind === 'aporte_reserva'
              ? 'aporte_reserva'
              : t.kind === 'aporte_meta'
                ? 'aporte_meta'
              : t.kind === 'pagamento_cartao'
                ? 'pagamento_cartao'
                : 'despesa',
          occurred_at: String(t.occurred_at ?? ''),
          category_id: t.category_id === null || t.category_id === undefined ? null : Number(t.category_id),
          goal_id: t.goal_id === null || t.goal_id === undefined ? null : Number(t.goal_id),
        }))
      )
      setDataMonth(filterMonth)
      setDataYear(filterYear)

      const { data: al, error: alertsError } = await supabase
        .from('alerts')
        .select('id,type,severity,message,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20)
      if (alertsError) throw alertsError
      if (seq !== loadSeq.current) return
      setAlerts(
        (al || []).map((a: any) => ({
          id: Number(a.id),
          type: String(a.type ?? ''),
          severity: String(a.severity ?? ''),
          message: String(a.message ?? ''),
          created_at: String(a.created_at ?? ''),
        }))
      )
    } catch (e: any) {
      if (seq !== loadSeq.current) return
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao carregar transações.')
    } finally {
      if (seq !== loadSeq.current) return
      setLoading(false)
    }
  }, [filterMonth, filterYear])

  useEffect(() => {
    load()
    const ch1 = supabase
      .channel('transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()
    const ch2 = supabase
      .channel('alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => load())
      .subscribe()
    return () => {
      loadSeq.current += 1
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [load])

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const uid = await getUserId()
    if (!uid) return
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    const payload: any = { user_id: uid, amount, kind, occurred_at: date }
    if (kind === 'despesa' && categoryId) payload.category_id = categoryId
    if (kind === 'aporte_meta' && goalId) payload.goal_id = goalId
    const { error } = await supabase.from('transactions').insert(payload)
    if (error) setError(error.message)
    setAmount(0)
    setKind('despesa')
    setCategoryId(null)
    setGoalId(null)
    await load()
  }

  async function removeTransaction(id: number) {
    setError(null)
    const uid = await getUserId()
    if (!uid) return
    const { error } = await supabase.from('transactions').delete().match({ id, user_id: uid })
    if (error) setError(error.message)
    await load()
  }

  const selectedCategoryName = categoryId ? categoryNameById[categoryId] ?? null : null
  const selectedGoalName = goalId ? goalNameById[goalId] ?? null : null
  const selectedBudgetLimit = categoryId ? Number(budgetLimitByCategoryId[categoryId] ?? 0) : 0
  const selectedSpent = categoryId ? Number(spentByCategoryId[categoryId] ?? 0) : 0
  const selectedAfterSpent = kind === 'despesa' && categoryId ? selectedSpent + Math.max(0, amount) : selectedSpent
  const selectedPct = selectedBudgetLimit > 0 ? selectedAfterSpent / selectedBudgetLimit : null
  const selectedPill =
    selectedPct === null
      ? 'bg-[#F5F2EB] text-[#374151] border-[#E4E1D6]'
      : selectedPct >= 1
        ? 'bg-red-50 text-red-700 border-red-200'
        : selectedPct >= 0.8
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200'

  const initialLoading =
    loading && categories.length === 0 && items.length === 0 && budgets.length === 0 && alerts.length === 0 && !error

  if (initialLoading) {
    return (
      <div className="mt-8">
        <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 text-sm text-[#6B7280] shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
          Carregando…
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_14px_40px_rgba(11,19,36,0.10)] overflow-hidden">
        <div className="px-5 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl border border-[#C2A14D]/45 bg-white shadow-[0_10px_30px_rgba(11,19,36,0.12)] flex items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#C2A14D]" />
                </div>
                <div>
                  <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">Transações</div>
                  <div className="mt-1 text-xs text-[#6B7280]">Registre despesas, aportes e pagamentos de cartão. Veja o impacto no seu mês.</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill variant="sky">Mês: {monthLabel}</Pill>
                <Pill variant="gold">Gastos: {fmt.format(totals.expenseTotal)}</Pill>
                <Pill>Reserva: {fmt.format(totals.reserveTotal)}</Pill>
                <Pill>Metas: {fmt.format(totals.goalsTotal)}</Pill>
                <Pill>Cartão: {fmt.format(totals.cardPaymentTotal)}</Pill>
                <Pill>Itens: {totals.txCount}</Pill>
                {isUpdating ? <Pill>Atualizando…</Pill> : null}
              </div>
            </div>

            <div className="flex gap-2">
              <select
                className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.10)]"
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                disabled={loading}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.10)]"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                disabled={loading}
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
          style={{
            background:
              'linear-gradient(90deg, rgba(194,161,77,0) 0%, rgba(194,161,77,0.9) 50%, rgba(194,161,77,0) 100%)',
          }}
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm text-[#991B1B] shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <WideKpi title="Despesas" value={fmt.format(totals.expenseTotal)} subtitle="Total do mês" tone={totals.criticalCount > 0 ? 'bad' : totals.warningCount > 0 ? 'warn' : 'neutral'} />
        <WideKpi title="Aportes" value={fmt.format(totals.savingsTotal)} subtitle="Reserva + metas" tone="ok" />
        <WideKpi title="Total" value={fmt.format(totals.total)} subtitle="Somatório geral" />
        <WideKpi title="Média (despesa)" value={fmt.format(totals.avgExpense)} subtitle="Por transação" />
        <WideKpi title="Alertas" value={String(alerts.length)} subtitle="Últimos eventos" tone={alerts.some((a) => a.severity === 'critical') ? 'bad' : alerts.length > 0 ? 'warn' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#111827]">Nova transação</div>
              <div className="mt-1 text-xs text-[#6B7280]">Registre agora e acompanhe os sinais do mês.</div>
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">Entrada</span>
          </div>

          <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

          <form onSubmit={addTransaction} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Tipo</label>
              <select
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                disabled={loading}
              >
                <option value="despesa">Despesa</option>
                <option value="aporte_reserva">Aporte à Reserva</option>
                <option value="aporte_meta">Aporte em Meta</option>
                <option value="pagamento_cartao">Pagamento de Cartão</option>
              </select>
            </div>

            {kind === 'despesa' && (
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Categoria</label>
                <select
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                  disabled={loading}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {kind === 'aporte_meta' && (
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Meta</label>
                <select
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={goalId ?? ''}
                  onChange={(e) => setGoalId(e.target.value ? Number(e.target.value) : null)}
                  disabled={loading}
                >
                  <option value="">Selecione a meta...</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Data</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Valor</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  type="number"
                  step="0.01"
                  placeholder="Ex.: 75,90"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#E4E1D6] bg-white p-3">
              <div className="text-xs text-[#6B7280]">Resumo</div>
              <div className="mt-1 text-sm text-[#111827]">
                {kind === 'despesa'
                  ? 'Despesa'
                  : kind === 'aporte_reserva'
                    ? 'Aporte'
                    : kind === 'aporte_meta'
                      ? 'Meta'
                      : 'Pagamento de Cartão'}{' '}
                de {fmt.format(Math.max(0, amount))}{' '}
                {selectedCategoryName && kind === 'despesa' ? `em ${selectedCategoryName}` : ''}
                {selectedGoalName && kind === 'aporte_meta' ? `para ${selectedGoalName}` : ''}
              </div>
              {kind === 'despesa' && categoryId && selectedBudgetLimit > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`text-xs rounded-full border px-2 py-0.5 ${selectedPill}`}>
                    {selectedPct === null ? 'sem limite' : `${Math.round(selectedPct * 100)}%`}
                  </span>
                  <span className="text-xs text-[#6B7280]">
                    Mês: {fmt.format(selectedAfterSpent)} / {fmt.format(selectedBudgetLimit)}
                  </span>
                </div>
              ) : null}
            </div>

            <button className="w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm text-white shadow-[0_14px_40px_rgba(11,19,36,0.20)] hover:bg-black">
              Adicionar
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)] lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#111827]">Movimentações do mês</div>
              <div className="mt-1 text-xs text-[#6B7280]">Últimos lançamentos em {monthLabel}.</div>
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
              {filteredItems.length} item(ns){filteredItems.length !== items.length ? ` de ${items.length}` : ''}
            </span>
          </div>

          <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

          <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={listKind}
                onChange={(e) => setListKind(e.target.value as any)}
                disabled={loading}
              >
                <option value="all">Todos os tipos</option>
                <option value="despesa">Somente despesas</option>
                <option value="aporte_reserva">Somente aportes</option>
                <option value="aporte_meta">Somente metas</option>
                <option value="pagamento_cartao">Somente pagamentos de cartão</option>
              </select>
            <select
              className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
              value={listCategoryId ?? ''}
              onChange={(e) => setListCategoryId(e.target.value ? Number(e.target.value) : null)}
              disabled={loading}
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {listKind !== 'all' || listCategoryId !== null ? (
              <button
                className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm hover:bg-[#F5F2EB]"
                onClick={() => {
                  setListKind('all')
                  setListCategoryId(null)
                }}
                disabled={loading}
              >
                Limpar
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="mt-4 text-sm text-[#6B7280]">Sem transações neste mês. Registre uma despesa, aporte ou pagamento de cartão para começar.</div>
          ) : filteredItems.length === 0 ? (
            <div className="mt-4 text-sm text-[#6B7280]">Nenhuma transação encontrada com os filtros atuais.</div>
          ) : (
            <ul className="mt-4 space-y-3">
              {filteredItems.slice(0, 30).map((t) => {
                const cat =
                  t.kind === 'aporte_meta'
                    ? goalNameById[Number(t.goal_id ?? 0)] ?? 'Meta'
                    : t.category_id
                      ? categoryNameById[Number(t.category_id)] ?? 'Categoria'
                      : 'Sem categoria'
                const badge =
                  t.kind === 'aporte_reserva'
                    ? 'bg-[#E6F6FE] text-[#0B5E86] border-[#0EA5E9]/30'
                    : t.kind === 'aporte_meta'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : t.kind === 'pagamento_cartao'
                      ? 'bg-[#EEF2FF] text-[#3730A3] border-[#6366F1]/30'
                      : 'bg-[#F5F2EB] text-[#5A4A1A] border-[#C2A14D]/40'
                const dt = t.occurred_at ? new Date(t.occurred_at) : null
                const dateLabel = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString('pt-BR') : String(t.occurred_at ?? '')
                return (
                  <li key={t.id} className="rounded-xl border border-[#E4E1D6] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[11px] rounded-full border px-2 py-0.5 ${badge}`}>
                            {t.kind === 'aporte_reserva'
                              ? 'aporte'
                              : t.kind === 'aporte_meta'
                                ? 'meta'
                                : t.kind === 'pagamento_cartao'
                                  ? 'cartão'
                                  : 'despesa'}
                          </span>
                          <span className="text-[11px] text-[#6B7280]">{dateLabel}</span>
                        </div>
                        <div className="mt-1 text-sm font-medium text-[#111827] truncate">{cat}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-[#111827]">{fmt.format(Number(t.amount ?? 0))}</div>
                        <button
                          className="text-xs rounded-lg border border-[#D6D3C8] bg-white px-2 py-1 text-[#111827] hover:bg-[#F5F2EB]"
                          onClick={() => removeTransaction(t.id)}
                          disabled={loading}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_10px_30px_rgba(11,19,36,0.10)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-[#111827]">Categorias do mês</div>
            <div className="mt-1 text-xs text-[#6B7280]">Veja onde os gastos se concentram e o avanço dos limites.</div>
          </div>
          <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
            {expenseRows.length} categoria(s)
          </span>
        </div>

        <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

        {expenseRows.length === 0 ? (
          <div className="mt-4 text-sm text-[#6B7280]">Sem despesas com categoria no mês. Registre uma despesa para gerar insights.</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              {expenseRows.slice(0, 7).map((r) => {
                const pct = r.limit > 0 ? r.spent / r.limit : null
                const pill =
                  pct === null
                    ? 'bg-[#F5F2EB] text-[#374151] border border-[#E4E1D6]'
                    : pct >= 1
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : pct >= 0.8
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                const bar =
                  pct === null
                    ? 'bg-[#C2A14D]'
                    : pct >= 1
                      ? 'bg-[#EF4444]'
                      : pct >= 0.8
                        ? 'bg-[#F59E0B]'
                        : 'bg-[#10B981]'
                const w = pct === null ? 100 : Math.max(3, Math.min(100, Math.round(pct * 100)))

                return (
                  <div key={r.category_id} className="rounded-xl border border-[#E4E1D6] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-[#111827]">{r.name}</div>
                        <div className="mt-1 text-xs text-[#6B7280]">
                          {fmt.format(r.spent)}
                          {r.limit > 0 ? ` / ${fmt.format(r.limit)}` : ''}
                        </div>
                      </div>
                      <span className={`text-[11px] rounded-full border px-2 py-0.5 ${pill}`}>
                        {pct === null ? 'sem limite' : `${Math.round(pct * 100)}%`}
                      </span>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-[#F5F2EB] overflow-hidden border border-[#E4E1D6]">
                      <div className={`h-full ${bar}`} style={{ width: `${w}%` }} />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        className="text-xs rounded-lg border border-[#D6D3C8] bg-white px-2 py-1 text-[#111827] hover:bg-[#F5F2EB]"
                        onClick={() => {
                          setListKind('despesa')
                          setListCategoryId(r.category_id)
                        }}
                        disabled={loading}
                      >
                        Ver transações
                      </button>
                      {r.limit > 0 && pct !== null && pct >= 0.8 ? (
                        <span className="text-xs text-[#6B7280]">Atenção: próximo do limite.</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl border border-[#E4E1D6] bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#111827]">Distribuição</div>
                  <div className="mt-1 text-xs text-[#6B7280]">Somente despesas por categoria.</div>
                </div>
                <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
                  Top {Math.min(6, expenseRows.length)}
                </span>
              </div>

              <div className="mt-4 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensePie} dataKey="value" nameKey="name" outerRadius={120}>
                      {expensePie.map((_, i) => (
                        <Cell key={i} fill={chartColors[i % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => fmt.format(Number(v ?? 0))}
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
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_10px_30px_rgba(11,19,36,0.10)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-[#111827]">Alertas</div>
            <div className="mt-1 text-xs text-[#6B7280]">Sinais automáticos do seu controle financeiro.</div>
          </div>
          <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
            {alerts.length} item(ns)
          </span>
        </div>

        <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

        {alerts.length === 0 ? (
          <div className="mt-4 text-sm text-[#6B7280]">Nenhum alerta recente. Bom sinal: seu mês está sob controle.</div>
        ) : (
          <ul className="mt-4 space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-xl border border-[#E4E1D6] bg-white p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      a.severity === 'critical'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {a.severity}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-[#111827]">{a.message}</div>
                    <div className="text-xs text-[#6B7280] mt-1">{new Date(a.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tipsKeys.length > 0 ? <div className="mt-4"><TipsPanel keys={tipsKeys} /></div> : null}
      </section>
    </div>
  )
}

function Pill({
  children,
  variant,
}: {
  children: React.ReactNode
  variant?: 'neutral' | 'gold' | 'sky'
}) {
  const cls =
    variant === 'gold'
      ? 'border-[#C2A14D]/40 bg-[#F5F2EB] text-[#5A4A1A]'
      : variant === 'sky'
        ? 'border-[#0EA5E9]/30 bg-[#E6F6FE] text-[#0B5E86]'
        : 'border-[#D6D3C8] bg-white text-[#6B7280]'
  return <span className={`text-xs rounded-full border px-2 py-1 ${cls}`}>{children}</span>
}

function WideKpi({
  title,
  value,
  subtitle,
  tone = 'neutral',
}: {
  title: string
  value: string
  subtitle: string
  tone?: 'neutral' | 'ok' | 'warn' | 'bad'
}) {
  const valueCls =
    tone === 'ok'
      ? 'text-[#2E7D32]'
      : tone === 'warn'
        ? 'text-[#D97706]'
        : tone === 'bad'
          ? 'text-[#B91C1C]'
          : 'text-[#111827]'

  return (
    <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-4 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#6B7280]">{title}</div>
        <span className="h-2 w-2 rounded-full bg-[#C2A14D]" />
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-[-0.6px] ${valueCls}`}>{value}</div>
      <div className="mt-1 text-xs text-[#6B7280]">{subtitle}</div>
      <div className="mt-4 h-px bg-[#D6D3C8]" />
      <div className="mt-3 text-xs text-[#6B7280]">Ciclo mensal</div>
    </div>
  )
}
