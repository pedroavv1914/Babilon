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

type Category = {
  id: number
  name: string
}

export default function Recurring() {
  const [items, setItems] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)

  // New item form
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newFrequency, setNewFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly')
  const [newOccurrences, setNewOccurrences] = useState('1')
  const [newCategoryId, setNewCategoryId] = useState<string>('')

  const fmt = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const uid = await getUserId()
      if (!uid) return

      const [{ data: recData, error: recErr }, { data: catData, error: catErr }] = await Promise.all([
        supabase
          .from('recurring_expenses')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        supabase.from('categories').select('id,name').eq('user_id', uid).order('name'),
      ])

      if (recErr) throw recErr
      if (catErr) throw catErr

      setItems(
        (recData || []).map((i: any) => ({
          ...i,
          amount: Number(i.amount),
          occurrences: Number(i.occurrences),
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

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError('Informe o nome da despesa.')
      return
    }
    const amt = Number(newAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Informe um valor válido.')
      return
    }
    const occ = Number(newOccurrences)
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
        name: newName.trim(),
        amount: amt,
        frequency: newFrequency,
        occurrences: occ,
        category_id: newCategoryId ? Number(newCategoryId) : null,
        is_active: true,
      })

      if (error) throw error
      setNotice('Despesa recorrente adicionada.')
      setNewName('')
      setNewAmount('')
      setNewOccurrences('1')
      setNewCategoryId('')
      await load()
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (id: number) => {
    setItemToDelete(id)
    setDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setSaving(true)
    try {
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', itemToDelete)
      if (error) throw error
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete))
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

  const totalMonthlyEstimate = useMemo(() => {
    return items
      .filter((i) => i.is_active)
      .reduce((acc, i) => {
        let multiplier = 1
        if (i.frequency === 'weekly') multiplier = 4 // approx
        if (i.frequency === 'yearly') multiplier = 1 / 12
        return acc + i.amount * i.occurrences * multiplier
      }, 0)
  }, [items])

  if (loading && items.length === 0) {
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
                    Despesas Recorrentes
                  </div>
                  <div className="mt-1 text-xs text-[#6B7280]">
                    Gerencie gastos fixos e frequentes (assinaturas, serviços, etc).
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#6B7280]">Estimativa Mensal</div>
              <div className="text-xl font-semibold text-[#111827]">{fmt.format(totalMonthlyEstimate)}</div>
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

      {/* Add Form */}
      <div className="rounded-2xl border border-[#E4E1D6] bg-white p-5 shadow-[0_10px_30px_rgba(11,19,36,0.06)]">
        <div className="font-semibold text-[#111827] mb-4">Nova Despesa Recorrente</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs text-[#6B7280] mb-1">Nome</label>
            <input
              type="text"
              className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
              placeholder="Ex: Corte de cabelo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-[#6B7280] mb-1">Frequência</label>
            <select
              className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value as any)}
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
              value={newOccurrences}
              onChange={(e) => setNewOccurrences(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-[#6B7280] mb-1">Categoria</label>
            <select
              className="w-full rounded-xl border border-[#D6D3C8] bg-white px-3 py-2 text-sm"
              value={newCategoryId}
              onChange={(e) => setNewCategoryId(e.target.value)}
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
              onClick={handleAdd}
              disabled={saving}
              className="w-full rounded-xl bg-[#111827] px-3 py-2 text-sm text-white hover:bg-black disabled:opacity-60 transition-colors"
            >
              {saving ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-[#6B7280]">
          Ex: "Corte de cabelo", R$ 50,00, Mensal, 4 vezes = R$ 200,00/mês.
        </div>
      </div>

      {/* List */}
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
                  onClick={() => confirmDelete(item.id)}
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
          </div>
        ))}
        
        {items.length === 0 && !loading && (
          <div className="col-span-full text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-[#D6D3C8]">
            Nenhuma despesa recorrente cadastrada.
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#111827]">Confirmar exclusão</h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              Tem certeza que deseja remover esta despesa recorrente? Essa ação não pode ser desfeita.
            </p>
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
