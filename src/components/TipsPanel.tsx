import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Tip = { key: string; content: string }

export default function TipsPanel({ keys }: { keys: string[] }) {
  const [tips, setTips] = useState<Tip[]>([])

  useEffect(() => {
    async function load() {
      if (!keys.length) { setTips([]); return }
      const { data } = await supabase.from('tips').select('key,content').in('key', keys)
      setTips(data || [])
    }
    load()
  }, [keys])

  if (!tips.length) return null

  return (
    <div className="mt-3 space-y-2">
      {tips.map(t => (
        <div key={t.key} className="text-sm bg-slate-50 border rounded px-3 py-2">{t.content}</div>
      ))}
    </div>
  )
}

