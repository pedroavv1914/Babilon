import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { createPortal } from 'react-dom'

type Step = {
  target?: string
  title: string
  content: string
  action: string
  position?: 'bottom' | 'top' | 'left' | 'right' | 'center'
}

type OnboardingProps = {
  onComplete: () => void
}

const TOUR_STEPS: Step[] = [
  {
    target: undefined, // Central modal
    title: "Bem-vindo a Babilon 🏛️",
    content: "Aqui começa sua jornada para a liberdade financeira. Não é apenas sobre números, é sobre construir muros de proteção e multiplicar seu ouro.",
    action: "Iniciar Jornada",
    position: 'center'
  },
  {
    target: "kpi-income",
    title: "O Fluxo de Ouro",
    content: "Toda riqueza começa com uma fonte de renda. Monitore suas entradas aqui para saber o limite seguro dos seus gastos.",
    action: "Entendi",
    position: 'bottom'
  },
  {
    target: "kpi-savings",
    title: "A Regra de Ouro",
    content: "Uma parte de tudo que você ganha pertence a você. O sistema separa automaticamente sua reserva antes que você possa gastar.",
    action: "Próximo",
    position: 'bottom'
  },
  {
    target: "kpi-available",
    title: "Viva com o Restante",
    content: "Aqui está sua verdadeira riqueza disponível para hoje. Respeite este limite e seu ouro se multiplicará com o tempo.",
    action: "Continuar",
    position: 'bottom'
  },
  {
    target: "nav-incomes",
    title: "Alimente a Fonte",
    content: "Registre seus ganhos na aba 'Renda'. O sistema cuidará de calcular sua reserva e metas automaticamente.",
    action: "Perfeito",
    position: 'bottom'
  },
  {
    target: "nav-settings",
    title: "Ajuste o Curso",
    content: "No 'Planejamento', você define as regras do seu jogo: quanto quer poupar e quais são seus sonhos.",
    action: "Vamos lá",
    position: 'bottom'
  },
  {
    target: undefined,
    title: "A Sabedoria Está em Suas Mãos",
    content: "Explore, ajuste e prospere. O Babilon aprende com você e protege seu futuro. Estamos prontos?",
    action: "Concluir",
    position: 'center'
  }
]

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [isVisible, setIsVisible] = useState(false)
  const [fallbackToCenter, setFallbackToCenter] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  const currentStep = TOUR_STEPS[currentStepIndex]
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 5

  const updatePosition = useCallback(() => {
    // Check for mobile breakpoint
    const mobileCheck = window.innerWidth < 768
    setIsMobile(mobileCheck)

    // Force center/bottom sheet if mobile
    if (mobileCheck) {
      setHighlightStyle(null)
      setTooltipStyle({})
      setIsVisible(true)
      return
    }

    // Standard Desktop Logic
    if (!currentStep.target || fallbackToCenter) {
      setHighlightStyle(null)
      setTooltipStyle({})
      setIsVisible(true)
      return
    }

    const element = document.getElementById(currentStep.target)
    
    if (element) {
      retryCountRef.current = 0
      const rect = element.getBoundingClientRect()
      
      setHighlightStyle({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        position: 'fixed',
        borderRadius: window.getComputedStyle(element).borderRadius || '12px',
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 0 4px rgba(194, 161, 77, 0.3)',
        zIndex: 60
      })

      let top = 0
      let left = 0
      const tooltipWidth = 320 
      const gap = 16

      switch (currentStep.position) {
        case 'bottom':
          top = rect.bottom + gap
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2)
          break
        case 'top':
          top = rect.top - gap - 200 
          left = rect.left + (rect.width / 2) - (tooltipWidth / 2)
          break
        case 'right':
          top = rect.top
          left = rect.right + gap
          break
        default:
          top = rect.bottom + gap
          left = rect.left
      }

      if (left < 10) left = 10
      if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10
      if (top > window.innerHeight - 200) top = rect.top - 200

      setTooltipStyle({
        top,
        left,
        position: 'fixed',
        zIndex: 61
      })
      
      setIsVisible(true)
    } else {
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        retryTimeoutRef.current = setTimeout(updatePosition, 100)
      } else {
        setFallbackToCenter(true)
        setIsVisible(true)
      }
    }
  }, [currentStep, fallbackToCenter])

  useEffect(() => {
    setIsVisible(false)
    setFallbackToCenter(false)
    retryCountRef.current = 0
    
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)

    const timer = setTimeout(() => {
      updatePosition()
    }, 300)

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      clearTimeout(timer)
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [currentStepIndex, updatePosition])

  const handleNext = async () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
    } else {
      await completeTutorial()
    }
  }

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }

  const handleSkip = async () => {
    await completeTutorial()
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
    } catch (error) {
      console.error('Error completing tutorial:', error)
    } finally {
      onComplete()
    }
  }

  const renderContent = (mode: 'modal' | 'spotlight' | 'bottom-sheet') => (
    <div className={`relative font-sans text-left ${mode === 'bottom-sheet' ? 'pb-safe' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C2A14D] text-[10px] font-bold text-white">
          {currentStepIndex + 1}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-[#C2A14D]">
          Passo {currentStepIndex + 1} de {TOUR_STEPS.length}
        </span>
      </div>
      
      {(mode === 'modal' || mode === 'bottom-sheet') && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#C2A14D]/10 text-2xl">
          🏛️
        </div>
      )}
      
      <h3 className={`mb-2 font-bold text-[#111827] ${(mode === 'modal' || mode === 'bottom-sheet') ? 'text-2xl text-center' : 'text-lg'}`}>
        {currentStep.title}
      </h3>
      
      <p className={`mb-6 text-sm leading-relaxed text-[#4B5563] ${(mode === 'modal' || mode === 'bottom-sheet') ? 'text-center' : ''}`}>
        {currentStep.content}
      </p>

      <div className="flex items-center justify-between gap-4 mt-auto">
        <div className="flex gap-4">
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
          >
            Pular
          </button>
        </div>
        
        <div className="flex gap-2">
          {currentStepIndex > 0 && (
             <button
             onClick={handlePrev}
             className="rounded-lg border border-[#D6D3C8] bg-white px-4 py-2 text-sm font-medium text-[#6B7280] shadow-sm hover:bg-[#F9FAFB] transition-all"
           >
             Voltar
           </button>
          )}
          <button
            onClick={handleNext}
            className="rounded-lg bg-[#0B1324] px-5 py-2 text-sm font-semibold text-[#C2A14D] shadow-lg hover:bg-[#17233A] hover:shadow-xl transition-all active:scale-95"
          >
            {currentStep.action}
          </button>
        </div>
      </div>
    </div>
  )

  // Portal to ensure it's on top of everything
  return createPortal(
    <>
      <style>
        {`
          @keyframes pulse-ring {
            0% { transform: scale(1); opacity: 0.4; }
            100% { transform: scale(1.15); opacity: 0; }
          }
          .spotlight-pulse::after {
            content: '';
            position: absolute;
            top: -4px; left: -4px; right: -4px; bottom: -4px;
            border-radius: inherit;
            border: 2px solid #C2A14D;
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          }
          .pb-safe {
            padding-bottom: env(safe-area-inset-bottom, 20px);
          }
        `}
      </style>

      {/* MOBILE BOTTOM SHEET MODE */}
      {isMobile && (
         <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full bg-[#FBFAF7] rounded-t-2xl border-t border-[#D6D3C8] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] p-6 animate-in slide-in-from-bottom duration-300">
             {renderContent('bottom-sheet')}
           </div>
         </div>
      )}

      {/* DESKTOP MODAL MODE (Fallback or Center) */}
      {!isMobile && (!currentStep.target || fallbackToCenter) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#FBFAF7] border border-[#D6D3C8] shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            {renderContent('modal')}
          </div>
        </div>
      )}

      {/* DESKTOP SPOTLIGHT MODE */}
      {!isMobile && currentStep.target && !fallbackToCenter && isVisible && highlightStyle && (
        <>
          <div 
            className="spotlight-pulse pointer-events-none transition-all duration-500 ease-in-out"
            style={highlightStyle} 
          />
          <div 
            className="fixed w-80 rounded-2xl bg-[#FBFAF7] border border-[#D6D3C8] p-5 shadow-2xl transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-bottom-4"
            style={tooltipStyle}
          >
            {renderContent('spotlight')}
          </div>
        </>
      )}
    </>,
    document.body
  )
}
