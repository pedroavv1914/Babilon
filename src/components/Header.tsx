import { supabase } from '../lib/supabaseClient'
import { NavLink } from 'react-router-dom'

export default function Header({ session }: { session: any }) {
  const link = 'text-sm px-3 py-1.5 rounded hover:bg-slate-100'
  const active = 'bg-slate-200'
  const rawName = session?.user?.user_metadata?.name
  const email = session?.user?.email
  const userLabel =
    typeof rawName === 'string' && rawName.trim()
      ? rawName.trim()
      : typeof email === 'string' && email.includes('@')
        ? email.split('@')[0]
        : typeof email === 'string'
          ? email
          : null

  return (
    <header className="bg-white border-b">
      <div className="w-full px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Projeto Babilon</span>
        </div>

        {session ? (
          <nav className="flex flex-1 flex-wrap justify-center gap-2">
            <NavLink to="/" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>
              Dashboard
            </NavLink>
            <NavLink to="/incomes" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>
              Renda
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>
              Configurações
            </NavLink>
            <NavLink to="/categories" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>
              Categorias
            </NavLink>
            <NavLink to="/budgets" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>
              Orçamentos
            </NavLink>
            <NavLink to="/transactions" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>
              Transações
            </NavLink>
            <NavLink to="/investments" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>
              Investimentos
            </NavLink>
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        {session ? (
          <div className="ml-auto flex items-center gap-2">
            {userLabel ? <span className="text-sm text-slate-600">{userLabel}</span> : null}
            <button className="text-sm px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" onClick={() => supabase.auth.signOut()}>
              Sair
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}

