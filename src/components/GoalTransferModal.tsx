import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

interface Goal {
  id: number
  name: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  goals: Goal[]
  goalBalances: Record<number, number>
  reserveBalance: number
  userId: string
}

export default function GoalTransferModal({ isOpen, onClose, onSuccess, goals, goalBalances, reserveBalance, userId }: Props) {
  const [source, setSource] = useState<string>('')
  const [dest, setDest] = useState<string>('')
  const [amountStr, setAmountStr] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  // Helper to get balance of selected source
  const getSourceBalance = () => {
    if (source === 'reserve') return reserveBalance
    const gid = Number(source)
    if (!Number.isNaN(gid) && gid > 0) return goalBalances[gid] ?? 0
    return 0
  }

  // Helper to get balance of selected destination (for preview)
  const getDestBalance = () => {
    if (dest === 'reserve') return reserveBalance
    const gid = Number(dest)
    if (!Number.isNaN(gid) && gid > 0) return goalBalances[gid] ?? 0
    return 0
  }

  const handleTransfer = async () => {
    setError(null)
    setLoading(true)

    try {
      if (!source) throw new Error('Selecione a origem.')
      if (!dest) throw new Error('Selecione o destino.')
      if (source === dest) throw new Error('Origem e destino não podem ser iguais.')

      const val = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'))
      if (!Number.isFinite(val) || val <= 0) throw new Error('Informe um valor válido.')

      const currentBalance = getSourceBalance()
      if (val > currentBalance) throw new Error('Saldo insuficiente na origem.')

      // Prepare RPC params
      const params = {
        p_user_id: userId,
        p_source_type: source === 'reserve' ? 'reserve' : 'goal',
        p_source_id: source === 'reserve' ? null : Number(source),
        p_dest_type: dest === 'reserve' ? 'reserve' : 'goal',
        p_dest_id: dest === 'reserve' ? null : Number(dest),
        p_amount: val,
        p_occurred_at: new Date().toISOString()
      }

      const { error: rpcError } = await supabase.rpc('transfer_values', params)
      if (rpcError) throw rpcError

      setAmountStr('')
      setSource('')
      setDest('')
      onSuccess()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Erro ao realizar transferência.')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const val = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'))
  const transferAmount = Number.isFinite(val) ? val : 0
  const sourceBalance = getSourceBalance()
  const destBalance = getDestBalance()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-[#111827] px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Realocar Recursos</h3>
          <p className="text-xs text-gray-400">Mova valores entre suas metas e reserva</p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Origem */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">De (Origem)</label>
              <select
                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm outline-none focus:border-[#C2A14D] focus:ring-1 focus:ring-[#C2A14D]"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="reserve">Reserva de Emergência</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id} disabled={String(g.id) === dest}>
                    {g.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-gray-400">
                Disponível: <span className="font-medium text-gray-700">{formatCurrency(sourceBalance)}</span>
              </div>
            </div>

            {/* Destino */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Para (Destino)</label>
              <select
                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm outline-none focus:border-[#C2A14D] focus:ring-1 focus:ring-[#C2A14D]"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
              >
                <option value="">Selecione...</option>
                <option value="reserve" disabled={source === 'reserve'}>Reserva de Emergência</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id} disabled={String(g.id) === source}>
                    {g.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-gray-400">
                Atual: <span className="font-medium text-gray-700">{formatCurrency(destBalance)}</span>
              </div>
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Valor da Transferência</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">R$</span>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 p-2 pl-9 text-lg font-medium outline-none focus:border-[#C2A14D] focus:ring-1 focus:ring-[#C2A14D]"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9,.]/g, '')
                  setAmountStr(v)
                }}
              />
            </div>
          </div>

          {/* Preview */}
          {transferAmount > 0 && source && dest && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Saldo Origem Após:</span>
                <span className={`font-medium ${sourceBalance - transferAmount < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                  {formatCurrency(sourceBalance - transferAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Saldo Destino Após:</span>
                <span className="font-medium text-[#059669]">
                  {formatCurrency(destBalance + transferAmount)}
                </span>
              </div>
            </div>
          ) }

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleTransfer}
              disabled={loading || !source || !dest || transferAmount <= 0 || transferAmount > sourceBalance}
              className="flex-1 rounded-lg bg-[#C2A14D] py-2.5 text-sm font-medium text-white hover:bg-[#B08D3B] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processando...' : 'Confirmar Transferência'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
