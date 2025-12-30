import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type UserSettings = {
  user_id: string
  pay_percent: number
  reserve_percent: number
  emergency_months: number
  income_reference?: number
}
type Reserve = { user_id: string; target_months: number; target_amount: number | null; current_amount: number }
type MonthlyExpense = { month: number; year: number; expenses_amount: number }
type SavingGoal = {
  id: number
  user_id: string
  name: string
  target_amount: number | null
  allocation_percent: number
  is_active: boolean
  is_primary: boolean
  created_at: string
}
type TxHistoryItem = {
  id: number
  amount: number
  occurred_at: string
  kind: string
  income_id: number | null
  goal_id?: number | null
}
type GoalTx = { goal_id: number | null; amount: number }

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [reserve, setReserve] = useState<Reserve | null>(null)
  const [reserveTxList, setReserveTxList] = useState<TxHistoryItem[]>([])
  const [expenseHistory, setExpenseHistory] = useState<MonthlyExpense[]>([])
  const [goals, setGoals] = useState<SavingGoal[]>([])
  const [goalSavedById, setGoalSavedById] = useState<Record<number, number>>({})
  const [goalTxListById, setGoalTxListById] = useState<Record<number, TxHistoryItem[]>>({})
  const [expandedGoalId, setExpandedGoalId] = useState<number | null>(null)
  const [showReserveHistory, setShowReserveHistory] = useState(false)
  const [deletedGoalIds, setDeletedGoalIds] = useState<number[]>([])
  const [newGoalName, setNewGoalName] = useState('')
  const [newGoalTarget, setNewGoalTarget] = useState<number | ''>('')
  const [newGoalPercent, setNewGoalPercent] = useState<number | ''>('')
  const [newGoalActive, setNewGoalActive] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exampleIncome, setExampleIncome] = useState<number>(5000)
  const [monthlyAporte, setMonthlyAporte] = useState<number>(500)
  const [primarySimulatedAporte, setPrimarySimulatedAporte] = useState<number>(0)
  const loadSeq = useRef(0)

  const fmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setError(null)
    setLoading(true)

    try {
      const uid = await getUserId()
      if (!uid) return
      if (seq !== loadSeq.current) return

      const [
        { data: s, error: sErr },
        { data: r, error: rErr },
        { data: reserveTx, error: reserveTxErr },
        { data: h, error: hErr },
        { data: g, error: gErr },
        { data: tx, error: txErr },
      ] =
        await Promise.all([
          supabase
            .from('user_settings')
            .select('user_id,pay_percent,reserve_percent,emergency_months,income_reference')
            .eq('user_id', uid)
            .maybeSingle(),
        supabase.from('emergency_reserve').select('user_id,target_months,target_amount,current_amount').eq('user_id', uid).maybeSingle(),
        supabase
          .from('transactions')
          .select('id,amount,occurred_at,kind,income_id')
          .eq('user_id', uid)
          .eq('kind', 'aporte_reserva')
          .order('occurred_at', { ascending: false })
          .limit(5000),
        supabase
          .from('vw_monthly_summary')
          .select('month,year,expenses_amount')
          .eq('user_id', uid)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(6),
        supabase
          .from('saving_goals')
          .select('id,user_id,name,target_amount,allocation_percent,is_active,is_primary,created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('id,goal_id,amount,occurred_at,kind,income_id')
          .eq('user_id', uid)
          .eq('kind', 'aporte_meta')
          .not('goal_id', 'is', null)
          .order('occurred_at', { ascending: false })
          .limit(5000),
      ])
      if (sErr) throw sErr
      if (rErr) throw rErr
      if (reserveTxErr) throw reserveTxErr
      if (hErr) throw hErr
      if (gErr) throw gErr
      if (txErr) throw txErr
      if (seq !== loadSeq.current) return

      const pay = s ? Number((s as any).pay_percent ?? 0.1) : 0.1
      const reservePercentRaw =
        s && (s as any).reserve_percent !== null && (s as any).reserve_percent !== undefined ? Number((s as any).reserve_percent) : pay

      setSettings(
        s
          ? {
              user_id: String((s as any).user_id ?? uid),
              pay_percent: pay,
              reserve_percent: reservePercentRaw,
              emergency_months: Number((s as any).emergency_months ?? 6),
              income_reference: Number((s as any).income_reference ?? 5000),
            }
          : { user_id: uid, pay_percent: 0.1, reserve_percent: 0.1, emergency_months: 6, income_reference: 5000 }
      )
      if (s && (s as any).income_reference) {
        setExampleIncome(Number((s as any).income_reference))
      }
      setReserve(
        (() => {
          const reserveTxListRaw = (reserveTx || []) as TxHistoryItem[]
          setReserveTxList(reserveTxListRaw)

          const reserveCurrentFromTx = Math.max(
            0,
            reserveTxListRaw.reduce((acc: number, row: any) => acc + Math.max(0, Number(row?.amount ?? 0)), 0)
          )
          const out: Reserve = r
            ? {
                user_id: String((r as any).user_id ?? uid),
                target_months: Number((r as any).target_months ?? 6),
                target_amount:
                  (r as any).target_amount === null || (r as any).target_amount === undefined ? null : Number((r as any).target_amount),
                current_amount: reserveCurrentFromTx,
              }
            : { user_id: uid, target_months: 6, target_amount: null, current_amount: reserveCurrentFromTx }
          const dbCurrent = Math.max(0, Number((r as any)?.current_amount ?? 0))
          if (Math.abs(dbCurrent - reserveCurrentFromTx) > 0.005) {
            supabase.from('emergency_reserve').upsert({ user_id: uid, current_amount: reserveCurrentFromTx }, { onConflict: 'user_id' })
          }
          return out
        })()
      )

      setExpenseHistory(
        (h || []).map((row: any) => ({
          month: Number(row?.month ?? 0),
          year: Number(row?.year ?? 0),
          expenses_amount: Number(row?.expenses_amount ?? 0),
        }))
      )

      setGoals(
        (g || []).map((row: any) => ({
          id: Number(row?.id ?? 0),
          user_id: String(row?.user_id ?? uid),
          name: String(row?.name ?? ''),
          target_amount: row?.target_amount === null || row?.target_amount === undefined ? null : Number(row.target_amount),
          allocation_percent: Number(row?.allocation_percent ?? 0),
          is_active: Boolean(row?.is_active ?? true),
          is_primary: Boolean(row?.is_primary ?? false),
          created_at: String(row?.created_at ?? ''),
        }))
      )
      const goalMap: Record<number, number> = {}
      const goalTxMap: Record<number, TxHistoryItem[]> = {}
      for (const t of (tx || []) as TxHistoryItem[]) {
        const gid = Number((t as any).goal_id ?? 0)
        if (!gid) continue
        goalMap[gid] = (goalMap[gid] ?? 0) + Math.max(0, Number((t as any).amount ?? 0))
        if (!goalTxMap[gid]) goalTxMap[gid] = []
        goalTxMap[gid].push(t)
      }
      setGoalSavedById(goalMap)
      setGoalTxListById(goalTxMap)
      setDeletedGoalIds([])
    } catch (e: any) {
      if (seq !== loadSeq.current) return
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao carregar planejamento.')
    } finally {
      if (seq !== loadSeq.current) return
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('planning')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_reserve' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saving_goals' }, () => load())
      .subscribe()
    return () => {
      loadSeq.current += 1
      supabase.removeChannel(ch)
    }
  }, [load])

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(t)
  }, [notice])

  async function setPrimaryGoal(goalId: number) {
    if (saving || loading) return
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.rpc('set_primary_goal', { p_goal_id: goalId })
      if (error) throw error
      await load()
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao definir meta principal.')
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    setError(null)
    setNotice(null)
    if (!settings || !reserve) return

    const pp = Number(settings.pay_percent ?? 0)
    if (!Number.isFinite(pp) || pp < 0 || pp > 0.95) {
      setError('Informe um percentual válido (ex.: 0.10 para 10%).')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const rp = Number(settings.reserve_percent ?? 0)
    if (!Number.isFinite(rp) || rp < 0 || rp > pp) {
      setError('Informe um percentual válido para a reserva (0 até o percentual mínimo).')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const activeGoals = goals.filter((g) => g.is_active)
    for (const g of goals) {
      if (!g.name.trim()) {
        setError('Dê um nome para todas as metas (ou remova a meta vazia).')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const ap = Number(g.allocation_percent ?? 0)
      if (!Number.isFinite(ap) || ap < 0 || ap > pp) {
        setError('Verifique os percentuais das metas (0 até o percentual mínimo).')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const ta = g.target_amount === null ? null : Number(g.target_amount)
      if (ta !== null && (!Number.isFinite(ta) || ta <= 0)) {
        setError('Se definir um valor alvo para uma meta, ele precisa ser maior que zero.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    const goalsSum = activeGoals.reduce((acc, g) => acc + Math.max(0, Number(g.allocation_percent ?? 0)), 0)
    const planSum = rp + goalsSum
    if (planSum > pp + 1e-9) {
      setError('A soma dos percentuais (reserva + metas ativas) não pode exceder o percentual mínimo.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const tm = Number(reserve.target_months ?? 0)
    if (!Number.isFinite(tm) || tm < 1 || tm > 36) {
      setError('Informe a meta de meses (1 a 36).')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const ta = reserve.target_amount === null ? null : Number(reserve.target_amount)
    if (ta !== null && (!Number.isFinite(ta) || ta <= 0)) {
      setError('Se definir um valor alvo, ele precisa ser maior que zero.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    try {
      const uid = await getUserId()
      if (!uid) return
      const em = Math.max(1, Math.min(36, Number(settings.emergency_months ?? 6)))

      const { error: sErr } = await supabase.from('user_settings').upsert(
        {
          user_id: uid,
          pay_percent: pp,
          reserve_percent: rp,
          emergency_months: em,
          income_reference: Math.max(0, Number(exampleIncome ?? 0)),
        },
        { onConflict: 'user_id' }
      )
      if (sErr) throw sErr

      const { error: rErr } = await supabase.from('emergency_reserve').upsert(
        { user_id: uid, target_months: tm, target_amount: ta, current_amount: Math.max(0, Number(reserve.current_amount ?? 0)) },
        { onConflict: 'user_id' }
      )
      if (rErr) throw rErr

      const deleteIds = deletedGoalIds.filter((v) => Number.isFinite(v) && v > 0)
      if (deleteIds.length) {
        const { error: dErr } = await supabase.from('saving_goals').delete().eq('user_id', uid).in('id', deleteIds)
        if (dErr) throw dErr
      }

      const existing = goals.filter((g) => Number.isFinite(g.id) && g.id > 0)
      const updates = existing.map((g) =>
        supabase
          .from('saving_goals')
          .update({
            name: g.name.trim(),
            target_amount: g.target_amount === null ? null : Number(g.target_amount),
            allocation_percent: Number(g.allocation_percent ?? 0),
            is_active: Boolean(g.is_active),
          })
          .eq('id', g.id)
          .eq('user_id', uid)
      )
      const results = updates.length ? await Promise.all(updates) : []
      for (const r of results) {
        if (r.error) throw r.error
      }

      const pendingInserts = goals.filter((g) => Number.isFinite(g.id) && g.id <= 0)
      if (pendingInserts.length) {
        const payload = pendingInserts.map((g) => ({
          user_id: uid,
          name: g.name.trim(),
          target_amount: g.target_amount === null ? null : Number(g.target_amount),
          allocation_percent: Number(g.allocation_percent ?? 0),
          is_active: Boolean(g.is_active),
        }))
        const { error: iErr } = await supabase.from('saving_goals').insert(payload)
        if (iErr) throw iErr
      }

      setNotice('Planejamento salvo.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      await load()
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao salvar planejamento.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const payPercent = Math.max(0, Math.min(0.95, Number(settings?.pay_percent ?? 0.1)))
  const reservePercent = Math.max(0, Math.min(payPercent, Number(settings?.reserve_percent ?? payPercent)))
  const activeGoalsSum = useMemo(() => goals.filter((g) => g.is_active).reduce((acc, g) => acc + Math.max(0, Number(g.allocation_percent ?? 0)), 0), [goals])
  const allocationSum = reservePercent + activeGoalsSum
  const allocationLeft = Math.max(0, payPercent - allocationSum)
  const goalsSavedTotal = useMemo(() => Object.values(goalSavedById).reduce((acc, v) => acc + Math.max(0, Number(v ?? 0)), 0), [goalSavedById])
  const reserveCurrent = Math.max(0, Number(reserve?.current_amount ?? 0))
  const reserveTarget =
    reserve?.target_amount === null || reserve?.target_amount === undefined ? null : Math.max(0, Number(reserve.target_amount))
  const reservePct = reserveTarget && reserveTarget > 0 ? Math.min(1, reserveCurrent / reserveTarget) : null
  const reserveMissing = reserveTarget && reserveTarget > 0 ? Math.max(0, reserveTarget - reserveCurrent) : null

  const expensesBase = useMemo(() => {
    return expenseHistory
      .map((r) => Math.max(0, Number((r as any).expenses_amount ?? 0)))
      .filter((v) => Number.isFinite(v) && v > 0)
      .slice(0, 3)
  }, [expenseHistory])

  const avgExpense = useMemo(() => {
    if (!expensesBase.length) return null
    return expensesBase.reduce((acc, v) => acc + v, 0) / expensesBase.length
  }, [expensesBase])

  const suggestedTarget = useMemo(() => {
    const baseMonths = 6
    if (!avgExpense || avgExpense <= 0) return null
    return avgExpense * baseMonths
  }, [avgExpense])

  const reserveEffectiveTarget = reserveTarget ?? suggestedTarget
  const reserveEffectiveTargetLabel = reserveTarget ? 'meta configurada' : suggestedTarget ? 'meta sugerida (6m)' : null

  const reserveAporteTime = useMemo(() => {
    const target = reserveEffectiveTarget
    const aporte = Math.max(0, Number(monthlyAporte ?? 0))
    if (!target || target <= reserveCurrent || aporte <= 0) return null
    const missing = target - reserveCurrent
    const months = Math.ceil(missing / aporte)
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    return { months, years, remainingMonths }
  }, [reserveEffectiveTarget, monthlyAporte, reserveCurrent])

  const reserveAporteLabel = useMemo(() => {
    if (!reserveAporteTime) return null
    if (reserveAporteTime.years > 0 && reserveAporteTime.remainingMonths > 0) return `${reserveAporteTime.years}a ${reserveAporteTime.remainingMonths}m`
    if (reserveAporteTime.years > 0) return `${reserveAporteTime.years}a`
    return `${reserveAporteTime.months}m`
  }, [reserveAporteTime])

  const primaryGoal = useMemo(() => {
    const savedGoals = goals.filter((g) => g.id > 0)
    if (savedGoals.length === 1) return savedGoals[0]
    return savedGoals.find((g) => g.is_primary) || null
  }, [goals])

  useEffect(() => {
    if (primaryGoal && exampleIncome) {
      setPrimarySimulatedAporte(exampleIncome * (primaryGoal.allocation_percent || 0))
    }
  }, [primaryGoal?.id, primaryGoal?.allocation_percent, exampleIncome])

  const primaryCurrent = primaryGoal ? Math.max(0, Number(goalSavedById[primaryGoal.id] ?? 0)) : null
  const primaryTarget = primaryGoal?.target_amount ? Number(primaryGoal.target_amount) : null
  const primaryPct = primaryTarget && primaryCurrent !== null ? Math.min(1, primaryCurrent / primaryTarget) : null

  const kpiUsePrimary = !!primaryGoal
  const kpiTarget = kpiUsePrimary ? primaryTarget : reserveTarget
  const kpiCurrent = kpiUsePrimary ? (primaryCurrent ?? 0) : reserveCurrent
  const kpiLabel = kpiUsePrimary ? 'Meta principal' : 'Meta'
  const kpiSubtitle = kpiUsePrimary
    ? primaryGoal?.name ?? 'Principal'
    : reserveTarget
      ? 'Valor alvo configurado'
      : 'Defina um alvo opcional'
  const kpiPct = kpiUsePrimary ? primaryPct : reservePct

  const kpiAporteTime = useMemo(() => {
    if (kpiUsePrimary) {
      if (!primaryTarget || primaryCurrent === null) return null
      // Use goal allocation applied to example income
      const aporte = Math.max(0, Number(primarySimulatedAporte ?? 0))
      if (primaryTarget <= primaryCurrent || aporte <= 0) return null
      const missing = primaryTarget - primaryCurrent
      const months = Math.ceil(missing / aporte)
      const years = Math.floor(months / 12)
      const remainingMonths = months % 12
      return { months, years, remainingMonths, amount: aporte }
    } else {
      return reserveAporteTime ? { ...reserveAporteTime, amount: Math.max(0, Number(monthlyAporte ?? 0)) } : null
    }
  }, [kpiUsePrimary, primaryTarget, primaryCurrent, monthlyAporte, reserveAporteTime, primarySimulatedAporte])

  const kpiAporteLabel = useMemo(() => {
    if (!kpiAporteTime) return null
    if (kpiAporteTime.years > 0 && kpiAporteTime.remainingMonths > 0) return `${kpiAporteTime.years}a ${kpiAporteTime.remainingMonths}m`
    if (kpiAporteTime.years > 0) return `${kpiAporteTime.years}a`
    return `${kpiAporteTime.months}m`
  }, [kpiAporteTime])

  const kpiAporteTone: 'neutral' | 'ok' | 'warn' = useMemo(() => {
    if (!kpiAporteTime) return 'neutral'
    if (kpiAporteTime.months <= 6) return 'ok'
    if (kpiAporteTime.months <= 12) return 'warn'
    return 'neutral'
  }, [kpiAporteTime])

  const previewSavings = Math.max(0, Number(exampleIncome ?? 0)) * payPercent
  const previewAvailable = Math.max(0, Number(exampleIncome ?? 0)) - previewSavings
  const initialLoading = loading && !settings && !reserve && !error

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
                  <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">Planejamento</div>
                  <div className="mt-1 text-xs text-[#6B7280]">Defina regras automáticas e acompanhe sua reserva de emergência.</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill variant="gold">Pague-se primeiro: {(payPercent * 100).toFixed(1)}%</Pill>
                <Pill variant="neutral">Distribuído: {(Math.min(1, allocationSum) * 100).toFixed(1)}%</Pill>
                <Pill variant="sky">Tempo p/ meta: {kpiAporteLabel ?? '—'}</Pill>
                <Pill>Saldo reserva: {fmt.format(reserveCurrent)}</Pill>
                <Pill>Meta: {kpiTarget ? fmt.format(kpiTarget) : '—'}</Pill>
              </div>
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

      {notice ? (
        <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-4 text-sm text-[#166534] shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <WideKpi title="Poupança padrão" value={`${(payPercent * 100).toFixed(1)}%`} subtitle="Aplicada na página de Renda" tone={payPercent >= 0.2 ? 'ok' : payPercent >= 0.1 ? 'neutral' : 'warn'} />
        <WideKpi
          title="Tempo p/ meta"
          value={kpiAporteLabel ?? '—'}
          subtitle={
            kpiAporteTime
              ? `Aporte: ${fmt.format(kpiAporteTime.amount)}/m (${kpiUsePrimary ? 'simulado' : 'simulado'})`
              : kpiUsePrimary
                ? 'Defina percentual e renda de referência'
                : 'Defina uma meta e simule um aporte mensal'
          }
          tone={kpiAporteTone === 'ok' ? 'ok' : kpiAporteTone === 'warn' ? 'warn' : 'neutral'}
        />
        <WideKpi title="Saldo da reserva" value={fmt.format(reserveCurrent)} subtitle="Patrimônio de proteção" tone={reserveCurrent > 0 ? 'ok' : 'neutral'} />
        <WideKpi title={kpiLabel} value={kpiTarget ? fmt.format(kpiTarget) : '—'} subtitle={kpiSubtitle} tone={kpiTarget ? 'neutral' : 'warn'} />
        <WideKpi title="Progresso" value={kpiPct === null ? '—' : `${Math.round(kpiPct * 100)}%`} subtitle={kpiUsePrimary ? 'Da meta principal' : 'Da meta de reserva'} tone={kpiPct === null ? 'neutral' : kpiPct >= 0.8 ? 'ok' : kpiPct >= 0.5 ? 'warn' : 'bad'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#111827]">Pague-se primeiro</div>
              <div className="mt-1 text-xs text-[#6B7280]">Defina o percentual automático para guardar antes de gastar.</div>
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">Regra</span>
          </div>

          <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Percentual automático</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Ex.: 0.10 para 10%"
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={settings?.pay_percent ?? 0}
                onChange={(e) => setSettings((s) => (s ? { ...s, pay_percent: e.target.value === '' ? 0 : Number(e.target.value) } : s))}
                disabled={saving || loading}
              />
              <div className="mt-2 text-[11px] text-[#6B7280]">Dica: 0.10 = 10%, 0.15 = 15%.</div>
            </div>

            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Percentual para a reserva</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Ex.: 0.10 para 10%"
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={settings?.reserve_percent ?? 0}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, reserve_percent: e.target.value === '' ? 0 : Number(e.target.value) } : s))
                }
                disabled={saving || loading}
              />
              <div className="mt-2 text-[11px] text-[#6B7280]">
                Soma atual (reserva + metas ativas): {(allocationSum * 100).toFixed(1)}% · sobra: {(allocationLeft * 100).toFixed(1)}%.
              </div>
            </div>

            <div className="rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#6B7280]">Exemplo rápido</div>
                <Pill variant="gold">{(payPercent * 100).toFixed(1)}%</Pill>
              </div>

              <div className="mt-3">
                <label className="block text-xs text-[#6B7280] mb-1">Renda de referência</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={exampleIncome}
                  onChange={(e) => setExampleIncome(Number(e.target.value))}
                  disabled={saving || loading}
                />
              </div>

              <div className="mt-3 text-sm text-[#111827]">
                Você guarda <span className="font-semibold">{fmt.format(previewSavings)}</span> e fica disponível{' '}
                <span className="font-semibold">{fmt.format(previewAvailable)}</span>.
              </div>

              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                  <div className="h-full bg-[#C2A14D]" style={{ width: `${Math.min(100, Math.max(0, payPercent * 100))}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-[#6B7280]">A consistência vence o impulso.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)] lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#111827]">Reserva de emergência</div>
              <div className="mt-1 text-xs text-[#6B7280]">Configure a meta e acompanhe o progresso do seu saldo.</div>
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">Proteção</span>
          </div>

          <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Valor alvo da reserva</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Ex.: 10000.00"
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={reserve?.target_amount ?? ''}
                onChange={(e) =>
                  setReserve((r) =>
                    r ? { ...r, target_amount: e.target.value === '' ? null : Number(e.target.value) } : r
                  )
                }
                disabled={saving || loading}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-[#6B7280]">
                  {reserveTarget ? 'Meta definida.' : 'Defina um valor para acompanhar o progresso.'}
                </div>
                {suggestedTarget && (!reserve?.target_amount || Number(reserve.target_amount) !== suggestedTarget) ? (
                  <button
                    type="button"
                    className="text-[11px] rounded-full border border-[#D6D3C8] bg-white px-2 py-1 text-[#111827] hover:bg-[#F5F2EB] disabled:opacity-60"
                    onClick={() => setReserve((r) => (r ? { ...r, target_amount: suggestedTarget } : r))}
                    disabled={saving || loading}
                  >
                    Usar sugestão ({fmt.format(suggestedTarget)})
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#6B7280]">Saldo atual</div>
                <Pill variant="sky">{fmt.format(reserveCurrent)}</Pill>
              </div>

              {reserveTarget ? (
                <>
                  <div className="mt-3 h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                    <div className="h-full bg-[#0EA5E9]" style={{ width: `${(reservePct ?? 0) * 100}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-[#6B7280]">
                    <span>{Math.round((reservePct ?? 0) * 100)}% concluído</span>
                    <span>Meta: {fmt.format(reserveTarget)}</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#6B7280] mt-3">
                  Sem meta definida.
                </div>
              )}

              <div className="mt-4 border-t border-[#E4E1D6] pt-4">
                <button
                  type="button"
                  onClick={() => setShowReserveHistory(!showReserveHistory)}
                  className="flex w-full items-center justify-between text-xs text-[#6B7280] hover:text-[#374151]"
                >
                  <span>Histórico ({reserveTxList.length})</span>
                  {showReserveHistory ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  )}
                </button>
                {showReserveHistory && (
                  <div className="mt-2 max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {reserveTxList.length === 0 ? (
                      <div className="text-xs text-gray-400 italic">Nenhum aporte registrado.</div>
                    ) : (
                      reserveTxList.map((tx) => (
                        <div key={tx.id} className="flex justify-between text-xs border-b border-gray-100 pb-1 last:border-0">
                          <div>
                            <div className="font-medium text-[#374151]">
                              {tx.income_id ? 'Distribuição de Renda' : 'Aporte Manual'}
                            </div>
                            <div className="text-[10px] text-[#9CA3AF]">
                              {new Date(tx.occurred_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          <div className="font-medium text-[#059669]">+{fmt.format(tx.amount)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-[#111827]">Metas</div>
            <div className="mt-1 text-xs text-[#6B7280]">Crie metas e defina percentuais de aporte por renda.</div>
          </div>
          <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
            Ativas: {goals.filter((g) => g.is_active).length}
          </span>
        </div>

        <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

        {primaryGoal && (
          <div className="mt-4 mb-6 p-4 rounded-xl border border-[#D6D3C8] bg-white">
            <div className="text-sm font-medium text-[#111827] mb-2">Simulação da Meta Principal</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Aporte mensal simulado</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={primarySimulatedAporte}
                  onChange={(e) => setPrimarySimulatedAporte(Number(e.target.value))}
                />
              </div>
              <div className="text-xs text-[#6B7280]">
                {kpiAporteTime ? (
                  <>
                    Tempo estimado: <span className="font-medium text-[#111827]">{kpiAporteLabel}</span>
                    <br />
                    Para atingir: {fmt.format(primaryTarget ?? 0)}
                  </>
                ) : (
                  'Defina um valor alvo na meta para ver o tempo estimado.'
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Pill variant="sky">Guardado em metas: {fmt.format(goalsSavedTotal)}</Pill>
          <Pill variant="neutral">Metas: {(activeGoalsSum * 100).toFixed(1)}%</Pill>
          <Pill variant="neutral">Reserva: {(reservePercent * 100).toFixed(1)}%</Pill>
        </div>

        {goals.length === 0 ? (
          <div className="mt-4 text-sm text-[#6B7280]">Nenhuma meta cadastrada ainda.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {goals.map((g) => (
              <div key={g.id} className="rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {g.id > 0 && (
                      <button
                        type="button"
                        onClick={() => setPrimaryGoal(g.id)}
                        disabled={saving || loading || g.is_primary}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          g.is_primary
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                        }`}
                        title={g.is_primary ? 'Meta principal' : 'Definir como meta principal'}
                      >
                        {g.is_primary ? '★ Principal' : '☆ Definir principal'}
                      </button>
                    )}
                    <div className="text-xs text-[#6B7280]">
                      Guardado: <span className="font-medium text-[#111827]">{fmt.format(Math.max(0, Number(goalSavedById[g.id] ?? 0)))}</span>
                    </div>
                  </div>
                  {g.target_amount ? (
                    <div className="text-xs text-[#6B7280]">
                      Progresso:{' '}
                      <span className="font-medium text-[#111827]">
                        {Math.round(
                          Math.min(
                            1,
                            Math.max(0, Number(goalSavedById[g.id] ?? 0)) / Math.max(1e-9, Number(g.target_amount ?? 0))
                          ) * 100
                        )}
                        %
                      </span>
                    </div>
                  ) : null}
                </div>

                {g.target_amount ? (
                  <div className="mt-3 h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (Math.max(0, Number(goalSavedById[g.id] ?? 0)) / Math.max(1e-9, Number(g.target_amount ?? 0))) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-xs text-[#6B7280] mb-1">Nome</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                      value={g.name}
                      onChange={(e) =>
                        setGoals((all) => all.map((it) => (it.id === g.id ? { ...it, name: e.target.value } : it)))
                      }
                      disabled={saving || loading}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs text-[#6B7280] mb-1">Percentual</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                      value={g.allocation_percent}
                      onChange={(e) =>
                        setGoals((all) =>
                          all.map((it) =>
                            it.id === g.id ? { ...it, allocation_percent: e.target.value === '' ? 0 : Number(e.target.value) } : it
                          )
                        )
                      }
                      disabled={saving || loading}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs text-[#6B7280] mb-1">Valor alvo (opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                      value={g.target_amount === null ? '' : g.target_amount}
                      onChange={(e) =>
                        setGoals((all) =>
                          all.map((it) =>
                            it.id === g.id ? { ...it, target_amount: e.target.value === '' ? null : Number(e.target.value) } : it
                          )
                        )
                      }
                      disabled={saving || loading}
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm text-[#111827]">
                      <input
                        type="checkbox"
                        checked={g.is_active}
                        onChange={(e) =>
                          setGoals((all) => all.map((it) => (it.id === g.id ? { ...it, is_active: e.target.checked } : it)))
                        }
                        disabled={saving || loading}
                      />
                      Ativa
                    </label>
                    <button
                      type="button"
                      className="rounded-xl border border-[#E4E1D6] bg-white px-3 py-2 text-xs text-[#991B1B] hover:bg-[#FEF2F2] disabled:opacity-50"
                      onClick={() => {
                        setGoals((all) => all.filter((it) => it.id !== g.id))
                        setDeletedGoalIds((ids) => (ids.includes(g.id) ? ids : [...ids, g.id]))
                      }}
                      disabled={saving || loading}
                    >
                      Remover
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#E4E1D6] pt-4">
                  <button
                    type="button"
                    onClick={() => setExpandedGoalId(expandedGoalId === g.id ? null : g.id)}
                    className="flex w-full items-center justify-between text-xs text-[#6B7280] hover:text-[#374151]"
                  >
                    <span>Histórico ({(goalTxListById[g.id] || []).length})</span>
                    {expandedGoalId === g.id ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    )}
                  </button>
                  {expandedGoalId === g.id && (
                    <div className="mt-2 max-h-40 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                      {(goalTxListById[g.id] || []).length === 0 ? (
                        <div className="text-xs text-gray-400 italic">Nenhum aporte registrado.</div>
                      ) : (
                        (goalTxListById[g.id] || []).map((tx) => (
                          <div key={tx.id} className="flex justify-between text-xs border-b border-gray-100 pb-1 last:border-0">
                            <div>
                              <div className="font-medium text-[#374151]">
                                {tx.income_id ? 'Distribuição de Renda' : 'Aporte Manual'}
                              </div>
                              <div className="text-[10px] text-[#9CA3AF]">
                                {new Date(tx.occurred_at).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                            <div className="font-medium text-[#059669]">+{fmt.format(tx.amount)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
          <div className="font-semibold text-[#111827]">Nova meta</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <label className="block text-xs text-[#6B7280] mb-1">Nome</label>
              <input
                type="text"
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                disabled={saving || loading}
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-[#6B7280] mb-1">Percentual</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={newGoalPercent}
                onChange={(e) => setNewGoalPercent(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={saving || loading}
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-[#6B7280] mb-1">Valor alvo (opcional)</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={saving || loading}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-[#111827]">
                <input type="checkbox" checked={newGoalActive} onChange={(e) => setNewGoalActive(e.target.checked)} disabled={saving || loading} />
                Ativa
              </label>
              <button
                type="button"
                className="rounded-xl border border-[#D6D3C8] bg-[#111827] px-3 py-2 text-xs text-white hover:bg-black disabled:opacity-60"
                onClick={() => {
                  const name = newGoalName.trim()
                  if (!name) return
                  const np = newGoalPercent === '' ? 0 : Number(newGoalPercent)
                  const nt = newGoalTarget === '' ? null : Number(newGoalTarget)
                  setGoals((all) => [
                    {
                      id: -(Date.now() % 1000000) - Math.floor(Math.random() * 1000),
                      user_id: settings?.user_id ?? '',
                      name,
                      target_amount: nt,
                      allocation_percent: Number.isFinite(np) ? np : 0,
                      is_active: Boolean(newGoalActive),
                      is_primary: false,
                      created_at: new Date().toISOString(),
                    },
                    ...all,
                  ])
                  setNewGoalName('')
                  setNewGoalTarget('')
                  setNewGoalPercent('')
                  setNewGoalActive(true)
                }}
                disabled={saving || loading}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-[#6B7280]">Salve para aplicar as regras nas próximas operações.</div>
        <button
          className="rounded-xl bg-[#111827] px-4 py-2.5 text-sm text-white shadow-[0_14px_40px_rgba(11,19,36,0.20)] hover:bg-black disabled:opacity-60"
          onClick={save}
          disabled={saving || loading || !settings || !reserve}
        >
          {saving ? 'Salvando…' : 'Salvar planejamento'}
        </button>
      </div>
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
      <div className="mt-3 text-xs text-[#6B7280]">Estratégia</div>
    </div>
  )
}
