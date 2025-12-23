import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'

type Category = { id: number; name: string; type: 'fixo' | 'variavel' }

export default function Categories() {
  const [items, setItems] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<'fixo' | 'variavel'>('fixo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('categories').select('id,name,type').order('name')
    if (error) setError(error.message)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('categories').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => load()).subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const uid = await getUserId()
    if (!uid) return
    const { error } = await supabase.from('categories').insert({ user_id: uid, name, type })
    if (error) setError(error.message)
    setName('')
    setType('fixo')
  }

  async function remove(id: number) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) setError(error.message)
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Nova Categoria</div>
        <form onSubmit={addCategory} className="space-y-3">
          <input className="border rounded px-3 py-2 w-full" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="border rounded px-3 py-2 w-full" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="fixo">Fixo</option>
            <option value="variavel">Variável</option>
          </select>
          {error ? <div className="text-red-600 text-sm">{error}</div> : null}
          <button className="bg-slate-900 text-white rounded px-4 py-2">Adicionar</button>
        </form>
      </div>
      <div className="bg-white border rounded p-4">
        <div className="font-semibold mb-2">Categorias</div>
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>{c.name} <span className="text-xs text-slate-500">({c.type})</span></span>
              <button className="text-sm underline" onClick={() => remove(c.id)}>Excluir</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

