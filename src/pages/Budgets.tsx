import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type Category = { id: number; name: string }
type BudgetRow = {
  category_id: number
  category_name: string
  month: number
  year: number
  limit_amount: number
  spent_amount: number
}

export default function Budgets() {
  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)

  const now = useMemo(() => new Date(), [])
  const [month, setMonth] = useState<number>(now.getMonth() + 1)
  const [year, setYear] = useState<number>(now.getFullYear())
  const [limit, setLimit] = useState<number>(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadSeq = useRef(0)

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const yearOptions = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], [now])
  const fmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) return null
    return categories.find((c) => c.id === categoryId)?.name ?? null
  }, [categories, categoryId])

  const totals = useMemo(() => {
    const limitTotal = rows.reduce((acc, r) => acc + Math.max(0, Number(r.limit_amount ?? 0)), 0)
    const spentTotal = rows.reduce((acc, r) => acc + Number(r.spent_amount ?? 0), 0)
    const remainingTotal = limitTotal - spentTotal

    const warningCount = rows.filter((r) => {
      const lim = Number(r.limit_amount ?? 0)
      const spent = Number(r.spent_amount ?? 0)
      return lim > 0 && spent >= lim * 0.8 && spent < lim
    }).length

    const criticalCount = rows.filter((r) => {
      const lim = Number(r.limit_amount ?? 0)
      const spent = Number(r.spent_amount ?? 0)
      return lim > 0 && spent >= lim
    }).length

    const noBudgetCount = Math.max(0, categories.length - rows.length)
    const usagePct = limitTotal > 0 ? spentTotal / limitTotal : null

    return { limitTotal, spentTotal, remainingTotal, warningCount, criticalCount, noBudgetCount, usagePct }
  }, [rows, categories.length])

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
      setCategories((cats || []) as Category[])

      const { data: budgets, error: budgetsError } = await supabase
        .from('budgets')
        .select('category_id,month,year,limit_amount,categories(name)')
        .eq('user_id', uid)
        .eq('month', month)
        .eq('year', year)
      if (budgetsError) throw budgetsError
      if (seq !== loadSeq.current) return

      const startISO = new Date(Date.UTC(year, month - 1, 1)).toISOString()
      const endISO = new Date(Date.UTC(year, month, 1)).toISOString()

      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('amount,category_id,occurred_at,kind')
        .eq('user_id', uid)
        .eq('kind', 'despesa')
        .gte('occurred_at', startISO)
        .lt('occurred_at', endISO)
      if (txError) throw txError
      if (seq !== loadSeq.current) return

      const spentByCategoryId: Record<number, number> = {}
      for (const t of (tx || []) as any[]) {
        const cid = Number(t.category_id ?? 0)
        if (!cid) continue
        spentByCategoryId[cid] = (spentByCategoryId[cid] ?? 0) + Number(t.amount ?? 0)
      }

      setRows(
        (budgets || []).map((b: any) => {
          const cid = Number(b.category_id ?? 0)
          const nameFromJoin = (b as any)?.categories?.name
          const nameFromCats = (cats || []).find((c: any) => Number(c.id) === cid)?.name
          return {
            category_id: cid,
            category_name: String(nameFromJoin ?? nameFromCats ?? ''),
            month: Number(b.month ?? month),
            year: Number(b.year ?? year),
            limit_amount: Number(b.limit_amount ?? 0),
            spent_amount: Number(spentByCategoryId[cid] ?? 0),
          }
        })
      )
    } catch (e: any) {
      if (seq !== loadSeq.current) return
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao carregar orçamentos.')
    } finally {
      if (seq !== loadSeq.current) return
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    setCategoryId(null)
    setLimit(0)
    load()

    const ch = supabase
      .channel('budgets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()

    return () => {
      loadSeq.current += 1
      supabase.removeChannel(ch)
    }
  }, [load])

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const uid = await getUserId()
    if (!uid || !categoryId) return
    if (!Number.isFinite(limit) || limit <= 0) {
      setError('Informe um limite maior que zero.')
      return
    }

    const { error } = await supabase
      .from('budgets')
      .upsert(
        { user_id: uid, category_id: categoryId, month, year, limit_amount: limit },
        { onConflict: 'user_id,category_id,month,year' }
      )

    if (error) setError(error.message)
    setLimit(0)
    setCategoryId(null)
    await load()
  }

  async function removeBudget() {
    setError(null)
    const uid = await getUserId()
    if (!uid || !categoryId) return
    const { error } = await supabase.from('budgets').delete().match({ user_id: uid, category_id: categoryId, month, year })
    if (error) setError(error.message)
    setCategoryId(null)
    setLimit(0)
    await load()
  }

  const rowsSorted = useMemo(() => {
    return [...rows].sort((a, b) => Number(b.spent_amount ?? 0) - Number(a.spent_amount ?? 0))
  }, [rows])

  const monthLabel = `${String(month).padStart(2, '0')}/${year}`

  return (
    <div className="w-full space-y-6">
        <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_10px_40px_rgba(11,19,36,0.10)]">
          <div className="px-5 py-5 sm:px-6 lg:px-8 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl border border-[#D6D3C8] bg-white shadow-[0_6px_18px_rgba(11,19,36,0.08)] flex items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-[#C2A14D]" />
                </div>

                <div className="min-w-0">
                  <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">
                    Orçamentos
                  </div>
                  <div className="mt-1 text-xs text-[#6B7280]">
                    Defina limites e acompanhe o consumo por categoria ao longo do mês.
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.10)]"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
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
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
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

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs rounded-full border border-[#E4E1D6] bg-[#F5F2EB] px-3 py-1 text-[#374151]">
                Mês: {monthLabel}
              </span>

              <span className="text-xs rounded-full border border-[#E4E1D6] bg-white px-3 py-1 text-[#374151]">
                Categorias sem orçamento: {totals.noBudgetCount}
              </span>

              <span className="text-xs rounded-full border border-[#E4E1D6] bg-white px-3 py-1 text-[#374151]">
                Uso total: {totals.usagePct === null ? '—' : `${Math.round(totals.usagePct * 100)}%`}
              </span>

              {totals.criticalCount > 0 ? (
                <span className="text-xs rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-800">
                  Estourados: {totals.criticalCount}
                </span>
              ) : null}

              {totals.warningCount > 0 ? (
                <span className="text-xs rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                  Em alerta: {totals.warningCount}
                </span>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <WideKpi title="Limite total" value={fmt.format(totals.limitTotal)} subtitle="Somatório dos limites do mês" />
          <WideKpi title="Gasto" value={fmt.format(totals.spentTotal)} subtitle="Somatório das despesas do mês" />
          <WideKpi
            title="Restante"
            value={fmt.format(totals.remainingTotal)}
            subtitle="Limite total − gasto"
            tone={totals.remainingTotal < 0 ? 'bad' : 'neutral'}
          />
          <WideKpi title="Em alerta" value={String(totals.warningCount)} subtitle="Categorias ≥ 80%" tone="warn" />
          <WideKpi title="Estourados" value={String(totals.criticalCount)} subtitle="Categorias ≥ 100%" tone="bad" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-[#111827]">Definir orçamento</div>
                <div className="mt-1 text-xs text-[#6B7280]">
                  {selectedCategoryName ? `Editando: ${selectedCategoryName}` : 'Escolha a categoria e defina o limite.'}
                </div>
              </div>
              <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
                Cadastro
              </span>
            </div>

            <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

            <form onSubmit={saveBudget} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Categoria</label>
                <select
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  disabled={loading}
                >
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Limite</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  type="number"
                  step="0.01"
                  placeholder="Ex.: 600"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  disabled={loading}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  className="rounded-xl bg-[#111827] text-white px-4 py-2 text-sm shadow-[0_14px_40px_rgba(11,19,36,0.18)] disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Salvando…' : 'Salvar'}
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-[#D6D3C8] bg-white px-4 py-2 text-sm disabled:opacity-60 hover:bg-[#F5F2EB]"
                  onClick={removeBudget}
                  disabled={loading || !categoryId}
                >
                  Remover
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[#E4E1D6] bg-white p-3">
                <div className="text-xs text-[#6B7280]">Dica</div>
                <div className="mt-1 text-sm text-[#111827]">
                  Comece pelas categorias maiores e ajuste semanalmente para manter o ciclo sob controle.
                </div>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)] lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-[#111827]">Orçamentos por categoria</div>
                <div className="mt-1 text-xs text-[#6B7280]">Toque em um item para editar rapidamente.</div>
              </div>
              <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
                {rowsSorted.length} item(ns)
              </span>
            </div>

            <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

            {loading ? (
              <div className="mt-4 text-sm text-[#6B7280]">Carregando…</div>
            ) : rowsSorted.length === 0 ? (
              <div className="mt-4 text-sm text-[#6B7280]">Nenhum orçamento definido para este mês.</div>
            ) : (
              <ul className="mt-4 space-y-3">
                {rowsSorted.map((r) => {
                  const lim = Number(r.limit_amount ?? 0)
                  const spent = Number(r.spent_amount ?? 0)
                  const pct = lim > 0 ? spent / lim : null

                  const barPct = pct === null ? 0 : Math.min(1, pct)
                  const barColor = pct === null ? '#CBD5E1' : pct >= 1 ? '#B91C1C' : pct >= 0.8 ? '#D97706' : '#16A34A'

                  const pill =
                    pct === null
                      ? 'bg-[#F5F2EB] text-[#374151] border-[#E4E1D6]'
                      : pct >= 1
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : pct >= 0.8
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'

                  const remaining = lim > 0 ? lim - spent : null

                  return (
                    <li
                      key={`${r.category_id}-${r.month}-${r.year}`}
                      className="rounded-xl border border-[#E4E1D6] bg-white p-4 hover:bg-[#FBFAF7] cursor-pointer"
                      onClick={() => {
                        setCategoryId(r.category_id)
                        setLimit(lim)
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#111827] truncate">{r.category_name}</div>
                          <div className="text-xs text-[#6B7280]">
                            {fmt.format(spent)}
                            {lim > 0 ? ` / ${fmt.format(lim)}` : ''}
                          </div>

                          {remaining !== null ? (
                            <div className={`text-xs mt-1 ${remaining < 0 ? 'text-red-700' : 'text-[#6B7280]'}`}>
                              Restante: {fmt.format(remaining)}
                            </div>
                          ) : null}
                        </div>

                        <span className={`text-xs rounded-full px-2 py-0.5 border ${pill}`}>
                          {pct === null ? 'sem limite' : `${Math.round(pct * 100)}%`}
                        </span>
                      </div>

                      <div className="mt-3 h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                        <div className="h-full" style={{ width: `${barPct * 100}%`, background: barColor }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
    </div>
  )
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
