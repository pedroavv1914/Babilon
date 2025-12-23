import { supabase } from '../lib/supabaseClient'

export default function Header({ session }: { session: any }) {
  return (
    <header className="bg-white border-b">
      <div className="max-w-6xl mx-auto p-4 flex items-center justify-between">
        <span className="font-semibold">Projeto Babilon</span>
        {session ? (
          <button className="text-sm px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        ) : null}
      </div>
    </header>
  )
}

