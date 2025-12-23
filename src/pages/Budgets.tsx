import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type Category = { id: number; name: string }
type BudgetRow = { id: number; category_id: number; category_name: string; month: number; year: number; limit_amount: number }

export default function Budgets() {
  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [limit, setLimit] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    const { data: cats } = await supabase.from('categories').select('id,name').order('name')
    setCategories(cats || [])
    const { data: dataRows } = await supabase
      .from('vw_budget_usage')
      .select('user_id,month,year,category_name,limit_amount')
      .eq('month', month)
      .eq('year', year)
    setRows(
      (dataRows || []).map((r: any, i: number) => ({
        id: i,
        category_id: 0,
        category_name: r.category_name,
        month: r.month,
        year: r.year,
        limit_amount: r.limit_amount
      }))
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [month, year])

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const uid = await getUserId()
    if (!uid || !categoryId) return
    const { error } = await supabase.from('budgets').upsert({ user_id: uid, category_id: categoryId, month, year, limit_amount: limit }, { onConflict: 'user_id,category_id,month,year' })
    if (error) setError(error.message)
    setLimit(0)
    await load()
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Definir Orçamento</div>
        <form onSubmit={saveBudget} className="space-y-3">
          <select className="border rounded px-3 py-2 w-full" value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))}>
            <option value="" disabled>Categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input className="border rounded px-3 py-2 w-full" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
            <input className="border rounded px-3 py-2 w-full" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <input className="border rounded px-3 py-2 w-full" type="number" step="0.01" placeholder="Limite" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          {error ? <div className="text-red-600 text-sm">{error}</div> : null}
          <button className="bg-slate-900 text-white rounded px-4 py-2">Salvar</button>
        </form>
      </div>
      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Orçamentos do Mês</div>
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={`${r.category_name}-${r.month}-${r.year}`} className="flex items-center justify-between">
              <span>{r.category_name}</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.limit_amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

