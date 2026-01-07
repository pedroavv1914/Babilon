import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Header from './components/Header'
import Footer from './components/Footer'
import Settings from './pages/Settings'
import Categories from './pages/Categories'
import Budgets from './pages/Budgets'
import Transactions from './pages/Transactions'
import Investments from './pages/Investments'
import Incomes from './pages/Incomes'
import Recurring from './pages/Recurring'
import Tutorial from './pages/Tutorial'
import Onboarding from './components/Onboarding'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

function App() {
  const [session, setSession] = useState<any | null | undefined>(undefined)
  const [authReady, setAuthReady] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const location = useLocation()
  const hideHeader = location.pathname === '/login' || location.pathname === '/register'
  const mainClassName = hideHeader ? 'w-full flex-1' : 'w-full p-4 flex-1'

  useEffect(() => {
    let mounted = true

    const checkTutorial = async (uid: string) => {
      // Check local storage first to prevent flash on reload
      if (localStorage.getItem('has_seen_tutorial') === 'true') {
        return
      }

      const { data } = await supabase
        .from('user_settings')
        .select('has_seen_tutorial')
        .eq('user_id', uid)
        .maybeSingle()
      
      if (mounted) {
        // If no settings found (data is null) OR has_seen_tutorial is false, show onboarding
        if (!data || data.has_seen_tutorial === false) {
          setShowOnboarding(true)
        } else if (data.has_seen_tutorial === true) {
          // Sync local storage if DB says true
          localStorage.setItem('has_seen_tutorial', 'true')
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session ?? null)
      setAuthReady(true)
      if (data.session?.user) {
        checkTutorial(data.session.user.id)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setSession(session ?? null)
      setAuthReady(true)
      if (session?.user) {
        checkTutorial(session.user.id)
      }
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] flex flex-col">
        {hideHeader ? null : <Header session={null} />}
        <main className={mainClassName}>
          <div className="mt-8">
            <div className="rounded-2xl border border-[#D6D3C8] bg-[#FBFAF7] p-5 text-sm text-[#6B7280] shadow-[0_10px_30px_rgba(11,19,36,0.10)]">
              Carregando…
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F2EB] flex flex-col">
      {hideHeader ? null : <Header session={session} />}
      {showOnboarding && session && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}
      <main className={mainClassName}>
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={session ? <Navigate to="/" replace /> : <Register />} />
          <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/tutorial" element={session ? <Tutorial /> : <Navigate to="/login" replace />} />
          <Route path="/settings" element={session ? <Settings /> : <Navigate to="/login" replace />} />
          <Route path="/incomes" element={session ? <Incomes /> : <Navigate to="/login" replace />} />
          <Route path="/categories" element={session ? <Categories /> : <Navigate to="/login" replace />} />
          <Route path="/budgets" element={session ? <Budgets /> : <Navigate to="/login" replace />} />
          <Route path="/transactions" element={session ? <Transactions /> : <Navigate to="/login" replace />} />
          <Route path="/recurring" element={session ? <Recurring /> : <Navigate to="/login" replace />} />
          <Route path="/investments" element={session ? <Investments /> : <Navigate to="/login" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App

