import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Investment = {
  id: number
  type: 'poupanca' | 'renda_fixa' | 'renda_variavel'
  amount: number
  expected_rate: number | null
  created_at: string
}

export default function Investments() {
  const [items, setItems] = useState<Investment[]>([])
  const [type, setType] = useState<Investment['type']>('poupanca')
  const [amount, setAmount] = useState<number>(0)
  const [rate, setRate] = useState<number>(0.08)
  const [monthsRange, setMonthsRange] = useState<12 | 24 | 36>(24)
  const [filterType, setFilterType] = useState<'all' | Investment['type']>('all')
  const [sort, setSort] = useState<'created_desc' | 'amount_desc' | 'rate_desc'>('created_desc')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const loadSeq = useRef(0)

  const fmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  const typeLabel = useCallback((t: Investment['type']) => {
    if (t === 'poupanca') return 'Poupança'
    if (t === 'renda_fixa') return 'Renda fixa'
    return 'Renda variável'
  }, [])

  const typePillClass = useCallback((t: Investment['type']) => {
    return t === 'renda_variavel'
      ? 'border-[#EF4444]/30 bg-red-50 text-red-700'
      : t === 'renda_fixa'
        ? 'border-[#0EA5E9]/30 bg-[#E6F6FE] text-[#0B5E86]'
        : 'border-[#C2A14D]/40 bg-[#F5F2EB] text-[#5A4A1A]'
  }, [])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setError(null)
    setNotice(null)
    setLoading(true)

    try {
      const uid = await getUserId()
      if (!uid) return
      if (seq !== loadSeq.current) return

      const { data, error } = await supabase
        .from('investments')
        .select('id,type,amount,expected_rate,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      if (seq !== loadSeq.current) return
      setItems(
        (data || []).map((r: any) => ({
          id: Number(r.id),
          type: r.type === 'renda_fixa' ? 'renda_fixa' : r.type === 'renda_variavel' ? 'renda_variavel' : 'poupanca',
          amount: Number(r.amount ?? 0),
          expected_rate: r.expected_rate === null || r.expected_rate === undefined ? null : Number(r.expected_rate),
          created_at: String(r.created_at ?? ''),
        }))
      )
    } catch (e: any) {
      if (seq !== loadSeq.current) return
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao carregar investimentos.')
    } finally {
      if (seq !== loadSeq.current) return
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('investments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, () => load())
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

  async function addInvestment(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const uid = await getUserId()
    if (!uid) return

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }

    if (!Number.isFinite(rate) || rate < 0 || rate > 2) {
      setError('Informe uma taxa anual válida (ex.: 0.08 para 8%).')
      return
    }

    const { error } = await supabase.from('investments').insert({ user_id: uid, type, amount, expected_rate: rate })
    if (error) {
      setError(error.message)
      return
    }

    setAmount(0)
    setRate(0.08)
    setNotice('Investimento adicionado.')
    await load()
  }

  async function removeInvestment(id: number) {
    setError(null)
    setNotice(null)
    const uid = await getUserId()
    if (!uid) return
    if (!window.confirm('Excluir este investimento?')) return
    const { error } = await supabase.from('investments').delete().match({ id, user_id: uid })
    if (error) {
      setError(error.message)
      return
    }
    setNotice('Investimento excluído.')
    await load()
  }

  const totals = useMemo(() => {
    const totalAmount = items.reduce((acc, i) => acc + Math.max(0, Number(i.amount ?? 0)), 0)
    const weightedRateSum = items.reduce((acc, i) => acc + Math.max(0, Number(i.amount ?? 0)) * Math.max(0, Number(i.expected_rate ?? 0)), 0)
    const avgRate = totalAmount > 0 ? weightedRateSum / totalAmount : 0

    const byType: Record<Investment['type'], number> = { poupanca: 0, renda_fixa: 0, renda_variavel: 0 }
    for (const i of items) {
      const k = i.type
      byType[k] = (byType[k] ?? 0) + Math.max(0, Number(i.amount ?? 0))
    }

    const riskShare = totalAmount > 0 ? (byType.renda_variavel ?? 0) / totalAmount : 0
    return { totalAmount, avgRate, byType, riskShare }
  }, [items])

  const projectedPortfolio = useCallback(
    (months: number, adjustAnnualRate: number) => {
      let total = 0
      for (const inv of items) {
        const annual = Math.max(0, Math.min(2, Number(inv.expected_rate ?? 0) + adjustAnnualRate))
        const r = annual / 12
        total += Math.max(0, Number(inv.amount ?? 0)) * Math.pow(1 + r, months)
      }
      return total
    },
    [items]
  )

  const projection12Base = useMemo(() => projectedPortfolio(12, 0), [projectedPortfolio])
  const projection12Conservative = useMemo(() => projectedPortfolio(12, -0.02), [projectedPortfolio])
  const projection12Optimistic = useMemo(() => projectedPortfolio(12, 0.02), [projectedPortfolio])

  const filteredSorted = useMemo(() => {
    const base = filterType === 'all' ? items : items.filter((i) => i.type === filterType)
    const sorted =
      sort === 'amount_desc'
        ? [...base].sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))
        : sort === 'rate_desc'
          ? [...base].sort((a, b) => Number(b.expected_rate ?? 0) - Number(a.expected_rate ?? 0))
          : [...base].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    return sorted
  }, [filterType, items, sort])

  const simulation = useMemo(() => {
    const spread = 0.02
    const data: Array<{ month: number; base: number; conservative: number; optimistic: number }> = []
    for (let m = 0; m <= monthsRange; m++) {
      data.push({
        month: m,
        base: projectedPortfolio(m, 0),
        conservative: projectedPortfolio(m, -spread),
        optimistic: projectedPortfolio(m, spread),
      })
    }
    return data
  }, [monthsRange, projectedPortfolio])

  const nextInvestmentPreview = useMemo(() => {
    const ann = Math.max(0, Math.min(2, Number(rate ?? 0)))
    const r = ann / 12
    const a = Math.max(0, Number(amount ?? 0))
    return {
      projected12: a * Math.pow(1 + r, 12),
      ratePct: ann * 100,
    }
  }, [amount, rate])

  const initialLoading = loading && items.length === 0 && !error

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
                  <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">Investimentos</div>
                  <div className="mt-1 text-xs text-[#6B7280]">Simule crescimento e acompanhe composição e risco.</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill variant="gold">Patrimônio: {fmt.format(totals.totalAmount)}</Pill>
                <Pill variant="sky">Taxa média: {(totals.avgRate * 100).toFixed(2)}%</Pill>
                <Pill>Projeção 12m: {fmt.format(projection12Base)}</Pill>
                <Pill>Itens: {items.length}</Pill>
              </div>
            </div>

            <div className="flex gap-2">
              <select
                className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.10)]"
                value={monthsRange}
                onChange={(e) => setMonthsRange(Number(e.target.value) as any)}
                disabled={loading}
              >
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
                <option value={36}>36 meses</option>
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

      {notice ? (
        <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-4 text-sm text-[#166534] shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <WideKpi title="Poupança" value={fmt.format(totals.byType.poupanca)} subtitle="Conservador" tone="neutral" />
        <WideKpi title="Renda fixa" value={fmt.format(totals.byType.renda_fixa)} subtitle="Previsibilidade" tone="ok" />
        <WideKpi title="Renda variável" value={fmt.format(totals.byType.renda_variavel)} subtitle="Volatilidade" tone={totals.riskShare >= 0.4 ? 'warn' : 'neutral'} />
        <WideKpi title="Risco" value={`${Math.round(totals.riskShare * 100)}%`} subtitle="Parcela em variável" tone={totals.riskShare >= 0.5 ? 'bad' : totals.riskShare >= 0.35 ? 'warn' : 'neutral'} />
        <WideKpi title="Itens" value={String(items.length)} subtitle="Posições registradas" tone="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#111827]">Novo investimento</div>
              <div className="mt-1 text-xs text-[#6B7280]">Cadastre valores e uma taxa anual esperada.</div>
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">Cadastro</span>
          </div>

          <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

          <form onSubmit={addInvestment} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Tipo</label>
              <select
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                disabled={loading}
              >
                <option value="poupanca">Poupança</option>
                <option value="renda_fixa">Renda fixa</option>
                <option value="renda_variavel">Renda variável</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Valor</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  type="number"
                  step="0.01"
                  placeholder="Ex.: 1500"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Taxa anual</label>
                <input
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  type="number"
                  step="0.001"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#E4E1D6] bg-white p-3">
              <div className="text-xs text-[#6B7280]">Prévia</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-[#111827] truncate">{typeLabel(type)}</div>
                  <div className="text-xs text-[#6B7280]">Taxa: {nextInvestmentPreview.ratePct.toFixed(2)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[#111827]">{fmt.format(Math.max(0, amount))}</div>
                  <div className="text-xs text-[#6B7280]">12m: {fmt.format(nextInvestmentPreview.projected12)}</div>
                </div>
              </div>
            </div>

            <button className="w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm text-white shadow-[0_14px_40px_rgba(11,19,36,0.20)] hover:bg-black" disabled={loading}>
              Adicionar
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)] lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-[#111827]">Simulação</div>
              <div className="mt-1 text-xs text-[#6B7280]">Cenários com variação de ±2 p.p. na taxa anual.</div>
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
              12m: {fmt.format(projection12Conservative)} · {fmt.format(projection12Base)} · {fmt.format(projection12Optimistic)}
            </span>
          </div>

          <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

          {items.length === 0 ? (
            <div className="mt-4 text-sm text-[#6B7280]">Sem investimentos ainda. Cadastre uma posição para visualizar cenários.</div>
          ) : (
            <div className="mt-4 h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simulation}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => fmt.format(v as number)} />
                  <Tooltip formatter={(v: any) => fmt.format(Number(v ?? 0))} />
                  <Legend />
                  <Line type="monotone" dataKey="conservative" name="Conservador" stroke="#F59E0B" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="base" name="Base" stroke="#0EA5E9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="optimistic" name="Otimista" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] shadow-[0_10px_30px_rgba(11,19,36,0.10)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-[#111827]">Detalhamento</div>
            <div className="mt-1 text-xs text-[#6B7280]">Filtre e ordene para revisar concentração e taxas.</div>
          </div>
          <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
            {filteredSorted.length} item(ns)
          </span>
        </div>

        <div className="mt-3 h-[2px] w-16 rounded-full bg-[#C2A14D]" />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            disabled={loading}
          >
            <option value="all">Todos os tipos</option>
            <option value="poupanca">Poupança</option>
            <option value="renda_fixa">Renda fixa</option>
            <option value="renda_variavel">Renda variável</option>
          </select>
          <select
            className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            disabled={loading}
          >
            <option value="created_desc">Ordenar: recente</option>
            <option value="amount_desc">Ordenar: valor</option>
            <option value="rate_desc">Ordenar: taxa</option>
          </select>
          {filterType !== 'all' || sort !== 'created_desc' ? (
            <button
              className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm hover:bg-[#F5F2EB]"
              onClick={() => {
                setFilterType('all')
                setSort('created_desc')
              }}
              disabled={loading}
            >
              Limpar
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="mt-4 text-sm text-[#6B7280]">Nenhum investimento cadastrado.</div>
        ) : filteredSorted.length === 0 ? (
          <div className="mt-4 text-sm text-[#6B7280]">Nenhum investimento encontrado com os filtros atuais.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#6B7280]">
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Taxa</th>
                  <th className="py-2 pr-3">Projeção 12m</th>
                  <th className="py-2 pr-3">Criado</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((inv) => {
                  const ann = Math.max(0, Math.min(2, Number(inv.expected_rate ?? 0)))
                  const r = ann / 12
                  const projected12 = Math.max(0, Number(inv.amount ?? 0)) * Math.pow(1 + r, 12)
                  const dt = inv.created_at ? new Date(inv.created_at) : null
                  const createdLabel = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString('pt-BR') : String(inv.created_at ?? '')

                  return (
                    <tr key={inv.id} className="border-t border-[#E4E1D6]">
                      <td className="py-3 pr-3 min-w-[180px]">
                        <span className={`text-[11px] rounded-full border px-2 py-0.5 ${typePillClass(inv.type)}`}>
                          {typeLabel(inv.type)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">{fmt.format(Number(inv.amount ?? 0))}</td>
                      <td className="py-3 pr-3 whitespace-nowrap">{(ann * 100).toFixed(2)}%</td>
                      <td className="py-3 pr-3 whitespace-nowrap">{fmt.format(projected12)}</td>
                      <td className="py-3 pr-3 whitespace-nowrap">{createdLabel}</td>
                      <td className="py-3 pr-0 text-right whitespace-nowrap">
                        <button
                          className="text-xs rounded-lg border border-[#D6D3C8] bg-white px-2 py-1 text-[#111827] hover:bg-[#F5F2EB]"
                          onClick={() => removeInvestment(inv.id)}
                          disabled={loading}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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

