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
  const fmt = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  )

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) return null
    return categories.find((c) => c.id === categoryId)?.name ?? null
  }, [categories, categoryId])

  const totals = useMemo(() => {
    const limitTotal = rows.reduce((acc, r) => acc + (Number(r.limit_amount ?? 0) > 0 ? Number(r.limit_amount ?? 0) : 0), 0)
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
  }, [categories.length, rows])

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
      setCategories(cats || [])

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
      .upsert({ user_id: uid, category_id: categoryId, month, year, limit_amount: limit }, { onConflict: 'user_id,category_id,month,year' })
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

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-semibold">Orçamentos</div>
            <div className="text-xs text-slate-500">Visão do mês, limites e consumo por categoria.</div>
          </div>
          <div className="flex gap-2">
            <select
              className="border rounded px-3 py-2"
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
              className="border rounded px-3 py-2"
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

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="border rounded p-3">
            <div className="text-xs text-slate-500">Limite total</div>
            <div className="font-semibold">{fmt.format(totals.limitTotal)}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-slate-500">Gasto total</div>
            <div className="font-semibold">{fmt.format(totals.spentTotal)}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-slate-500">Restante</div>
            <div className={`font-semibold ${totals.remainingTotal < 0 ? 'text-red-700' : ''}`}>
              {fmt.format(totals.remainingTotal)}
            </div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-slate-500">Em alerta (≥ 80%)</div>
            <div className="font-semibold">{totals.warningCount}</div>
          </div>
          <div className="border rounded p-3">
            <div className="text-xs text-slate-500">Estourados (≥ 100%)</div>
            <div className="font-semibold">{totals.criticalCount}</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          {totals.usagePct === null ? 'Defina limites para acompanhar o consumo do orçamento.' : `Uso total: ${Math.round(totals.usagePct * 100)}%`}
          {totals.noBudgetCount > 0 ? ` • Categorias sem orçamento: ${totals.noBudgetCount}` : null}
        </div>

        {error ? <div className="text-red-600 text-sm mt-3">{error}</div> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded p-4">
          <div className="font-semibold mb-2">Definir orçamento</div>
          {selectedCategoryName ? <div className="text-xs text-slate-500 mb-3">Editando: {selectedCategoryName}</div> : null}
          <form onSubmit={saveBudget} className="space-y-3">
            <select
              className="border rounded px-3 py-2 w-full"
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              disabled={loading}
            >
              <option value="" disabled>
                Categoria
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              className="border rounded px-3 py-2 w-full"
              type="number"
              step="0.01"
              placeholder="Limite (R$)"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={loading}
            />
            <div className="flex gap-2">
              <button className="bg-slate-900 text-white rounded px-4 py-2 disabled:opacity-60" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                className="border rounded px-4 py-2 disabled:opacity-60"
                onClick={removeBudget}
                disabled={loading || !categoryId}
              >
                Remover
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white border rounded p-4">
          <div className="font-semibold mb-2">Orçamentos por categoria</div>
          {loading ? (
            <div>Carregando...</div>
          ) : rowsSorted.length === 0 ? (
            <div className="text-sm text-slate-600">Nenhum orçamento definido para este mês. Defina um limite ao lado.</div>
          ) : (
            <ul className="space-y-3">
              {rowsSorted.map((r) => {
                const lim = Number(r.limit_amount ?? 0)
                const spent = Number(r.spent_amount ?? 0)
                const pct = lim > 0 ? spent / lim : null
                const pctLabel = pct === null ? 'sem limite' : `${Math.round(pct * 100)}%`
                const barPct = pct === null ? 0 : Math.min(1, pct)
                const barColor = pct === null ? '#CBD5E1' : pct >= 1 ? '#B91C1C' : pct >= 0.8 ? '#D97706' : '#16A34A'
                const pill =
                  pct === null
                    ? 'bg-slate-100 text-slate-700'
                    : pct >= 1
                      ? 'bg-red-100 text-red-700'
                      : pct >= 0.8
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-emerald-100 text-emerald-700'
                const remaining = lim > 0 ? lim - spent : null

                return (
                  <li
                    key={`${r.category_id}-${r.month}-${r.year}`}
                    className="border rounded p-3 hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      setCategoryId(r.category_id)
                      setLimit(lim)
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.category_name}</div>
                        <div className="text-xs text-slate-500">
                          {fmt.format(spent)}
                          {lim > 0 ? ` / ${fmt.format(lim)}` : ''}
                        </div>
                        {remaining !== null ? (
                          <div className={`text-xs mt-1 ${remaining < 0 ? 'text-red-700' : 'text-slate-600'}`}>
                            Restante: {fmt.format(remaining)}
                          </div>
                        ) : null}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${pill}`}>{pctLabel}</span>
                    </div>

                    <div className="mt-2 h-2 w-full rounded bg-slate-100 overflow-hidden">
                      <div className="h-full" style={{ width: `${barPct * 100}%`, background: barColor }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

