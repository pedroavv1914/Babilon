import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type UserSettings = { user_id: string; pay_percent: number; emergency_months: number }
type Reserve = { user_id: string; target_months: number; target_amount: number | null; current_amount: number }

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [reserve, setReserve] = useState<Reserve | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exampleIncome, setExampleIncome] = useState<number>(5000)
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

      const [{ data: s, error: sErr }, { data: r, error: rErr }] = await Promise.all([
        supabase.from('user_settings').select('user_id,pay_percent,emergency_months').eq('user_id', uid).maybeSingle(),
        supabase.from('emergency_reserve').select('user_id,target_months,target_amount,current_amount').eq('user_id', uid).maybeSingle(),
      ])
      if (sErr) throw sErr
      if (rErr) throw rErr
      if (seq !== loadSeq.current) return

      setSettings(
        s
          ? {
              user_id: String((s as any).user_id ?? uid),
              pay_percent: Number((s as any).pay_percent ?? 0.1),
              emergency_months: Number((s as any).emergency_months ?? 6),
            }
          : { user_id: uid, pay_percent: 0.1, emergency_months: 6 }
      )
      setReserve(
        r
          ? {
              user_id: String((r as any).user_id ?? uid),
              target_months: Number((r as any).target_months ?? 6),
              target_amount:
                (r as any).target_amount === null || (r as any).target_amount === undefined ? null : Number((r as any).target_amount),
              current_amount: Number((r as any).current_amount ?? 0),
            }
          : { user_id: uid, target_months: 6, target_amount: null, current_amount: 0 }
      )
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

  async function save() {
    setError(null)
    setNotice(null)
    if (!settings || !reserve) return

    const pp = Number(settings.pay_percent ?? 0)
    if (!Number.isFinite(pp) || pp < 0 || pp > 0.95) {
      setError('Informe um percentual válido (ex.: 0.10 para 10%).')
      return
    }

    const em = Number(settings.emergency_months ?? 0)
    if (!Number.isFinite(em) || em < 1 || em > 36) {
      setError('Informe a reserva mínima (1 a 36 meses).')
      return
    }

    const tm = Number(reserve.target_months ?? 0)
    if (!Number.isFinite(tm) || tm < 1 || tm > 36) {
      setError('Informe a meta de meses (1 a 36).')
      return
    }

    const ta = reserve.target_amount === null ? null : Number(reserve.target_amount)
    if (ta !== null && (!Number.isFinite(ta) || ta <= 0)) {
      setError('Se definir um valor alvo, ele precisa ser maior que zero.')
      return
    }

    setSaving(true)
    try {
      const uid = await getUserId()
      if (!uid) return

      const { error: sErr } = await supabase.from('user_settings').upsert(
        { user_id: uid, pay_percent: pp, emergency_months: em },
        { onConflict: 'user_id' }
      )
      if (sErr) throw sErr

      const { error: rErr } = await supabase.from('emergency_reserve').upsert(
        { user_id: uid, target_months: tm, target_amount: ta, current_amount: Math.max(0, Number(reserve.current_amount ?? 0)) },
        { onConflict: 'user_id' }
      )
      if (rErr) throw rErr

      setNotice('Planejamento salvo.')
      await load()
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Erro ao salvar planejamento.')
    } finally {
      setSaving(false)
    }
  }

  const payPercent = Math.max(0, Math.min(0.95, Number(settings?.pay_percent ?? 0.1)))
  const emergencyMonths = Math.max(1, Math.min(36, Number(settings?.emergency_months ?? 6)))
  const reserveCurrent = Math.max(0, Number(reserve?.current_amount ?? 0))
  const reserveTarget =
    reserve?.target_amount === null || reserve?.target_amount === undefined ? null : Math.max(0, Number(reserve.target_amount))
  const reservePct = reserveTarget && reserveTarget > 0 ? Math.min(1, reserveCurrent / reserveTarget) : null
  const reserveMissing = reserveTarget && reserveTarget > 0 ? Math.max(0, reserveTarget - reserveCurrent) : null

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
                <Pill variant="sky">Reserva mínima: {emergencyMonths} mês(es) de custo de vida</Pill>
                <Pill>Saldo reserva: {fmt.format(reserveCurrent)}</Pill>
                <Pill>Meta: {reserveTarget ? fmt.format(reserveTarget) : '—'}</Pill>
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
        <WideKpi title="Reserva mínima" value={`${emergencyMonths}m`} subtitle="Meses de custo de vida cobertos" tone={emergencyMonths >= 6 ? 'ok' : emergencyMonths >= 3 ? 'warn' : 'bad'} />
        <WideKpi title="Saldo da reserva" value={fmt.format(reserveCurrent)} subtitle="Patrimônio de proteção" tone={reserveCurrent > 0 ? 'ok' : 'neutral'} />
        <WideKpi title="Meta" value={reserveTarget ? fmt.format(reserveTarget) : '—'} subtitle={reserveTarget ? 'Valor alvo configurado' : 'Defina um alvo opcional'} tone={reserveTarget ? 'neutral' : 'warn'} />
        <WideKpi title="Progresso" value={reservePct === null ? '—' : `${Math.round(reservePct * 100)}%`} subtitle="Da meta de reserva" tone={reservePct === null ? 'neutral' : reservePct >= 0.8 ? 'ok' : reservePct >= 0.5 ? 'warn' : 'bad'} />
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
              <label className="block text-xs text-[#6B7280] mb-1">Reserva mínima (meses de custo de vida)</label>
              <input
                type="number"
                min={1}
                max={36}
                step={1}
                inputMode="numeric"
                className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                value={settings?.emergency_months ?? 6}
                onChange={(e) => setSettings((s) => (s ? { ...s, emergency_months: e.target.value === '' ? 0 : Number(e.target.value) } : s))}
                disabled={saving || loading}
              />
              <div className="mt-2 text-[11px] text-[#6B7280]">Ex.: 6 = ter guardado o suficiente para 6 meses dos seus gastos essenciais.</div>
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

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Meses alvo</label>
                <input
                  type="number"
                  min={1}
                  max={36}
                  step={1}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={reserve?.target_months ?? 6}
                  onChange={(e) => setReserve((r) => (r ? { ...r, target_months: e.target.value === '' ? 0 : Number(e.target.value) } : r))}
                  disabled={saving || loading}
                />
              </div>

              <div>
                <label className="block text-xs text-[#6B7280] mb-1">Valor alvo (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={reserve?.target_amount ?? ''}
                  onChange={(e) =>
                    setReserve((r) =>
                      r ? { ...r, target_amount: e.target.value === '' ? null : Number(e.target.value) } : r
                    )
                  }
                  disabled={saving || loading}
                />
                <div className="mt-2 text-[11px] text-[#6B7280]">Se não definir, o app mostra apenas o saldo atual.</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E4E1D6] bg-white p-4 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[#6B7280]">Saldo atual</div>
                <Pill variant="sky">{fmt.format(reserveCurrent)}</Pill>
              </div>

              {reserveTarget ? (
                <>
                  <div className="text-sm mt-3 flex items-center justify-between">
                    <span className="text-[#6B7280]">Meta</span>
                    <span className="font-medium text-[#111827]">{fmt.format(reserveTarget)}</span>
                  </div>

                  {reserveMissing !== null ? (
                    <div className="text-sm mt-2 flex items-center justify-between">
                      <span className="text-[#6B7280]">Falta</span>
                      <span className="font-medium text-[#111827]">{fmt.format(reserveMissing)}</span>
                    </div>
                  ) : null}

                  <div className="mt-3 h-2 w-full rounded-full bg-[#E7E1D4] overflow-hidden">
                    <div className="h-full bg-[#0EA5E9]" style={{ width: `${(reservePct ?? 0) * 100}%` }} />
                  </div>

                  <div className="mt-2 text-xs text-[#6B7280]">{Math.round((reservePct ?? 0) * 100)}% da meta</div>
                </>
              ) : (
                <div className="text-xs text-[#6B7280] mt-3">
                  Defina um valor alvo para acompanhar o progresso (como no painel da Visão Geral).
                </div>
              )}

              <div className="mt-4 h-px bg-[#E4E1D6]" />
              <div className="mt-3 text-[11px] text-[#6B7280]">Meta em meses: {Math.max(1, Number(reserve?.target_months ?? 6))}</div>
            </div>
          </div>
        </section>
      </div>

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

