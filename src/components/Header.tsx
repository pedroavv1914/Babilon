import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { NavLink } from 'react-router-dom'
import { usePrivacy } from '../lib/PrivacyContext'

export default function Header({ session }: { session: any }) {
  const [open, setOpen] = useState(false)
  const { isPrivacyOn, togglePrivacy } = usePrivacy()

  const rawName = session?.user?.user_metadata?.name
  const email = session?.user?.email
  const userLabel =
    typeof rawName === 'string' && rawName.trim()
      ? rawName.trim()
      : typeof email === 'string' && email.includes('@')
        ? email.split('@')[0]
        : 'Usuário'

  const nav = useMemo(
    () => [
      { to: '/', label: 'Visão Geral' },
      { to: '/incomes', label: 'Renda' },
      { to: '/budgets', label: 'Orçamentos' },
      { to: '/transactions', label: 'Transações' },
      { to: '/recurring', label: 'Recorrentes' },
      { to: '/categories', label: 'Categorias' },
      { to: '/investments', label: 'Investimentos' },
      { to: '/settings', label: 'Planejamento' },
      { to: '/tutorial', label: 'Ajuda' },
    ],
    []
  )

  const initials = userLabel
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  const MobileProfile = () => (
    <div className="mb-4 rounded-2xl bg-[#0F172A] border border-[#17233A] p-4 shadow-lg">
      <div className="flex items-start gap-4">
        {/* Avatar Circular com Status */}
        <div className="relative shrink-0">
          <div className="h-12 w-12 rounded-full bg-[#0B1324] border border-[#C2A14D]/40 flex items-center justify-center text-base font-bold text-[#E7E1D4] shadow-[0_0_15px_rgba(194,161,77,0.1)]">
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#0F172A] flex items-center justify-center border border-[#17233A]">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Informações do Usuário */}
        <div className="flex-1 min-w-0">
          <h3 className="font-[ui-serif,Georgia,serif] text-lg text-[#FBFAF7] truncate leading-tight">
            {userLabel}
          </h3>
          
          <div className="flex items-center gap-1.5 mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-500">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-emerald-500">Sessão segura</span>
          </div>

          <p className="text-[10px] text-[#9CA3AF] mt-1.5 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#9CA3AF]" />
            Conta ativa
            <span className="w-1 h-1 rounded-full bg-[#9CA3AF]" />
            Autenticado via Supabase
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-[#0B1324] border-b border-[#17233A]">
        <div className="w-full px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-4 shrink-0 w-auto xl:w-[280px]">
              <div className="relative h-10 w-10 rounded-xl bg-[#0F172A] border border-[#C2A14D]/50 flex items-center justify-center">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C2A14D]" />
              </div>

              <div className="leading-tight">
                <div className="font-[ui-serif,Georgia,serif] text-lg tracking-[-0.4px] text-[#FBFAF7]">
                  Babilon
                </div>
                <div className="text-[11px] text-[#9CA3AF] hidden sm:block">
                  Sabedoria financeira aplicada
                </div>
              </div>
            </div>

            {session && (
              <nav className="hidden xl:flex flex-1 items-center justify-center gap-1">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    id={`nav-${item.to.replace('/', '') || 'home'}`}
                    className={({ isActive }) =>
                      [
                        'relative px-3 py-2 rounded-xl text-sm transition whitespace-nowrap',
                        isActive
                          ? 'text-[#FBFAF7] bg-[#0F172A]'
                          : 'text-[#E7E1D4] hover:bg-[#17233A]',
                      ].join(' ')
                    }
                  >
                    {item.label}
                    <span
                      className={`absolute left-3 right-3 bottom-1 h-[2px] rounded-full ${
                        item.to === location.pathname ? 'bg-[#C2A14D]' : 'bg-transparent'
                      }`}
                    />
                  </NavLink>
                ))}
              </nav>
            )}

            {session && (
              <div className="flex items-center justify-end gap-3 shrink-0 w-auto xl:w-[280px]">
                <div className="hidden sm:flex items-center gap-3 rounded-xl bg-[#0F172A] border border-[#17233A] px-3 py-2 max-w-[240px]">
                  <div className="shrink-0 h-8 w-8 rounded-lg bg-[#0B1324] border border-[#C2A14D]/40 flex items-center justify-center text-xs font-semibold text-[#E7E1D4]">
                    {initials}
                  </div>
                  <div className="leading-tight overflow-hidden">
                    <div className="text-sm text-[#FBFAF7] truncate" title={userLabel}>
                      {userLabel}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-500 truncate" title="Sua conexão é criptografada de ponta a ponta">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 w-3 h-3">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                      Sessão Segura
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePrivacy}
                    className="rounded-lg border border-[#17233A] bg-[#0F172A] p-2 text-[#9CA3AF] hover:bg-[#17233A] hover:text-[#FBFAF7] transition"
                    title={isPrivacyOn ? "Mostrar valores" : "Ocultar valores"}
                  >
                    {isPrivacyOn ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z" />
                        <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0115.75 12zM12.53 15.713l-4.243-4.244a3.75 3.75 0 004.243 4.243z" />
                        <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 00-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.702 7.69 10.677 7.69.612 0 1.209-.05 1.791-.144l-3.1-3.1A5.25 5.25 0 016.75 12z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                        <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="rounded-lg border border-[#C2A14D]/40 bg-[#0F172A] px-3 py-2 text-sm text-[#FBFAF7] hover:bg-[#17233A] transition"
                  >
                    Sair
                  </button>
                </div>

                <button
                  className="xl:hidden rounded-lg border border-[#17233A] bg-[#0F172A] px-3 py-2 text-sm text-[#E7E1D4]"
                  onClick={() => setOpen((v) => !v)}
                >
                  Menu
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {session && open && (
        <div className="xl:hidden bg-[#0B1324]/95 border-b border-[#17233A] backdrop-blur">
          <div className="w-full px-4">
            <div className="py-4">
              <MobileProfile />
              <div className="rounded-xl bg-[#0F172A] border border-[#17233A] p-2 space-y-1">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      [
                        'block rounded-lg px-3 py-2 text-sm transition whitespace-nowrap',
                        isActive
                          ? 'bg-[#17233A] text-[#FBFAF7]'
                          : 'text-[#E7E1D4] hover:bg-[#17233A]',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#C2A14D] to-transparent" />
    </header>
  )
}
