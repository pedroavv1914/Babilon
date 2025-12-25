import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

type Category = { id: number; name: string; type: 'fixo' | 'variavel' }
type BudgetRow = { category_id: number; limit_amount: number }
type TxRow = { category_id: number | null; amount: number; occurred_at: string }

export default function Categories() {
  const navigate = useNavigate()
  const now = useMemo(() => new Date(), [])
  const [month, setMonth] = useState<number>(now.getMonth() + 1)
  const [year, setYear] = useState<number>(now.getFullYear())
  const [dataMonth, setDataMonth] = useState<number>(now.getMonth() + 1)
  const [dataYear, setDataYear] = useState<number>(now.getFullYear())

  const [items, setItems] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [tx, setTx] = useState<TxRow[]>([])

  const [name, setName] = useState('')
  const [type, setType] = useState<'fixo' | 'variavel'>('fixo')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'fixo' | 'variavel'>('all')
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'with_budget' | 'without_budget'>('all')
  const [sort, setSort] = useState<'name' | 'spent_desc'>('name')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadSeq = useRef(0)

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const yearOptions = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], [now])
  const fmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  const monthLabel = `${String(dataMonth).padStart(2, '0')}/${dataYear}`
  const isUpdating = loading && (month !== dataMonth || year !== dataYear)

  const budgetLimitByCategoryId = useMemo(() => {
    const map: Record<number, number> = {}
    for (const b of budgets) map[Number(b.category_id)] = Number(b.limit_amount ?? 0)
    return map
  }, [budgets])

  const spentByCategoryId = useMemo(() => {
    const map: Record<number, number> = {}
    for (const t of tx) {
      const cid = Number(t.category_id ?? 0)
      if (!cid) continue
      map[cid] = (map[cid] ?? 0) + Number(t.amount ?? 0)
    }
    return map
  }, [tx])

  const normalizedName = useMemo(() => name.trim().toLowerCase(), [name])
  const nameAlreadyExists = useMemo(() => {
    if (!normalizedName) return false
    return items.some((c) => c.name.trim().toLowerCase() === normalizedName)
  }, [items, normalizedName])

  const derivedRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = items.map((c) => {
      const limit = Number(budgetLimitByCategoryId[c.id] ?? 0)
      const spent = Number(spentByCategoryId[c.id] ?? 0)
      const pct = limit > 0 ? spent / limit : null
      return { ...c, limit, spent, pct, remaining: limit - spent }
    })

    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q))
    if (typeFilter !== 'all') rows = rows.filter((r) => r.type === typeFilter)
    if (budgetFilter === 'with_budget') rows = rows.filter((r) => r.limit > 0)
    if (budgetFilter === 'without_budget') rows = rows.filter((r) => r.limit <= 0)

    rows =
      sort === 'spent_desc'
        ? [...rows].sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name))
        : [...rows].sort((a, b) => a.name.localeCompare(b.name))

    return rows
  }, [budgetFilter, budgetLimitByCategoryId, items, query, sort, spentByCategoryId, typeFilter])

  const totals = useMemo(() => {
    const total = items.length
    const fixed = items.filter((c) => c.type === 'fixo').length
    const variable = items.filter((c) => c.type === 'variavel').length
    const withBudget = items.filter((c) => Number(budgetLimitByCategoryId[c.id] ?? 0) > 0).length
    const withoutBudget = Math.max(0, total - withBudget)

    let warning = 0
    let critical = 0
    for (const c of items) {
      const limit = Number(budgetLimitByCategoryId[c.id] ?? 0)
      const spent = Number(spentByCategoryId[c.id] ?? 0)
      if (limit <= 0) continue
      const pct = spent / limit
      if (pct >= 1) critical += 1
      else if (pct >= 0.8) warning += 1
    }

    const spentTotal = items.reduce((acc, c) => acc + Number(spentByCategoryId[c.id] ?? 0), 0)

    return { total, fixed, variable, withBudget, withoutBudget, warning, critical, spentTotal }
  }, [budgetLimitByCategoryId, items, spentByCategoryId])

  const topSpending = useMemo(() => {
    return [...derivedRows]
      .filter((r) => r.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5)
  }, [derivedRows])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setError(null)
    setLoading(true)

    try {
      const uid = await getUserId()
      if (!uid) return
      if (seq !== loadSeq.current) return

      const { data: cats, error: catsError } = await supabase
        .from('categories')
        .select('id,name,type')
        .eq('user_id', uid)
        .order('name')
      if (catsError) throw catsError
      if (seq !== loadSeq.current) return
      setItems((cats || []).map((c: any) => ({ id: Number(c.id), name: String(c.name ?? ''), type: c.type === 'variavel' ? 'variavel' : 'fixo' })))

      const { data: b, error: bError } = await supabase
        .from('budgets')
        .select('category_id,limit_amount')
        .eq('user_id', uid)
        .eq('month', month)
        .eq('year', year)
      if (bError) throw bError
      if (seq !== loadSeq.current) return
      setBudgets((b || []).map((r: any) => ({ category_id: Number(r.category_id ?? 0), limit_amount: Number(r.limit_amount ?? 0) })))

      const startISO = new Date(Date.UTC(year, month - 1, 1)).toISOString()
      const endISO = new Date(Date.UTC(year, month, 1)).toISOString()
      const { data: t, error: tError } = await supabase
        .from('transactions')
        .select('category_id,amount,occurred_at')
        .eq('user_id', uid)
        .eq('kind', 'despesa')
        .gte('occurred_at', startISO)
        .lt('occurred_at', endISO)
      if (tError) throw tError
      if (seq !== loadSeq.current) return
      setTx(
        (t || []).map((row: any) => ({
          category_id: row.category_id === null || row.category_id === undefined ? null : Number(row.category_id),
          amount: Number(row.amount ?? 0),
          occurred_at: String(row.occurred_at ?? ''),
        }))
      )

      setDataMonth(month)
      setDataYear(year)
    } catch (e: any) {
      if (seq !== loadSeq.current) return
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao carregar categorias.')
    } finally {
      if (seq !== loadSeq.current) return
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    load()

    const ch1 = supabase
      .channel('categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => load())
      .subscribe()

    const ch2 = supabase
      .channel('budgets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => load())
      .subscribe()

    const ch3 = supabase
      .channel('transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => load())
      .subscribe()

    return () => {
      loadSeq.current += 1
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
      supabase.removeChannel(ch3)
    }
  }, [load])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const uid = await getUserId()
    if (!uid) return

    const nextName = name.trim()
    if (nextName.length < 2) {
      setError('Informe um nome com pelo menos 2 caracteres.')
      return
    }
    if (nameAlreadyExists) {
      setError('Já existe uma categoria com este nome.')
      return
    }

    const { error } = await supabase.from('categories').insert({ user_id: uid, name: nextName, type })
    if (error) {
      setError(error.message)
      return
    }

    setName('')
    setType('fixo')
    await load()
  }

  async function removeCategory(id: number) {
    setError(null)
    const uid = await getUserId()
    if (!uid) return
    if (!window.confirm('Excluir esta categoria? Isso pode afetar orçamentos e relatórios.')) return
    const { error } = await supabase.from('categories').delete().match({ id, user_id: uid })
    if (error) {
      const msg = String(error.message ?? '')
      if (msg.toLowerCase().includes('foreign key') || msg.toLowerCase().includes('constraint')) {
        setError('Não foi possível excluir: existem transações ou orçamentos vinculados a esta categoria.')
      } else {
        setError(msg || 'Não foi possível excluir a categoria.')
      }
      return
    }
    await load()
  }

  const initialLoading = loading && items.length === 0 && budgets.length === 0 && tx.length === 0 && !error
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
                  <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">Categorias</div>
                  <div className="mt-1 text-xs text-[#6B7280]">Organize seus gastos e melhore a leitura do mês.</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill variant="sky">Mês: {monthLabel}</Pill>
                <Pill variant="gold">Gasto: {fmt.format(totals.spentTotal)}</Pill>
                <Pill>Sem orçamento: {totals.withoutBudget}</Pill>
                <Pill>Alertas: {totals.warning + totals.critical}</Pill>
                {isUpdating ? <Pill>Atualizando…</Pill> : null}
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
        <WideKpi title="Total" value={String(totals.total)} subtitle="Categorias cadastradas" />
        <WideKpi title="Fixas" value={String(totals.fixed)} subtitle="Custos recorrentes" />
        <WideKpi title="Variáveis" value={String(totals.variable)} subtitle="Gastos do dia a dia" />
        <WideKpi title="Com orçamento" value={String(totals.withBudget)} subtitle="Limite definido no mês" tone="ok" />
        <WideKpi title="Em alerta" value={String(totals.warning + totals.critical)} subtitle="Categorias ≥ 80%" tone={totals.critical > 0 ? 'bad' : totals.warning > 0 ? 'warn' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#111827]">Nova categoria</div>
              <div className="mt-1 text-xs text-[#6B7280]">Dê nomes objetivos para facilitar a revisão do mês.</div>
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">Cadastro</span>
          </div>

          <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

          <form onSubmit={addCategory} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Nome</label>
              <input
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                placeholder="Ex.: Mercado, Aluguel, Transporte"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Tipo</label>
              <select
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                disabled={loading}
              >
                <option value="fixo">Fixo</option>
                <option value="variavel">Variável</option>
              </select>
            </div>

            {name.trim() ? (
              <div className="rounded-xl border border-[#E4E1D6] bg-white p-3">
                <div className="text-xs text-[#6B7280]">Prévia</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="text-sm text-[#111827] truncate">{name.trim()}</div>
                  <span className={`text-[11px] rounded-full border px-2 py-0.5 ${type === 'fixo' ? 'border-[#C2A14D]/40 bg-[#F5F2EB] text-[#5A4A1A]' : 'border-[#0EA5E9]/30 bg-[#E6F6FE] text-[#0B5E86]'}`}>
                    {type}
                  </span>
                </div>
                {nameAlreadyExists ? <div className="mt-2 text-xs text-[#B45309]">Já existe uma categoria com este nome.</div> : null}
              </div>
            ) : null}

            <button className="w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm text-white shadow-[0_14px_40px_rgba(11,19,36,0.20)] hover:bg-black" disabled={loading}>
              Adicionar
            </button>

            <button
              type="button"
              className="w-full rounded-xl border border-[#D6D3C8] bg-white px-4 py-2.5 text-sm hover:bg-[#F5F2EB]"
              onClick={() => navigate('/budgets')}
              disabled={loading}
            >
              Ir para Orçamentos
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)] lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#111827]">Categorias e sinais</div>
              <div className="mt-1 text-xs text-[#6B7280]">Filtro rápido + visão do gasto no mês.</div>
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
              {derivedRows.length} item(ns){derivedRows.length !== items.length ? ` de ${items.length}` : ''}
            </span>
          </div>

          <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm md:col-span-2"
              placeholder="Buscar categoria..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <select
              className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              disabled={loading}
            >
              <option value="all">Todos os tipos</option>
              <option value="fixo">Fixas</option>
              <option value="variavel">Variáveis</option>
            </select>
            <select
              className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value as any)}
              disabled={loading}
            >
              <option value="all">Orçamento: todos</option>
              <option value="with_budget">Com orçamento</option>
              <option value="without_budget">Sem orçamento</option>
            </select>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              disabled={loading}
            >
              <option value="name">Ordenar: nome</option>
              <option value="spent_desc">Ordenar: gasto (desc)</option>
            </select>

            {query || typeFilter !== 'all' || budgetFilter !== 'all' || sort !== 'name' ? (
              <button
                className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm hover:bg-[#F5F2EB]"
                onClick={() => {
                  setQuery('')
                  setTypeFilter('all')
                  setBudgetFilter('all')
                  setSort('name')
                }}
                disabled={loading}
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="mt-4 text-sm text-[#6B7280]">Você ainda não tem categorias. Crie as principais para começar.</div>
          ) : derivedRows.length === 0 ? (
            <div className="mt-4 text-sm text-[#6B7280]">Nenhuma categoria encontrada com os filtros atuais.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#6B7280]">
                    <th className="py-2 pr-3">Categoria</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Gasto</th>
                    <th className="py-2 pr-3">Orçamento</th>
                    <th className="py-2 pr-3">Uso</th>
                    <th className="py-2 pr-0 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {derivedRows.map((r) => {
                    const pct = r.limit > 0 ? r.spent / r.limit : null
                    const pill =
                      pct === null
                        ? 'bg-[#F5F2EB] text-[#374151] border border-[#E4E1D6]'
                        : pct >= 1
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : pct >= 0.8
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'

                    return (
                      <tr key={r.id} className="border-t border-[#E4E1D6]">
                        <td className="py-3 pr-3 min-w-[220px]">
                          <div className="font-medium text-[#111827]">{r.name}</div>
                          <div className="text-xs text-[#6B7280]">Mês: {monthLabel}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`text-[11px] rounded-full border px-2 py-0.5 ${
                              r.type === 'fixo'
                                ? 'border-[#C2A14D]/40 bg-[#F5F2EB] text-[#5A4A1A]'
                                : 'border-[#0EA5E9]/30 bg-[#E6F6FE] text-[#0B5E86]'
                            }`}
                          >
                            {r.type}
                          </span>
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">{fmt.format(r.spent)}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">{r.limit > 0 ? fmt.format(r.limit) : '—'}</td>
                        <td className="py-3 pr-3">
                          <span className={`text-[11px] rounded-full border px-2 py-0.5 ${pill}`}>
                            {pct === null ? 'sem limite' : `${Math.round(pct * 100)}%`}
                          </span>
                        </td>
                        <td className="py-3 pr-0 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="text-xs rounded-lg border border-[#D6D3C8] bg-white px-2 py-1 text-[#111827] hover:bg-[#F5F2EB]"
                              onClick={() => navigate('/budgets')}
                              disabled={loading}
                            >
                              Orçamento
                            </button>
                            <button
                              className="text-xs rounded-lg border border-[#D6D3C8] bg-white px-2 py-1 text-[#111827] hover:bg-[#F5F2EB]"
                              onClick={() => removeCategory(r.id)}
                              disabled={loading}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {topSpending.length > 0 ? (
            <div className="mt-5 rounded-xl border border-[#E4E1D6] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#111827]">Top gastos do mês</div>
                  <div className="mt-1 text-xs text-[#6B7280]">Priorize ajustes nestas categorias.</div>
                </div>
                <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
                  Top {topSpending.length}
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {topSpending.map((r) => {
                  const pct = r.limit > 0 ? r.spent / r.limit : null
                  const bar =
                    pct === null
                      ? '#C2A14D'
                      : pct >= 1
                        ? '#EF4444'
                        : pct >= 0.8
                          ? '#F59E0B'
                          : '#10B981'
                  const w = pct === null ? 100 : Math.max(3, Math.min(100, Math.round(pct * 100)))

                  return (
                    <li key={r.id} className="rounded-xl border border-[#E4E1D6] bg-[#FBFAF7] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#111827] truncate">{r.name}</div>
                          <div className="text-xs text-[#6B7280]">
                            {fmt.format(r.spent)}{r.limit > 0 ? ` / ${fmt.format(r.limit)}` : ''}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-[#111827]">{pct === null ? '—' : `${Math.round(pct * 100)}%`}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#F5F2EB] overflow-hidden border border-[#E4E1D6]">
                        <div className="h-full" style={{ width: `${w}%`, background: bar }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </section>
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
      <div className="mt-3 text-xs text-[#6B7280]">Ciclo mensal</div>
    </div>
  )
}

