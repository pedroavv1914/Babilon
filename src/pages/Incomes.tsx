import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type Income = { id: number; amount: number; month: number; year: number; rule_percent: number | null; created_at: string }
type UserSettings = { pay_percent: number; reserve_percent: number }
type SavingGoal = { id: number; name: string; allocation_percent: number; is_active: boolean }
type TxRow = { amount: number; occurred_at: string; kind: string; goal_id: number | null; income_id?: number | null }
type DeleteTarget = { id: number; amount: number }

export default function Incomes() {
  const now = new Date()
  const [uid, setUid] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [goals, setGoals] = useState<SavingGoal[]>([])
  const [items, setItems] = useState<Income[]>([])
  const [recent, setRecent] = useState<Income[]>([])
  const [savedMap, setSavedMap] = useState<Record<number, number>>({})
  const [destMap, setDestMap] = useState<Record<number, string>>({})

  const [amount, setAmount] = useState<number>(0)
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth() + 1)
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear())
  const [incomeDate, setIncomeDate] = useState<string>(() => {
    const pad = (v: number) => String(v).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })
  const [percentMode, setPercentMode] = useState<'default' | 'custom'>('default')
  const [rulePercent, setRulePercent] = useState<number | ''>('')
  const [allocationMode, setAllocationMode] = useState<'auto' | 'manual'>('auto')
  const [manualDestination, setManualDestination] = useState<string>('reserva')
  const [savingsOverride, setSavingsOverride] = useState<number | ''>('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const defaultPercent = typeof settings?.pay_percent === 'number' ? settings.pay_percent : 0.1
  const effectivePercent = percentMode === 'custom' && rulePercent !== '' ? Number(rulePercent) : defaultPercent
  const computedSavings = Math.max(0, amount) * Math.max(0, effectivePercent)
  const previewSavings = savingsOverride !== '' ? Math.max(0, Number(savingsOverride)) : computedSavings
  const previewAvailable = Math.max(0, amount) - previewSavings
  const previewPercent = amount > 0 ? Math.max(0, previewSavings) / Math.max(0, amount) : 0

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const yearOptions = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], [now])

  const rows = useMemo(() => {
    return items.map((r) => {
      const usedPercent = typeof r.rule_percent === 'number' ? r.rule_percent : defaultPercent
      const alloc = typeof savedMap[r.id] === 'number' ? savedMap[r.id] : r.amount * usedPercent
      const available = r.amount - alloc
      return {
        ...r,
        used_percent: usedPercent,
        savings_amount: alloc,
        available_amount: available,
        mode: typeof r.rule_percent === 'number' ? 'custom' : 'default',
      }
    })
  }, [items, savedMap, defaultPercent])

  const totals = useMemo(() => {
    const incomeTotal = rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0)
    const savingsTotal = rows.reduce((acc, r) => acc + Number(r.savings_amount ?? 0), 0)
    const availableTotal = incomeTotal - savingsTotal
    const savingsRate = incomeTotal > 0 ? savingsTotal / incomeTotal : 0
    return { incomeTotal, savingsTotal, availableTotal, savingsRate }
  }, [rows])

  async function load() {
    if (!uid) return
    setLoading(true)
    try {
      const startISO = new Date(Date.UTC(filterYear, filterMonth - 1, 1)).toISOString()
      const endISO = new Date(Date.UTC(filterYear, filterMonth, 1)).toISOString()
      const [
        { data: s, error: sErr },
        { data: g, error: gErr },
        { data: monthData, error: mErr },
        { data: recData, error: rErr },
      ] =
        await Promise.all([
          supabase.from('user_settings').select('pay_percent,reserve_percent').eq('user_id', uid).maybeSingle(),
          supabase.from('saving_goals').select('id,name,allocation_percent,is_active').eq('user_id', uid),
          supabase
            .from('incomes')
            .select('id,amount,month,year,rule_percent,created_at')
            .eq('user_id', uid)
            .eq('month', filterMonth)
            .eq('year', filterYear)
            .order('created_at', { ascending: false }),
          supabase
            .from('incomes')
            .select('id,amount,month,year,rule_percent,created_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(12),
        ])

      if (sErr) throw sErr
      if (gErr) throw gErr
      if (mErr) throw mErr
      if (rErr) throw rErr

      const payPercent = s ? Number((s as any).pay_percent ?? 0.1) : 0.1
      const reservePercent =
        s && (s as any).reserve_percent !== null && (s as any).reserve_percent !== undefined ? Number((s as any).reserve_percent) : payPercent
      setSettings({ pay_percent: payPercent, reserve_percent: reservePercent })
      const goalsList = ((g || []) as any[]).map(
        (row): SavingGoal => ({
          id: Number(row?.id ?? 0),
          name: String(row?.name ?? ''),
          allocation_percent: Number(row?.allocation_percent ?? 0),
          is_active: Boolean(row?.is_active ?? true),
        })
      )
      setGoals(goalsList)
      const monthItems = (monthData || []) as Income[]
      setItems(monthItems)
      setRecent((recData || []) as Income[])

      let tx: any[] = []
      let hasIncomeId = true
      {
        const q1 = await supabase
          .from('transactions')
          .select('amount,occurred_at,kind,goal_id,income_id')
          .eq('user_id', uid)
          .gte('occurred_at', startISO)
          .lt('occurred_at', endISO)
          .in('kind', ['aporte_reserva', 'aporte_meta'])
        if (q1.error) {
          const msg = String(q1.error.message ?? '')
          if (msg.toLowerCase().includes('income_id')) {
            hasIncomeId = false
            const q2 = await supabase
              .from('transactions')
              .select('amount,occurred_at,kind,goal_id')
              .eq('user_id', uid)
              .gte('occurred_at', startISO)
              .lt('occurred_at', endISO)
              .in('kind', ['aporte_reserva', 'aporte_meta'])
            if (q2.error) throw q2.error
            tx = (q2.data || []) as any[]
          } else {
            throw q1.error
          }
        } else {
          tx = (q1.data || []) as any[]
        }
      }

      const goalNameById: Record<number, string> = {}
      for (const gg of goalsList) goalNameById[Number(gg.id)] = String(gg.name ?? '')

      const groupedByIncomeId: Record<number, { total: number; kinds: Set<string>; goalIds: Set<number> }> = {}
      const groupedByOccurredAt: Record<string, { total: number; kinds: Set<string>; goalIds: Set<number> }> = {}
      for (const t of (tx || []) as TxRow[]) {
        const k = String((t as any).kind ?? '')
        const amt = Number((t as any).amount ?? 0)
        const gid = (t as any).goal_id
        const incId = (t as any).income_id
        if (hasIncomeId && incId !== null && incId !== undefined && Number(incId) > 0) {
          const key = Number(incId)
          if (!groupedByIncomeId[key]) groupedByIncomeId[key] = { total: 0, kinds: new Set<string>(), goalIds: new Set<number>() }
          groupedByIncomeId[key].total += amt
          if (k) groupedByIncomeId[key].kinds.add(k)
          if (gid !== null && gid !== undefined && Number(gid) > 0) groupedByIncomeId[key].goalIds.add(Number(gid))
        } else {
          const key = String((t as any).occurred_at ?? '')
          if (!key) continue
          if (!groupedByOccurredAt[key]) groupedByOccurredAt[key] = { total: 0, kinds: new Set<string>(), goalIds: new Set<number>() }
          groupedByOccurredAt[key].total += amt
          if (k) groupedByOccurredAt[key].kinds.add(k)
          if (gid !== null && gid !== undefined && Number(gid) > 0) groupedByOccurredAt[key].goalIds.add(Number(gid))
        }
      }

      const map: Record<number, number> = {}
      const dest: Record<number, string> = {}
      for (const inc of monthItems) {
        const byId = groupedByIncomeId[Number(inc.id)]
        const byOcc = groupedByOccurredAt[String((inc as any).created_at ?? '')]
        const g = byId || byOcc
        if (!g) continue
        map[Number(inc.id)] = Number(g.total ?? 0)
        if (g.kinds.size === 1 && g.kinds.has('aporte_reserva')) dest[Number(inc.id)] = 'Reserva'
        else if (g.kinds.size === 1 && g.kinds.has('aporte_meta') && g.goalIds.size === 1) {
          const onlyId = [...g.goalIds][0]
          dest[Number(inc.id)] = goalNameById[Number(onlyId)] || 'Meta'
        } else if (g.kinds.size > 0) dest[Number(inc.id)] = 'Distribuído'
      }
      setSavedMap(map)
      setDestMap(dest)
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao carregar rendas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    getUserId()
      .then((id) => {
        if (!mounted) return
        setUid(id || null)
      })
      .catch(() => {
        if (!mounted) return
        setUid(null)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!uid) return
    load()
    const ch1 = supabase.channel('incomes').on('postgres_changes', { event: '*', schema: 'public', table: 'incomes' }, () => load()).subscribe()
    const ch2 = supabase
      .channel('user_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, () => load())
      .subscribe()
    const ch3 = supabase
      .channel('transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
      supabase.removeChannel(ch3)
    }
  }, [uid, filterMonth, filterYear])

  async function addIncome(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!uid) return
    if (!amount || amount <= 0) {
      setError('Informe um valor maior que zero')
      return
    }
    const baseDt = new Date(`${incomeDate}T12:00:00`)
    if (Number.isNaN(baseDt.getTime())) {
      setError('Informe uma data válida')
      return
    }
    const dt = new Date(baseDt.getTime() + (Date.now() % 1000))
    const dtISO = dt.toISOString()
    const month = dt.getMonth() + 1
    const year = dt.getFullYear()
    if (month < 1 || month > 12 || year < 2000 || year > 3000) {
      setError('Data inválida')
      return
    }
    if (percentMode === 'custom') {
      if (rulePercent === '' || Number.isNaN(Number(rulePercent))) {
        setError('Informe um percentual personalizado válido')
        return
      }
      if (Number(rulePercent) < 0 || Number(rulePercent) > 1) {
        setError('O percentual deve ficar entre 0 e 1 (ex.: 0.10 = 10%)')
        return
      }
    }
    const selectedPercent = percentMode === 'custom' ? Number(rulePercent) : defaultPercent
    const selectedByPercent = Math.max(0, Number(amount ?? 0)) * Math.max(0, Number(selectedPercent ?? 0))
    const hasOverride = savingsOverride !== ''
    if (hasOverride) {
      if (Number.isNaN(Number(savingsOverride)) || !Number.isFinite(Number(savingsOverride))) {
        setError('Informe um valor de ouro guardado válido')
        return
      }
      if (Number(savingsOverride) < 0) {
        setError('O valor do ouro guardado não pode ser negativo')
        return
      }
      if (Number(savingsOverride) > Number(amount ?? 0)) {
        setError('O valor do ouro guardado não pode exceder a renda')
        return
      }
    }
    const savingsAmount = hasOverride ? Math.max(0, Number(savingsOverride)) : selectedByPercent
    const appliedPercent = Number(amount ?? 0) > 0 ? savingsAmount / Number(amount ?? 0) : 0

    const { data: createdIncome, error: incErr } = await supabase
      .from('incomes')
      .insert({
        user_id: uid,
        amount,
        month,
        year,
        rule_percent: hasOverride || percentMode === 'custom' ? appliedPercent : null,
        created_at: dtISO,
      })
      .select('id')
      .single()
    if (incErr) {
      setError(incErr.message)
      return
    }

    if (Number.isFinite(savingsAmount) && savingsAmount > 0) {
      const occurredAtISO = dtISO
      const occurredAtDate = incomeDate

      const formatTxError = (message: string) => {
        const msg = String(message ?? '').trim()
        const lower = msg.toLowerCase()
        const needsMigration =
          (lower.includes('aporte_meta') && lower.includes('enum') && lower.includes('transaction_kind')) ||
          (lower.includes('invalid') && lower.includes('enum') && lower.includes('aporte_meta')) ||
          (lower.includes('goal_id') && (lower.includes('does not exist') || lower.includes('não existe') || lower.includes('schema cache'))) ||
          (lower.includes('income_id') && (lower.includes('does not exist') || lower.includes('não existe') || lower.includes('schema cache'))) ||
          (lower.includes('transaction_kind') && lower.includes('aporte_meta') && lower.includes('schema cache')) ||
          lower.includes('transactions_kind_check')
        if (needsMigration) {
          return 'Seu banco ainda não está com suporte completo a metas (aporte_meta/goal_id/income_id). Rode a migração 011_saving_goals.sql no Supabase (SQL Editor) e tente novamente.'
        }
        if (lower.includes('enum') && lower.includes('transaction_kind') && lower.includes('aporte_meta')) {
          return 'Seu banco ainda não suporta o tipo "aporte_meta". Rode a migração 011_saving_goals.sql no Supabase (SQL Editor) para adicionar esse tipo.'
        }
        if (lower.includes('column') && lower.includes('goal_id') && (lower.includes('does not exist') || lower.includes('não existe'))) {
          return 'Seu banco ainda não tem a coluna goal_id em transactions. Rode a migração 011_saving_goals.sql no Supabase (SQL Editor).'
        }
        if (lower.includes('foreign key') && lower.includes('goal')) {
          return 'A meta selecionada não foi encontrada. Recarregue a página e selecione uma meta válida.'
        }
        if (lower.includes('violates') && lower.includes('check') && lower.includes('transactions_goal_requires_kind')) {
          return 'A transação da meta foi rejeitada (regra goal_id/kind). Rode a migração 011_saving_goals.sql e tente novamente.'
        }
        if (lower.includes('violates') && lower.includes('check') && lower.includes('transactions_kind_check')) {
          return 'Seu banco não permite o tipo de transação "aporte_meta" (constraint transactions_kind_check). Rode a migração 011_saving_goals.sql no Supabase (SQL Editor) e tente novamente.'
        }
        return msg || 'Erro ao registrar aportes.'
      }

      const insertTx = async (rowsISO: any[], rowsDate: any[]) => {
        const attempts: { rows: any[]; dropIncomeId: boolean }[] = [
          { rows: rowsISO, dropIncomeId: false },
          { rows: rowsDate, dropIncomeId: false },
          { rows: rowsISO, dropIncomeId: true },
          { rows: rowsDate, dropIncomeId: true },
        ]

        let lastErr: any = null
        for (const a of attempts) {
          if (!a.rows.length) continue
          const payload = a.dropIncomeId ? a.rows.map(({ income_id, ...rest }) => rest) : a.rows
          const res = await supabase.from('transactions').insert(payload)
          if (!res.error) return
          lastErr = res.error
          const msg = String(res.error.message ?? '')
          if (!a.dropIncomeId && !msg.toLowerCase().includes('income_id')) break
        }
        throw lastErr
      }

      try {
        const [{ data: s, error: sErr }, { data: g, error: gErr }] = await Promise.all([
          supabase.from('user_settings').select('pay_percent,reserve_percent').eq('user_id', uid).maybeSingle(),
          supabase.from('saving_goals').select('id,name,allocation_percent,is_active').eq('user_id', uid).eq('is_active', true),
        ])
        if (sErr) throw sErr
        if (gErr) throw gErr

        const payPercent = s ? Number((s as any).pay_percent ?? appliedPercent) : appliedPercent
        const reservePercent =
          s && (s as any).reserve_percent !== null && (s as any).reserve_percent !== undefined ? Number((s as any).reserve_percent) : payPercent
        const goals = ((g || []) as any[]).map(
          (row): SavingGoal => ({
            id: Number(row?.id ?? 0),
            name: String(row?.name ?? ''),
            allocation_percent: Number(row?.allocation_percent ?? 0),
            is_active: Boolean(row?.is_active ?? true),
          })
        )

        const activeGoals = goals.filter((gg) => gg.is_active && Number(gg.allocation_percent ?? 0) > 0)
        const totalPercent = Math.max(0, Number(appliedPercent ?? 0))

        const txPayload: any[] = []
        const incomeId = Number((createdIncome as any)?.id)
        const base = Math.max(0, Number(payPercent ?? 0))
        const scale = base > 0 ? totalPercent / base : 0

        const makeReserveTx = (row: { amount: number; occurred_at: string }) => {
          return { user_id: uid, income_id: incomeId, amount: row.amount, kind: 'aporte_reserva', occurred_at: row.occurred_at }
        }
        const makeGoalTx = (row: { amount: number; goal_id: number; occurred_at: string }) => {
          const gid = Number(row.goal_id)
          if (!Number.isFinite(gid) || gid <= 0) throw new Error('Selecione uma meta válida')
          return { user_id: uid, income_id: incomeId, amount: row.amount, kind: 'aporte_meta', goal_id: gid, occurred_at: row.occurred_at }
        }

        if (allocationMode === 'manual') {
          if (manualDestination.startsWith('meta:')) {
            const gid = Number(manualDestination.slice('meta:'.length))
            txPayload.push(makeGoalTx({ amount: savingsAmount, goal_id: gid, occurred_at: occurredAtISO }))
          } else {
            txPayload.push(makeReserveTx({ amount: savingsAmount, occurred_at: occurredAtISO }))
          }
        } else if (base <= 0 || scale <= 0) {
          txPayload.push(makeReserveTx({ amount: savingsAmount, occurred_at: occurredAtISO }))
        } else {
          const reserveAmount = Math.max(0, Number(amount ?? 0)) * Math.max(0, Number(reservePercent ?? 0)) * scale
          if (Number.isFinite(reserveAmount) && reserveAmount > 0) {
            txPayload.push(makeReserveTx({ amount: reserveAmount, occurred_at: occurredAtISO }))
          }
          for (const gg of activeGoals) {
            const ga = Math.max(0, Number(amount ?? 0)) * Math.max(0, Number(gg.allocation_percent ?? 0)) * scale
            if (Number.isFinite(ga) && ga > 0) {
              if (Number.isFinite(Number(gg.id)) && Number(gg.id) > 0) {
                txPayload.push(makeGoalTx({ amount: ga, goal_id: gg.id, occurred_at: occurredAtISO }))
              }
            }
          }
        }

        if (txPayload.length) {
          const reserveISO = txPayload.filter((t) => t.kind === 'aporte_reserva')
          const reserveDate = reserveISO.map((t) => ({ ...t, occurred_at: occurredAtDate }))
          const goalsISO = txPayload.filter((t) => t.kind === 'aporte_meta')
          const goalsDate = goalsISO.map((t) => ({ ...t, occurred_at: occurredAtDate }))

          if (reserveISO.length) await insertTx(reserveISO, reserveDate)
          if (goalsISO.length) await insertTx(goalsISO, goalsDate)
        }
      } catch (e: any) {
        const incomeId = Number((createdIncome as any)?.id)
        const del1 = await supabase.from('transactions').delete().match({ user_id: uid, income_id: incomeId }).in('kind', ['aporte_reserva', 'aporte_meta'])
        if (del1.error) {
          const msg = String(del1.error.message ?? '')
          if (msg.toLowerCase().includes('income_id')) {
            const del2 = await supabase
              .from('transactions')
              .delete()
              .match({ user_id: uid, occurred_at: dtISO })
              .in('kind', ['aporte_reserva', 'aporte_meta'])
            if (del2.error) {
              await supabase
                .from('transactions')
                .delete()
                .match({ user_id: uid, occurred_at: incomeDate })
                .in('kind', ['aporte_reserva', 'aporte_meta'])
            }
          } else {
            throw del1.error
          }
        }
        await supabase.from('incomes').delete().match({ id: Number((createdIncome as any)?.id), user_id: uid })
        setError(typeof e?.message === 'string' ? formatTxError(e.message) : 'Erro ao registrar aportes.')
        return
      }
    }

    setAmount(0)
    setRulePercent('')
    setPercentMode('default')
    setAllocationMode('auto')
    setManualDestination('reserva')
    setSavingsOverride('')
    await load()
  }

  async function deleteIncome(id: number) {
    if (!uid) return
    const target = rows.find((r) => r.id === id)
    if (!target) return
    setDeleteTarget({ id: target.id, amount: target.amount })
  }

  async function confirmDelete() {
    if (!uid) return
    if (!deleteTarget) return
    setError(null)
    setDeletingId(deleteTarget.id)
    try {
      const del1 = await supabase
        .from('transactions')
        .delete()
        .match({ user_id: uid, income_id: deleteTarget.id })
        .in('kind', ['aporte_reserva', 'aporte_meta'])
      if (del1.error) {
        const msg = String(del1.error.message ?? '')
        if (msg.toLowerCase().includes('income_id')) {
          const target = rows.find((r) => r.id === deleteTarget.id)
          if (target) {
            await supabase
              .from('transactions')
              .delete()
              .match({ user_id: uid, occurred_at: String(target.created_at ?? '') })
              .in('kind', ['aporte_reserva', 'aporte_meta'])
          }
        } else {
          throw del1.error
        }
      }
      const { error } = await supabase.from('incomes').delete().eq('id', deleteTarget.id).eq('user_id', uid)
      if (error) throw error
      await load()
      setDeleteTarget(null)
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao excluir renda')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mt-8">
        <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 text-sm text-[#6B7280] shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          Carregando…
        </div>
      </div>
    )
  }

  // --- UI helpers (combinando com Arkádion / Babilônia Moderna) ---
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
    <section
      className={`rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_10px_30px_rgba(11,19,36,0.10)] ${className}`}
    >
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
    tone?: 'neutral' | 'ok' | 'warn'
  }) => {
    const toneCls = tone === 'ok' ? 'text-[#2E7D32]' : tone === 'warn' ? 'text-[#D97706]' : 'text-[#111827]'
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

  return (
    <div className="w-full space-y-6">
      {/* HERO (topo) */}
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
                    Rendas
                  </div>
                  <div className="mt-1 text-xs text-[#6B7280]">
                    Registre entradas e aplique o “pague-se primeiro” — antes de qualquer gasto.
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill variant="gold">Padrão: {(defaultPercent * 100).toFixed(0)}%</Pill>
                <Pill variant="sky">
                  Mês: {String(filterMonth).padStart(2, '0')}/{filterYear}
                </Pill>
                <Pill>Itens: {rows.length}</Pill>
              </div>
            </div>

            <div className="flex gap-2">
              <select
                className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.10)]"
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
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

        {/* Ornamento dourado */}
        <div
          className="h-[3px] w-full"
          style={{
            background:
              'linear-gradient(90deg, rgba(194,161,77,0) 0%, rgba(194,161,77,0.9) 50%, rgba(194,161,77,0) 100%)',
          }}
        />
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Renda do mês" value={fmt(totals.incomeTotal)} hint="Somatório das entradas filtradas" />
        <Stat
          label="Ouro guardado"
          value={fmt(totals.savingsTotal)}
          hint={`Taxa total: ${(totals.savingsRate * 100).toFixed(1)}%`}
          tone="ok"
        />
        <Stat
          label="Disponível para gastar"
          value={fmt(totals.availableTotal)}
          hint="Renda − ouro guardado"
          tone={totals.availableTotal < 0 ? 'warn' : 'neutral'}
        />
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* FORM (mais “produto”) */}
        <Card
          title="Cadastrar renda"
          subtitle="Defina data, valor, percentual e destino do ouro guardado."
          right={<Pill>Entrada</Pill>}
          className="lg:col-span-4"
        >
          <form onSubmit={addIncome} className="space-y-3">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Data</label>
              <input
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/40"
                type="date"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Valor</label>
              <input
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/40"
                type="number"
                step="0.01"
                placeholder="Ex.: 3500"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs text-[#6B7280] mb-1">Percentual do “pague-se primeiro”</label>
                <span className="text-xs text-[#6B7280]">Padrão: {(defaultPercent * 100).toFixed(0)}%</span>
              </div>

              <div className="mt-1 space-y-2">
                <label className="flex items-center gap-2 text-sm text-[#111827]">
                  <input type="radio" name="percentMode" checked={percentMode === 'default'} onChange={() => setPercentMode('default')} />
                  Usar percentual padrão
                </label>

                <label className="flex items-center gap-2 text-sm text-[#111827]">
                  <input type="radio" name="percentMode" checked={percentMode === 'custom'} onChange={() => setPercentMode('custom')} />
                  Personalizar para esta renda
                </label>

                {percentMode === 'custom' ? (
                  <input
                    className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/40"
                    type="number"
                    step="0.01"
                    placeholder="Ex.: 0.10 para 10%"
                    value={rulePercent}
                    onChange={(e) => setRulePercent(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                ) : null}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Destino do ouro guardado</label>
              <div className="mt-1 space-y-2">
                <label className="flex items-center gap-2 text-sm text-[#111827]">
                  <input type="radio" name="allocationMode" checked={allocationMode === 'auto'} onChange={() => setAllocationMode('auto')} />
                  Distribuir conforme configurações
                </label>
                <label className="flex items-center gap-2 text-sm text-[#111827]">
                  <input type="radio" name="allocationMode" checked={allocationMode === 'manual'} onChange={() => setAllocationMode('manual')} />
                  Escolher destino
                </label>
                {allocationMode === 'manual' ? (
                  <select
                    className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/40"
                    value={manualDestination}
                    onChange={(e) => setManualDestination(e.target.value)}
                  >
                    <option value="reserva">Reserva de emergência</option>
                    {goals
                      .filter((g) => g.is_active)
                      .map((g) => (
                        <option key={g.id} value={`meta:${g.id}`}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className="text-[11px] text-[#6B7280]">Usa Reserva + Metas, conforme percentuais em Configurações.</div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Valor do ouro guardado (opcional)</label>
              <input
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.06)] focus:outline-none focus:ring-2 focus:ring-[#C2A14D]/40"
                type="number"
                step="0.01"
                placeholder={computedSavings > 0 ? fmt(computedSavings) : 'Ex.: 350'}
                value={savingsOverride}
                onChange={(e) => setSavingsOverride(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            {/* PRÉVIA (com barras, bem Arkádion) */}
            <div className="rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#6B7280]">Prévia</div>
                <Pill variant="gold">{(previewPercent * 100).toFixed(1)}%</Pill>
              </div>

              <div className="mt-2 text-sm text-[#111827]">
                Você guarda <span className="font-semibold">{fmt(previewSavings)}</span> e fica disponível{' '}
                <span className="font-semibold">{fmt(previewAvailable)}</span>.
              </div>

              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                  <div className="h-full bg-[#C2A14D]" style={{ width: `${Math.min(100, Math.max(0, previewPercent * 100))}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-[#6B7280]">
                  Dica: 0.10 = 10% (primeiro você paga a si mesmo).
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              className="w-full rounded-xl bg-[#0B1324] text-[#FBFAF7] px-4 py-2.5 text-sm shadow-[0_14px_40px_rgba(11,19,36,0.18)] hover:bg-[#17233A] transition border border-[#17233A]"
            >
              Salvar renda
            </button>
          </form>
        </Card>

        {/* TABELA + RECENTES */}
        <Card
          title={`Rendas de ${String(filterMonth).padStart(2, '0')}/${filterYear}`}
          subtitle="Detalhamento do ouro guardado e destino por entrada."
          right={<Pill>{rows.length} item(ns)</Pill>}
          className="lg:col-span-8"
        >
          {rows.length === 0 ? (
            <div className="text-sm text-[#6B7280]">Sem rendas registradas neste mês.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#6B7280]">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 pr-3">%</th>
                    <th className="py-2 pr-3">Ouro</th>
                    <th className="py-2 pr-3">Destino</th>
                    <th className="py-2 pr-3">Disponível</th>
                    <th className="py-2 pr-3">Modo</th>
                    <th className="py-2 pr-0 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-[#E4E1D6]">
                      <td className="py-2 pr-3 text-[#111827]">
                        {(() => {
                          const dt = new Date(r.created_at)
                          if (Number.isNaN(dt.getTime())) return '--/--'
                          return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
                        })()}
                      </td>
                      <td className="py-2 pr-3 font-medium text-[#111827]">{fmt(r.amount)}</td>
                      <td className="py-2 pr-3 text-[#111827]">{(r.used_percent * 100).toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-[#111827]">{fmt(r.savings_amount)}</td>
                      <td className="py-2 pr-3 text-[#111827]">
                        <span className="text-xs rounded-full border px-2 py-0.5 bg-white text-[#374151] border-[#E4E1D6]">
                          {destMap[r.id] || '—'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-[#111827]">{fmt(r.available_amount)}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 border ${
                            r.mode === 'custom'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-[#F5F2EB] text-[#374151] border-[#E4E1D6]'
                          }`}
                        >
                          {r.mode === 'custom' ? 'personalizado' : 'padrão'}
                        </span>
                      </td>
                      <td className="py-2 pr-0 text-right">
                        <button
                          type="button"
                          className="rounded-lg border border-[#E4E1D6] bg-white px-3 py-1.5 text-xs text-[#991B1B] hover:bg-[#FEF2F2] disabled:opacity-50"
                          onClick={() => deleteIncome(r.id)}
                          disabled={deletingId === r.id}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-7 border-t border-[#E4E1D6] pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-[#111827]">Últimas rendas</div>
              <Pill variant="neutral">Histórico</Pill>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recent.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-[#E4E1D6] bg-white px-4 py-3 flex items-center justify-between gap-3 shadow-[0_10px_30px_rgba(11,19,36,0.06)]"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-[#6B7280]">
                      {(() => {
                        const dt = new Date(r.created_at)
                        if (Number.isNaN(dt.getTime())) return `${String(r.month).padStart(2, '0')}/${r.year}`
                        return dt.toLocaleDateString('pt-BR')
                      })()}
                    </div>
                    <div className="text-sm font-medium text-[#111827] truncate">{fmt(r.amount)}</div>
                  </div>
                  <span className="text-xs text-[#6B7280]">
                    {typeof r.rule_percent === 'number'
                      ? `${(r.rule_percent * 100).toFixed(0)}%`
                      : `${(defaultPercent * 100).toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* MODAL */}
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={() => (deletingId ? undefined : setDeleteTarget(null))}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#E4E1D6] bg-white shadow-[0_24px_80px_rgba(11,19,36,0.25)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="font-[ui-serif,Georgia,serif] text-lg text-[#111827]">Confirmar exclusão</div>
              <div className="mt-2 text-sm text-[#6B7280]">
                Você está prestes a excluir a renda de{' '}
                <span className="font-semibold text-[#111827]">{fmt(deleteTarget.amount)}</span>. Essa ação não pode ser desfeita.
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-[#E4E1D6] bg-white px-4 py-2 text-sm text-[#111827] hover:bg-[#FBFAF7] disabled:opacity-50"
                  onClick={() => setDeleteTarget(null)}
                  disabled={Boolean(deletingId)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[#991B1B] px-4 py-2 text-sm text-white hover:bg-[#7F1D1D] disabled:opacity-50"
                  onClick={() => confirmDelete()}
                  disabled={deletingId === deleteTarget.id}
                >
                  Excluir
                </button>
              </div>
            </div>

            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#C2A14D] to-transparent" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
