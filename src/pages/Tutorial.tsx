import { Link } from 'react-router-dom'

export default function Tutorial() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <div className="space-y-2">
        <h1 className="font-[ui-serif,Georgia,serif] text-3xl text-[#111827]">Como usar o Babilon</h1>
        <p className="text-[#6B7280]">Guia completo para organizar sua vida financeira com nosso sistema.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Fluxo Básico */}
        <div className="rounded-2xl border border-[#D6D3C8] bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C2A14D]/10 text-[#C2A14D]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-[#111827]">1. Cadastre suas Rendas</h3>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Comece informando quanto você ganha no mês na página <strong>Rendas</strong>. O sistema usa isso para calcular quanto você pode gastar e quanto deve guardar.
            <br/><br/>
            O sistema sugere automaticamente a divisão:
            <ul className="list-disc list-inside mt-1 ml-1">
              <li>Despesas Essenciais</li>
              <li>Aportes (Investimentos)</li>
              <li>Lazer / Livre</li>
            </ul>
          </p>
          <div className="mt-4">
            <Link to="/incomes" className="text-sm font-medium text-[#C2A14D] hover:underline">Ir para Rendas &rarr;</Link>
          </div>
        </div>

        {/* Card 2: Despesas Fixas */}
        <div className="rounded-2xl border border-[#D6D3C8] bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C2A14D]/10 text-[#C2A14D]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-[#111827]">2. Despesas Recorrentes</h3>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Cadastre seus gastos fixos (Aluguel, Internet, Academia) e parcelamentos na página <strong>Recorrentes</strong>.
            <br/><br/>
            Isso ajuda a prever quanto do seu salário já está comprometido antes mesmo do mês começar.
          </p>
          <div className="mt-4">
            <Link to="/recurring" className="text-sm font-medium text-[#C2A14D] hover:underline">Ir para Recorrentes &rarr;</Link>
          </div>
        </div>

        {/* Card 3: Metas e Reserva */}
        <div className="rounded-2xl border border-[#D6D3C8] bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C2A14D]/10 text-[#C2A14D]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M10 22 8 8"/><path d="M14 22l2-14"/><path d="M4 9h16"/></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-[#111827]">3. Defina Objetivos</h3>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Na página <strong>Configurações</strong>, defina sua Reserva de Emergência e crie Metas (Viagem, Carro, Casa).
            <br/><br/>
            O sistema irá monitorar seu progresso e sugerir quanto guardar mensalmente para atingir seus sonhos no prazo.
          </p>
          <div className="mt-4">
            <Link to="/settings" className="text-sm font-medium text-[#C2A14D] hover:underline">Ir para Configurações &rarr;</Link>
          </div>
        </div>

        {/* Card 4: Transações do Dia a Dia */}
        <div className="rounded-2xl border border-[#D6D3C8] bg-white p-6 shadow-sm">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#C2A14D]/10 text-[#C2A14D]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-[#111827]">4. Registre Transações</h3>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Sempre que gastar, registre na página <strong>Transações</strong>.
            <br/><br/>
            Você pode vincular gastos a categorias (Alimentação, Transporte) ou a parcelamentos específicos. O Dashboard mostrará em tempo real se você está dentro do orçamento.
          </p>
          <div className="mt-4">
            <Link to="/transactions" className="text-sm font-medium text-[#C2A14D] hover:underline">Ir para Transações &rarr;</Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-[#111827] p-8 text-white shadow-xl">
        <h3 className="mb-4 text-xl font-semibold">Dica de Ouro ✨</h3>
        <p className="text-gray-300 leading-relaxed">
          A consistência é a chave. Tente registrar seus gastos diariamente ou semanalmente.
          <br/>
          Use a tela <strong>Dashboard</strong> para ter uma visão rápida de quanto dinheiro ainda está disponível para gastar no mês, evitando surpresas no final.
        </p>
      </div>
    </div>
  )
}
