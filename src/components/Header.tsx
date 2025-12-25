import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { NavLink } from 'react-router-dom'

export default function Header({ session }: { session: any }) {
  const [open, setOpen] = useState(false)

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
      { to: '/categories', label: 'Categorias' },
      { to: '/investments', label: 'Investimentos' },
      { to: '/settings', label: 'Planejamento' },
    ],
    []
  )

  const initials = userLabel
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-50">
      {/* HEADER BASE */}
      <div className="bg-[#0B1324] border-b border-[#17233A]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* BRAND */}
            <div className="flex items-center gap-4">
              <div className="relative h-10 w-10 rounded-xl bg-[#0F172A] border border-[#C2A14D]/50 flex items-center justify-center">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C2A14D]" />
              </div>

              <div className="leading-tight">
                <div className="font-[ui-serif,Georgia,serif] text-lg tracking-[-0.4px] text-[#FBFAF7]">
                  Babilon
                </div>
                <div className="text-[11px] text-[#9CA3AF]">
                  Sabedoria financeira aplicada
                </div>
              </div>
            </div>

            {/* USER / ACTIONS */}
            {session && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-3 rounded-xl bg-[#0F172A] border border-[#17233A] px-3 py-2">
                  <div className="h-8 w-8 rounded-lg bg-[#0B1324] border border-[#C2A14D]/40 flex items-center justify-center text-xs font-semibold text-[#E7E1D4]">
                    {initials}
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm text-[#FBFAF7]">{userLabel}</div>
                    <div className="text-[11px] text-[#9CA3AF]">Conta ativa</div>
                  </div>
                </div>

                <button
                  onClick={() => supabase.auth.signOut()}
                  className="rounded-lg border border-[#C2A14D]/40 bg-[#0F172A] px-3 py-2 text-sm text-[#FBFAF7] hover:bg-[#17233A] transition"
                >
                  Sair
                </button>

                <button
                  className="lg:hidden rounded-lg border border-[#17233A] bg-[#0F172A] px-3 py-2 text-sm text-[#E7E1D4]"
                  onClick={() => setOpen((v) => !v)}
                >
                  Menu
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NAVBAR */}
      {session && (
        <div className="bg-[#0B1324]/95 border-b border-[#17233A] backdrop-blur">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            {/* DESKTOP */}
            <nav className="hidden lg:flex items-center gap-1 py-2">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'relative px-3 py-2 rounded-xl text-sm transition',
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

            {/* MOBILE */}
            {open && (
              <div className="lg:hidden py-3">
                <div className="rounded-xl bg-[#0F172A] border border-[#17233A] p-2 space-y-1">
                  {nav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        [
                          'block rounded-lg px-3 py-2 text-sm transition',
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
            )}
          </div>
        </div>
      )}

      {/* LINHA DOURADA FINAL */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#C2A14D] to-transparent" />
    </header>
  )
}
