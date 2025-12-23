import { NavLink } from 'react-router-dom'

export default function Nav() {
  const link = 'text-sm px-3 py-1.5 rounded hover:bg-slate-100'
  const active = 'bg-slate-200'
  return (
    <nav className="mb-4 flex flex-wrap gap-2">
      <NavLink to="/" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>Dashboard</NavLink>
      <NavLink to="/incomes" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>Renda</NavLink>
      <NavLink to="/settings" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>Configurações</NavLink>
      <NavLink to="/categories" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>Categorias</NavLink>
      <NavLink to="/budgets" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>Orçamentos</NavLink>
      <NavLink to="/transactions" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>Transações</NavLink>
      <NavLink to="/investments" className={({ isActive }) => `${link} ${isActive ? active : ''}`}>Investimentos</NavLink>
    </nav>
  )
}
