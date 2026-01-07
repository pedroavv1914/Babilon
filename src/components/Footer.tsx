export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-[#D6D3C8] bg-[#FBFAF7]/80 backdrop-blur">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Linha superior */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Marca */}
          <div className="flex items-center gap-4">
            {/* Selo */}
            <div className="relative h-11 w-11 rounded-xl border border-[#C2A14D]/50 bg-white shadow-[0_8px_24px_rgba(11,19,36,0.12)]">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C2A14D]" />
              </div>
            </div>

            <div className="leading-tight">
              <div className="font-[ui-serif,Georgia,serif] text-base tracking-[-0.3px] text-[#111827]">
                Babilon
              </div>
              <div className="text-xs text-[#6B7280]">
                Sabedoria financeira aplicada
              </div>
            </div>
          </div>

          {/* Princípios */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#374151]">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#C2A14D]" />
              Reserve
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#0EA5E9]" />
              Planeje
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              Prospere
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
              Ajuste
            </span>
          </div>
        </div>

        {/* Linha inferior */}
        <div className="mt-6 flex flex-col gap-3 border-t border-[#E4E1D6] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-[#6B7280]">
              © {year} Babilon. Idealizado e desenvolvido por{' '}
              <span className="text-[#111827] font-medium">Pedro Ribeiro</span>.
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-[#C2A14D]">
                <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.352-.272-2.636-.759-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
              <span>Ambiente Seguro e Criptografado</span>
            </div>
          </div>

          <div className="text-xs text-[#6B7280] italic">
            Inspirado nos princípios do livro <span className="text-[#111827]">“O Homem Mais Rico da Babilônia”</span>.
          </div>
        </div>
      </div>
    </footer>
  )
}
