import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

type OnboardingProps = {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()

  const steps = [
    {
      title: "Bem-vindo ao Babilon! 🏛️",
      content: "Seu novo aliado para conquistar a liberdade financeira. Vamos fazer um tour rápido?",
      action: "Começar"
    },
    {
      title: "1. Organize suas Rendas 💰",
      content: "O primeiro passo é cadastrar quanto você ganha. O sistema irá sugerir automaticamente quanto investir e quanto gastar.",
      action: "Próximo"
    },
    {
      title: "2. Controle Gastos Fixos 📅",
      content: "Cadastre aluguel, assinaturas e parcelas na aba 'Recorrentes'. Saiba exatamente quanto sobra do seu salário.",
      action: "Próximo"
    },
    {
      title: "3. Realize Sonhos 🚀",
      content: "Defina metas (Carro, Viagem) e acompanhe o progresso. O sistema te ajuda a poupar o valor certo todo mês.",
      action: "Vamos lá!"
    }
  ]

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      await completeTutorial()
    }
  }

  const completeTutorial = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('user_settings')
          .update({ has_seen_tutorial: true })
          .eq('user_id', user.id)
      }
      onComplete()
      navigate('/') // Ensure we are on dashboard or stay where we are
    } catch (error) {
      console.error('Error completing tutorial:', error)
      onComplete() // Close anyway
    }
  }

  const currentStep = steps[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl transform transition-all duration-300 scale-100">
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-gray-100">
          <div 
            className="h-full bg-[#C2A14D] transition-all duration-300 ease-out"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C2A14D]/10 text-[#C2A14D] text-2xl">
              {step === 0 && "👋"}
              {step === 1 && "💰"}
              {step === 2 && "📅"}
              {step === 3 && "🚀"}
            </div>
          </div>
          
          <h2 className="mb-3 text-2xl font-bold text-[#111827]">
            {currentStep.title}
          </h2>
          
          <p className="mb-8 text-[#6B7280] leading-relaxed">
            {currentStep.content}
          </p>

          <button
            onClick={handleNext}
            className="w-full rounded-xl bg-[#C2A14D] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#B08D3B] focus:outline-none focus:ring-2 focus:ring-[#C2A14D] focus:ring-offset-2 transition-all"
          >
            {currentStep.action}
          </button>

          {step < steps.length - 1 && (
            <button
              onClick={() => completeTutorial()}
              className="mt-4 text-xs font-medium text-[#9CA3AF] hover:text-[#6B7280]"
            >
              Pular tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
