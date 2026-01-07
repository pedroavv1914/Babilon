import { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { helpContent, HelpCategory, HelpArticle } from '../lib/helpContent'

export default function Tutorial() {
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>(['intro', 'primeiros-passos'])

  // Carrega artigo da URL se houver
  useEffect(() => {
    const articleParam = searchParams.get('article')
    if (articleParam) {
      setSelectedArticleId(articleParam)
      const cat = helpContent.find((c) => c.articles.some((a) => a.id === articleParam))
      if (cat) {
        setExpandedCategoryIds((prev) => (prev.includes(cat.id) ? prev : [...prev, cat.id]))
      }
    }
  }, [searchParams])

  // Filtragem de busca
  const filteredContent = useMemo(() => {
    if (!searchTerm.trim()) return helpContent

    const lowerTerm = searchTerm.toLowerCase()
    return helpContent
      .map((cat) => ({
        ...cat,
        articles: cat.articles.filter(
          (art) => art.title.toLowerCase().includes(lowerTerm) || art.content.toLowerCase().includes(lowerTerm)
        ),
      }))
      .filter((cat) => cat.articles.length > 0)
  }, [searchTerm])

  // Seleciona o primeiro artigo se nada estiver selecionado (opcional, ou mostra uma "home" da ajuda)
  const activeArticle = useMemo(() => {
    if (selectedArticleId) {
      for (const cat of helpContent) {
        const found = cat.articles.find((a) => a.id === selectedArticleId)
        if (found) return found
      }
    }
    return null
  }, [selectedArticleId])

  const toggleCategory = (id: string) => {
    setExpandedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  return (
    <div className="mx-auto max-w-6xl pb-10 min-h-[calc(100vh-100px)]">
      {/* Header da Ajuda */}
      <div className="mb-8 space-y-4">
        <h1 className="font-[ui-serif,Georgia,serif] text-3xl text-[#111827]">Central de Ajuda</h1>
        <div className="relative max-w-2xl">
          <input
            type="text"
            placeholder="O que você precisa saber? (ex: Renda, Metas, Segurança)"
            className="w-full rounded-xl border border-[#D6D3C8] bg-white py-3 pl-12 pr-4 text-sm shadow-sm focus:border-[#C2A14D] focus:ring-1 focus:ring-[#C2A14D] outline-none transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar de Navegação */}
        <div className="lg:col-span-4 lg:border-r lg:border-[#E4E1D6] lg:pr-8">
          <div className="space-y-4 sticky top-24">
            {filteredContent.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-[#E4E1D6] bg-[#FBFAF7] overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="flex w-full items-center justify-between bg-[#F3F4F6] px-4 py-3 text-left font-medium text-[#111827] hover:bg-[#E5E7EB] transition"
                >
                  <span>{cat.title}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-gray-500 transition-transform ${expandedCategoryIds.includes(cat.id) || searchTerm ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {(expandedCategoryIds.includes(cat.id) || searchTerm) && (
                  <div className="flex flex-col p-2 space-y-1">
                    {cat.articles.map((art) => (
                      <button
                        key={art.id}
                        onClick={() => setSelectedArticleId(art.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          selectedArticleId === art.id
                            ? 'bg-[#C2A14D]/10 text-[#92722A] font-medium'
                            : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#111827]'
                        }`}
                      >
                        {art.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {filteredContent.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                Nenhum tópico encontrado para "{searchTerm}".
              </div>
            )}
            
            {/* Link de Suporte Extra */}
            <div className="mt-8 rounded-xl bg-[#111827] p-5 text-white">
              <h4 className="font-medium mb-2">Ainda com dúvidas?</h4>
              <p className="text-xs text-gray-300 mb-3">
                Não encontrou o que procurava? Entre em contato com o suporte técnico.
              </p>
              <a href="mailto:suporte@babilon.com" className="text-xs text-[#C2A14D] hover:underline">
                Enviar e-mail &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* Área de Conteúdo */}
        <div className="lg:col-span-8 min-h-[500px]">
          {activeArticle ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <article className="prose prose-stone max-w-none">
                <h2 className="font-[ui-serif,Georgia,serif] text-2xl text-[#111827] mb-6 border-b border-[#E4E1D6] pb-4">
                  {activeArticle.title}
                </h2>
                <div 
                  className="text-[#4B5563] space-y-4 leading-relaxed [&>p]:mb-4 [&>h3]:text-[#111827] [&>h3]:font-medium [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5"
                  dangerouslySetInnerHTML={{ __html: activeArticle.content }} 
                />
              </article>
              
              <div className="mt-12 border-t border-[#E4E1D6] pt-6 flex justify-between items-center">
                <span className="text-xs text-gray-400">Foi útil?</span>
                <button 
                  onClick={() => setSelectedArticleId(null)}
                  className="text-sm text-[#C2A14D] hover:underline lg:hidden"
                >
                  &larr; Voltar para o menu
                </button>
              </div>
            </div>
          ) : (
            /* Home da Ajuda (Estado Vazio) */
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-10 lg:py-0">
              <div className="h-24 w-24 rounded-full bg-[#F3F4F6] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-medium text-[#111827] mb-2">Bem-vindo à Central de Ajuda</h3>
                <p className="text-gray-500">
                  Selecione um tópico no menu ao lado para aprender como dominar suas finanças com o Babilon.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-8">
                <button 
                  onClick={() => setSelectedArticleId('metodo-babilonia')}
                  className="p-4 rounded-xl border border-[#E4E1D6] bg-white hover:border-[#C2A14D] hover:shadow-md transition text-left group"
                >
                  <div className="text-xs font-semibold text-[#C2A14D] uppercase tracking-wide mb-1">Conceito</div>
                  <div className="font-medium text-[#111827] group-hover:text-[#C2A14D]">O Método Babilônia</div>
                </button>
                <button 
                  onClick={() => setSelectedArticleId('configuracao-inicial')}
                  className="p-4 rounded-xl border border-[#E4E1D6] bg-white hover:border-[#C2A14D] hover:shadow-md transition text-left group"
                >
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Prática</div>
                  <div className="font-medium text-[#111827] group-hover:text-[#C2A14D]">Configurando sua Conta</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
