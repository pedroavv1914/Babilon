import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type Income = { id: number; amount: number; month: number; year: number; rule_percent: number | null; created_at: string }
type UserSettings = { pay_percent: number }
type Allocation = { income_id: number; amount: number }

export default function Incomes() {
  const now = new Date()
  const [uid, setUid] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [items, setItems] = useState<Income[]>([])
  const [recent, setRecent] = useState<Income[]>([])
  const [allocMap, setAllocMap] = useState<Record<number, number>>({})

  const [amount, setAmount] = useState<number>(0)
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth() + 1)
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear())
  const [incomeDate, setIncomeDate] = useState<string>(() => {
    const pad = (v: number) => String(v).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })
  const [percentMode, setPercentMode] = useState<'default' | 'custom'>('default')
  const [rulePercent, setRulePercent] = useState<number | ''>('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const defaultPercent = typeof settings?.pay_percent === 'number' ? settings.pay_percent : 0.1
  const effectivePercent = percentMode === 'custom' && rulePercent !== '' ? Number(rulePercent) : defaultPercent
  const previewSavings = Math.max(0, amount) * Math.max(0, effectivePercent)
  const previewAvailable = Math.max(0, amount) - previewSavings

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])
  const yearOptions = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], [now])

  const rows = useMemo(() => {
    return items.map((r) => {
      const usedPercent = typeof r.rule_percent === 'number' ? r.rule_percent : defaultPercent
      const alloc = typeof allocMap[r.id] === 'number' ? allocMap[r.id] : r.amount * usedPercent
      const available = r.amount - alloc
      return {
        ...r,
        used_percent: usedPercent,
        savings_amount: alloc,
        available_amount: available,
        mode: typeof r.rule_percent === 'number' ? 'custom' : 'default',
      }
    })
  }, [items, allocMap, defaultPercent])

  const totals = useMemo(() => {
    const incomeTotal = rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0)
    const savingsTotal = rows.reduce((acc, r) => acc + Number(r.savings_amount ?? 0), 0)
    const availableTotal = incomeTotal - savingsTotal
    const savingsRate = incomeTotal > 0 ? savingsTotal / incomeTotal : 0
    return { incomeTotal, savingsTotal, availableTotal, savingsRate }
  }, [rows])

  async function load() {
    if (!uid) return
    setError(null)
    setLoading(true)
    try {
      const [{ data: s, error: sErr }, { data: monthData, error: mErr }, { data: recData, error: rErr }] = await Promise.all([
        supabase.from('user_settings').select('pay_percent').eq('user_id', uid).maybeSingle(),
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
      if (mErr) throw mErr
      if (rErr) throw rErr

      setSettings(s ? { pay_percent: Number((s as any).pay_percent ?? 0.1) } : { pay_percent: 0.1 })
      const monthItems = (monthData || []) as Income[]
      setItems(monthItems)
      setRecent((recData || []) as Income[])

      const ids = monthItems.map((i) => i.id).filter((v) => typeof v === 'number')
      if (!ids.length) {
        setAllocMap({})
        return
      }

      const { data: al, error: alErr } = await supabase
        .from('savings_allocations')
        .select('income_id,amount')
        .eq('user_id', uid)
        .in('income_id', ids)
      if (alErr) throw alErr

      const map: Record<number, number> = {}
      for (const a of (al || []) as Allocation[]) {
        map[Number(a.income_id)] = Number((a as any).amount ?? 0)
      }
      setAllocMap(map)
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
      .channel('savings_allocations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_allocations' }, () => load())
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
    const dt = new Date(`${incomeDate}T12:00:00`)
    if (Number.isNaN(dt.getTime())) {
      setError('Informe uma data válida')
      return
    }
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
    const { error } = await supabase.from('incomes').insert({
      user_id: uid,
      amount,
      month,
      year,
      rule_percent: percentMode === 'custom' ? Number(rulePercent) : null,
      created_at: dt.toISOString(),
    })
    if (error) setError(error.message)
    setAmount(0)
    setRulePercent('')
    setPercentMode('default')
  }

  if (loading) return <div className="mt-8">Carregando...</div>

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">Rendas</div>
          <div className="mt-1 text-xs text-[#6B7280]">Veja o ciclo do mês e quanto vira “ouro guardado”.</div>
        </div>

        <div className="flex gap-2">
          <select
            className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.08)]"
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
            className="rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm shadow-[0_6px_18px_rgba(11,19,36,0.08)]"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-4 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          <div className="text-sm text-[#6B7280]">Renda do mês</div>
          <div className="mt-1 text-2xl font-semibold text-[#111827]">{fmt(totals.incomeTotal)}</div>
        </div>
        <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-4 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          <div className="text-sm text-[#6B7280]">Ouro guardado</div>
          <div className="mt-1 text-2xl font-semibold text-[#111827]">{fmt(totals.savingsTotal)}</div>
          <div className="mt-1 text-xs text-[#6B7280]">Taxa: {(totals.savingsRate * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-4 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          <div className="text-sm text-[#6B7280]">Disponível para gastar</div>
          <div className="mt-1 text-2xl font-semibold text-[#111827]">{fmt(totals.availableTotal)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-[#111827]">Cadastrar renda</div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">Entrada</span>
          </div>

          <form onSubmit={addIncome} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Data</label>
              <input className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm" type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-[#6B7280] mb-1">Valor</label>
              <input className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm" type="number" step="0.01" placeholder="Ex.: 3500" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs text-[#6B7280] mb-1">Percentual do “pague-se primeiro”</label>
                <span className="text-xs text-[#6B7280]">Padrão: {(defaultPercent * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-1 flex flex-col gap-2">
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
                    className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                    type="number"
                    step="0.01"
                    placeholder="Ex.: 0.10 para 10%"
                    value={rulePercent}
                    onChange={(e) => setRulePercent(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-[#E4E1D6] bg-white p-3">
              <div className="text-xs text-[#6B7280]">Prévia</div>
              <div className="mt-1 text-sm text-[#111827]">
                Você guarda <span className="font-semibold">{fmt(previewSavings)}</span> e fica disponível{' '}
                <span className="font-semibold">{fmt(previewAvailable)}</span>.
              </div>
              <div className="mt-1 text-xs text-[#6B7280]">
                Percentual aplicado: {(effectivePercent * 100).toFixed(1)}% (0.10 = 10%).
              </div>
            </div>

            {error ? <div className="text-red-600 text-sm">{error}</div> : null}
            <button className="rounded-xl bg-[#111827] text-white px-4 py-2 text-sm shadow-[0_10px_30px_rgba(11,19,36,0.15)]">Salvar</button>
          </form>
        </div>

        <div className="rounded-xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 shadow-[0_6px_18px_rgba(11,19,36,0.08)] lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-[#111827]">
              Rendas de {String(filterMonth).padStart(2, '0')}/{filterYear}
            </div>
            <span className="text-xs text-[#6B7280] rounded-full border border-[#D6D3C8] bg-white px-2 py-1">
              {rows.length} item(ns)
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="mt-4 text-sm text-[#6B7280]">Sem rendas registradas neste mês.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#6B7280]">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Valor</th>
                    <th className="py-2 pr-3">%</th>
                    <th className="py-2 pr-3">Ouro</th>
                    <th className="py-2 pr-3">Disponível</th>
                    <th className="py-2 pr-3">Modo</th>
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
                      <td className="py-2 pr-3 text-[#111827]">{fmt(r.available_amount)}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 border ${
                            r.mode === 'custom' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-[#F5F2EB] text-[#374151] border-[#E4E1D6]'
                          }`}
                        >
                          {r.mode === 'custom' ? 'personalizado' : 'padrão'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <div className="font-semibold text-[#111827]">Últimas rendas</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recent.map((r) => (
                <div key={r.id} className="rounded-xl border border-[#E4E1D6] bg-white px-3 py-2 flex items-center justify-between gap-3">
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
                  <span className="text-xs text-[#6B7280]">{typeof r.rule_percent === 'number' ? `${(r.rule_percent * 100).toFixed(0)}%` : `${(defaultPercent * 100).toFixed(0)}%`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
