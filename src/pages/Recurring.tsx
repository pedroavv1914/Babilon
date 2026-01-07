import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type RecurringExpense = {
  id: number
  user_id: string
  name: string
  amount: number
  frequency: 'monthly' | 'weekly' | 'yearly'
  occurrences: number
  category_id: number | null
  is_active: boolean
}

type InstallmentExpense = {
  id: number
  user_id: string
  name: string
  amount: number
  total_installments: number
  start_date: string // YYYY-MM-DD
  category_id: number | null
  paid_installments_offset: number
}

type Category = {
  id: number
  name: string
}

export default function Recurring() {
  const [activeTab, setActiveTab] = useState<'recurring' | 'installments'>('recurring')
  
  const [items, setItems] = useState<RecurringExpense[]>([])
  const [installments, setInstallments] = useState<InstallmentExpense[]>([])
  const [installmentCounts, setInstallmentCounts] = useState<Record<number, number>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ id: number; type: 'recurring' | 'installment' } | null>(null)

  // Recurring form
  const [recName, setRecName] = useState('')
  const [recAmount, setRecAmount] = useState('')
  const [recFrequency, setRecFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly')
  const [recOccurrences, setRecOccurrences] = useState('1')
  const [recCategoryId, setRecCategoryId] = useState<string>('')

  // Installment form
  const [instName, setInstName] = useState('')
  const [instAmount, setInstAmount] = useState('')
  const [instTotal, setInstTotal] = useState('')
  const [instStartDate, setInstStartDate] = useState(new Date().toISOString().split('T')[0])
  const [instCategoryId, setInstCategoryId] = useState<string>('')

  const fmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const uid = await getUserId()
      if (!uid) return

      const [
        { data: recData, error: recErr },
        { data: instData, error: instErr },
        { data: catData, error: catErr },
        { data: txData, error: txErr }
      ] = await Promise.all([
        supabase
          .from('recurring_expenses')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('installment_expenses')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('id,name').eq('user_id', uid).order('name'),
        supabase
          .from('transactions')
          .select('installment_id')
          .eq('user_id', uid)
          .not('installment_id', 'is', null)
      ])

      if (recErr) throw recErr
      if (instErr) throw instErr
      if (catErr) throw catErr
      // txErr might be ignored if column doesn't exist yet, but for now assuming migration applied
      
      const counts: Record<number, number> = {}
      if (txData) {
        for (const t of txData) {
          const iid = t.installment_id
          if (iid) counts[iid] = (counts[iid] || 0) + 1
        }
      }
      setInstallmentCounts(counts)

      setItems(
        (recData || []).map((i: any) => ({
          ...i,
          amount: Number(i.amount),
          occurrences: Number(i.occurrences),
        }))
      )
      setInstallments(
        (instData || []).map((i: any) => ({
          ...i,
          amount: Number(i.amount),
          total_installments: Number(i.total_installments),
          paid_installments_offset: Number(i.paid_installments_offset || 0),
        }))
      )
      setCategories(catData || [])
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(null), 3000)
      return () => clearTimeout(t)
    }
  }, [notice])

  const handleAddRecurring = async () => {
    if (!recName.trim()) {
      setError('Informe o nome da despesa.')
      return
    }
    const amt = Number(recAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Informe um valor válido.')
      return
    }
    const occ = Number(recOccurrences)
    if (!Number.isFinite(occ) || occ < 1) {
      setError('Informe a quantidade de ocorrências.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const uid = await getUserId()
      const { error } = await supabase.from('recurring_expenses').insert({
        user_id: uid,
        name: recName.trim(),
        amount: amt,
        frequency: recFrequency,
        occurrences: occ,
        category_id: recCategoryId ? Number(recCategoryId) : null,
        is_active: true,
      })

      if (error) throw error
      setNotice('Despesa recorrente adicionada.')
      setRecName('')
      setRecAmount('')
      setRecOccurrences('1')
      setRecCategoryId('')
      await load()
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddInstallment = async () => {
    if (!instName.trim()) {
      setError('Informe o nome do parcelamento.')
      return
    }
    const amt = Number(instAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Informe o valor da parcela.')
      return
    }
    const total = Number(instTotal)
    if (!Number.isFinite(total) || total < 1) {
      setError('Informe o total de parcelas.')
      return
    }
    if (!instStartDate) {
      setError('Informe a data de início.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const uid = await getUserId()
      const { error } = await supabase.from('installment_expenses').insert({
        user_id: uid,
        name: instName.trim(),
        amount: amt,
        total_installments: total,
        start_date: instStartDate,
        category_id: instCategoryId ? Number(instCategoryId) : null,
      })

      if (error) throw error
      setNotice('Parcelamento adicionado.')
      setInstName('')
      setInstAmount('')
      setInstTotal('')
      setInstStartDate(new Date().toISOString().split('T')[0])
      setInstCategoryId('')
      await load()
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handlePayRecurring = async (item: RecurringExpense) => {
    setSaving(true)
    setError(null)
    try {
      const uid = await getUserId()
      const { error } = await supabase.from('transactions').insert({
        user_id: uid,
        amount: item.amount,
        kind: 'despesa',
        occurred_at: new Date().toISOString(),
        category_id: item.category_id,
        note: item.name,
      })

      if (error) throw error
      setNotice(`Pagamento de "${item.name}" registrado com sucesso!`)
    } catch (e: any) {
      setError(e.message || 'Erro ao registrar pagamento.')
    } finally {
      setSaving(false)
    }
  }

  const handlePayInstallment = async (item: InstallmentExpense) => {
    setSaving(true)
    setError(null)
    try {
      const uid = await getUserId()
      // Calculate current installment number for note
      const currentCount = (installmentCounts[item.id] || 0) + (item.paid_installments_offset || 0)
      const nextNum = currentCount + 1
      
      if (nextNum > item.total_installments) {
        throw new Error('Todas as parcelas já foram pagas.')
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: uid,
        amount: item.amount,
        kind: 'despesa',
        occurred_at: new Date().toISOString(),
        category_id: item.category_id,
        note: `${item.name} (${nextNum}/${item.total_installments})`,
        installment_id: item.id
      })

      if (error) throw error
      setNotice(`Pagamento da parcela ${nextNum} de "${item.name}" registrado!`)
      await load() // Reload to update counts
    } catch (e: any) {
      setError(e.message || 'Erro ao registrar pagamento.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (id: number, type: 'recurring' | 'installment') => {
    setItemToDelete({ id, type })
    setDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setSaving(true)
    try {
      const table = itemToDelete.type === 'recurring' ? 'recurring_expenses' : 'installment_expenses'
      const { error } = await supabase.from(table).delete().eq('id', itemToDelete.id)
      if (error) throw error
      
      if (itemToDelete.type === 'recurring') {
        setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id))
      } else {
        setInstallments((prev) => prev.filter((i) => i.id !== itemToDelete.id))
      }
      
      setNotice('Removido com sucesso.')
      setDeleteModalOpen(false)
      setItemToDelete(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (item: RecurringExpense) => {
    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({ is_active: !item.is_active })
        .eq('id', item.id)

      if (error) throw error
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i)))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const getInstallmentProgress = (item: InstallmentExpense) => {
    // New logic: based on paid count + offset
    const paidCount = (installmentCounts[item.id] || 0) + (item.paid_installments_offset || 0)
    let current = paidCount
    
    // Status
    let status = 'active'
    if (current === 0) status = 'future'
    if (current >= item.total_installments) status = 'completed'

    return { current, status, isCompleted: current >= item.total_installments }
  }

  const totalMonthlyRecurring = useMemo(() => {
    return items
      .filter((i) => i.is_active)
      .reduce((acc, i) => {
        let multiplier = 1
        if (i.frequency === 'weekly') multiplier = 4 // approx
        if (i.frequency === 'yearly') multiplier = 1 / 12
        return acc + i.amount * i.occurrences * multiplier
      }, 0)
  }, [items])

  const totalMonthlyInstallments = useMemo(() => {
    return installments.reduce((acc, i) => {
      const { status, isCompleted } = getInstallmentProgress(i)
      if (status !== 'future' && !isCompleted) {
        return acc + i.amount
      }
      return acc
    }, 0)
  }, [installments])

  if (loading && items.length === 0 && installments.length === 0) {
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
                  <div className="font-[ui-serif,Georgia,serif] text-2xl tracking-[-0.6px] text-[#111827]">
                    Pagamentos Recorrentes
                  </div>
                  <div className="mt-1 text-xs text-[#6B7280]">
                    Gerencie gastos fixos, assinaturas e parcelamentos.
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#6B7280]">Total Mensal Estimado</div>
              <div className="text-xl font-semibold text-[#111827]">
                {fmt.format(totalMonthlyRecurring + totalMonthlyInstallments)}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                (Fixos: {fmt.format(totalMonthlyRecurring)} + Parcelas: {fmt.format(totalMonthlyInstallments)})
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="mt-6 flex space-x-1 rounded-xl bg-gray-100 p-1 w-fit">
            <button
              onClick={() => setActiveTab('recurring')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'recurring'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Despesas Fixas
            </button>
            <button
              onClick={() => setActiveTab('installments')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'installments'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Parcelamentos
            </button>
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

      {error && (
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 text-sm text-[#991B1B] shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-5 py-4 text-sm text-[#166534] shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
          {notice}
        </div>
      )}

      {/* Content based on tab */}
      {activeTab === 'recurring' ? (
        <div className="space-y-6">
          {/* Add Form Recurring */}
          <div className="rounded-2xl border border-[#E4E1D6] bg-white p-5 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
            <div className="font-semibold text-[#111827] mb-4">Nova Despesa Fixa</div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <label className="block text-xs text-[#6B7280] mb-1">Nome</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  placeholder="Ex: Aluguel"
                  value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-[#6B7280] mb-1">Valor Unitário</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  placeholder="0,00"
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-[#6B7280] mb-1">Frequência</label>
                <select
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={recFrequency}
                  onChange={(e) => setRecFrequency(e.target.value as any)}
                  disabled={saving}
                >
                  <option value="monthly">Mensal</option>
                  <option value="weekly">Semanal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-[#6B7280] mb-1">Vezes</label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={recOccurrences}
                  onChange={(e) => setRecOccurrences(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-[#6B7280] mb-1">Categoria</label>
                <select
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={recCategoryId}
                  onChange={(e) => setRecCategoryId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <button
                  onClick={handleAddRecurring}
                  disabled={saving}
                  className="w-full rounded-xl bg-[#111827] px-3 py-2 text-sm text-white hover:bg-black disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>

          {/* List Recurring */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border ${
                  item.is_active ? 'border-[#E4E1D6] bg-white' : 'border-gray-200 bg-gray-50 opacity-75'
                } p-4 shadow-sm transition-all hover:shadow-md`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-[#111827]">{item.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        item.is_active
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      {item.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                    <button
                      onClick={() => confirmDelete(item.id, 'recurring')}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Remover"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Valor un.:</span>
                    <span className="font-medium">{fmt.format(item.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Frequência:</span>
                    <span>
                      {item.frequency === 'monthly' ? 'Mensal' : item.frequency === 'weekly' ? 'Semanal' : 'Anual'}
                      {item.occurrences > 1 ? ` (${item.occurrences}x)` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-dashed border-gray-200 mt-2">
                    <span className="text-gray-500">Total/mês (est.):</span>
                    <span className="font-semibold text-[#059669]">
                      {fmt.format(
                        item.amount *
                          item.occurrences *
                          (item.frequency === 'weekly' ? 4 : item.frequency === 'yearly' ? 1 / 12 : 1)
                      )}
                    </span>
                  </div>
                </div>
                {item.category_id && (
                  <div className="mt-3 text-xs text-gray-400 bg-gray-50 inline-block px-2 py-1 rounded">
                    {categories.find((c) => c.id === item.category_id)?.name || 'Categoria removida'}
                  </div>
                )}

                <button
                  onClick={() => handlePayRecurring(item)}
                  disabled={saving}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-[#C2A14D] text-[#C2A14D] px-3 py-2 text-sm font-medium hover:bg-[#C2A14D] hover:text-white transition-all disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  Pagar Agora
                </button>
              </div>
            ))}
            {items.length === 0 && !loading && (
              <div className="col-span-full text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-[#D6D3C8]">
                Nenhuma despesa fixa cadastrada.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Add Form Installment */}
          <div className="rounded-2xl border border-[#E4E1D6] bg-white p-5 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
            <div className="font-semibold text-[#111827] mb-4">Novo Parcelamento</div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <label className="block text-xs text-[#6B7280] mb-1">Nome</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  placeholder="Ex: Compra TV"
                  value={instName}
                  onChange={(e) => setInstName(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-[#6B7280] mb-1">Valor Parcela</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  placeholder="0,00"
                  value={instAmount}
                  onChange={(e) => setInstAmount(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-[#6B7280] mb-1">Qtd. Parcelas</label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  placeholder="12"
                  value={instTotal}
                  onChange={(e) => setInstTotal(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-[#6B7280] mb-1">Início</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                  value={instStartDate}
                  onChange={(e) => setInstStartDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs text-[#6B7280] mb-1">Categoria</label>
                <div className="flex gap-2">
                  <select
                    className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
                    value={instCategoryId}
                    onChange={(e) => setInstCategoryId(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddInstallment}
                    disabled={saving}
                    className="rounded-xl bg-[#111827] px-4 py-2 text-sm text-white hover:bg-black disabled:opacity-60 transition-colors"
                  >
                    {saving ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* List Installments */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {installments.map((item) => {
              const { current, status, isCompleted } = getInstallmentProgress(item)
              
              // Progress percent
              const progress = Math.min(100, Math.max(0, (current / item.total_installments) * 100))
              
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border ${
                    isCompleted ? 'border-gray-200 bg-gray-50 opacity-75' : 'border-[#E4E1D6] bg-white'
                  } p-4 shadow-sm transition-all hover:shadow-md`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-medium text-[#111827]">{item.name}</h3>
                    <div className="flex gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        status === 'active' 
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : status === 'future'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {status === 'active' ? 'Em andamento' : status === 'future' ? 'Agendado' : 'Concluído'}
                      </span>
                      <button
                        onClick={() => confirmDelete(item.id, 'installment')}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Remover"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="text-2xl font-semibold text-[#111827]">{fmt.format(item.amount)}</div>
                      <div className="text-sm text-gray-500 mb-1">/mês</div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Progresso</span>
                        <span>{current} / {item.total_installments}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-[#C2A14D]'}`} 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-dashed border-gray-200">
                      <span>Total: {fmt.format(item.amount * item.total_installments)}</span>
                      <span>Início: {new Date(item.start_date).toLocaleDateString('pt-BR')}</span>
                    </div>

                    {!isCompleted && (
                      <button
                        onClick={() => handlePayInstallment(item)}
                        disabled={saving}
                        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-[#C2A14D] text-[#C2A14D] px-3 py-2 text-sm font-medium hover:bg-[#C2A14D] hover:text-white transition-all disabled:opacity-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        Pagar Parcela
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {installments.length === 0 && !loading && (
              <div className="col-span-full text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-[#D6D3C8]">
                Nenhum parcelamento cadastrado.
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#111827]">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              Tem certeza que deseja remover este item? Essa ação não pode ser desfeita.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 p-2 text-[11px] text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-gray-400">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
              Operação segura e auditada.
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false)
                  setItemToDelete(null)
                }}
                className="rounded-xl border border-[#D6D3C8] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-gray-50"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
