import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface HelpTooltipProps {
  content: string
  articleId?: string // ID do artigo na página de Tutorial/Ajuda para "Saiba mais"
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function HelpTooltip({ content, articleId, position = 'top' }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Fecha o tooltip ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div className="relative inline-flex items-center ml-1.5 align-middle" ref={tooltipRef}>
      <button
        type="button"
        className="text-gray-400 hover:text-[#C2A14D] transition-colors focus:outline-none"
        onClick={() => setIsVisible(!isVisible)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        aria-label="Mais informações"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
      </button>

      {isVisible && (
        <div 
          className={`absolute z-50 w-64 p-3 text-xs text-left font-normal text-white bg-[#1F2937] rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200 ${positionClasses[position]}`}
          role="tooltip"
        >
          {/* Seta do tooltip */}
          <div 
            className={`absolute w-2 h-2 bg-[#1F2937] transform rotate-45 
              ${position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' : ''}
              ${position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' : ''}
              ${position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' : ''}
              ${position === 'right' ? 'left-[-4px] top-1/2 -translate-y-1/2' : ''}
            `}
          />
          
          <div className="relative">
            <p className="leading-relaxed">{content}</p>
            {articleId && (
              <div className="mt-2 pt-2 border-t border-gray-600">
                <Link 
                  to={`/tutorial?article=${articleId}`}
                  className="text-[#C2A14D] hover:underline font-medium flex items-center gap-1"
                >
                  Saiba mais
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}