import { useEffect, useState } from 'react'
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

  useEffect(() => {
    async function load() {
      const uid = await getUserId()
      if (!uid) return
      const { data: s } = await supabase.from('user_settings').select('*').eq('user_id', uid).maybeSingle()
      const { data: r } = await supabase.from('emergency_reserve').select('*').eq('user_id', uid).maybeSingle()
      setSettings(s || { user_id: uid, pay_percent: 0.1, emergency_months: 6 })
      setReserve(r || { user_id: uid, target_months: 6, target_amount: null, current_amount: 0 })
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      if (settings) {
        await supabase.from('user_settings').upsert(settings, { onConflict: 'user_id' })
      }
      if (reserve) {
        await supabase.from('emergency_reserve').upsert(reserve, { onConflict: 'user_id' })
      }
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Pague-se Primeiro</div>
        <label className="block text-sm mb-1">Percentual automático</label>
        <input
          type="number"
          step="0.01"
          className="border rounded px-3 py-2 w-full"
          value={settings?.pay_percent ?? 0}
          onChange={(e) => setSettings(s => s ? { ...s, pay_percent: Number(e.target.value) } : s)}
        />
        <label className="block text-sm mt-3 mb-1">Meses de reserva mínima</label>
        <input
          type="number"
          className="border rounded px-3 py-2 w-full"
          value={settings?.emergency_months ?? 6}
          onChange={(e) => setSettings(s => s ? { ...s, emergency_months: Number(e.target.value) } : s)}
        />
        <div className="text-xs text-slate-500 mt-2">Este dinheiro não está disponível para gastos</div>
      </div>

      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Reserva de Emergência</div>
        <label className="block text-sm mb-1">Meses alvo</label>
        <input
          type="number"
          className="border rounded px-3 py-2 w-full"
          value={reserve?.target_months ?? 6}
          onChange={(e) => setReserve(r => r ? { ...r, target_months: Number(e.target.value) } : r)}
        />
        <label className="block text-sm mt-3 mb-1">Valor alvo (opcional)</label>
        <input
          type="number"
          step="0.01"
          className="border rounded px-3 py-2 w-full"
          value={reserve?.target_amount ?? ''}
          onChange={(e) => setReserve(r => r ? { ...r, target_amount: e.target.value === '' ? null : Number(e.target.value) } : r)}
        />
        <div className="text-sm mt-2">Saldo atual: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reserve?.current_amount || 0)}</div>
      </div>

      <div className="md:col-span-2">
        {error ? <div className="text-red-600 text-sm mb-2">{error}</div> : null}
        <button className="bg-slate-900 text-white rounded px-4 py-2" onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )
}

