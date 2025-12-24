import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Header from './components/Header'
import Nav from './components/Nav'
import Settings from './pages/Settings'
import Categories from './pages/Categories'
import Budgets from './pages/Budgets'
import Transactions from './pages/Transactions'
import Investments from './pages/Investments'
import Incomes from './pages/Incomes'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

function App() {
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="min-h-screen">
      <Header session={session} />
      <div className="max-w-6xl mx-auto p-4">
        {session ? <Nav /> : null}
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={session ? <Navigate to="/" replace /> : <Register />} />
          <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/settings" element={session ? <Settings /> : <Navigate to="/login" replace />} />
          <Route path="/incomes" element={session ? <Incomes /> : <Navigate to="/login" replace />} />
          <Route path="/categories" element={session ? <Categories /> : <Navigate to="/login" replace />} />
          <Route path="/budgets" element={session ? <Budgets /> : <Navigate to="/login" replace />} />
          <Route path="/transactions" element={session ? <Transactions /> : <Navigate to="/login" replace />} />
          <Route path="/investments" element={session ? <Investments /> : <Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default App

