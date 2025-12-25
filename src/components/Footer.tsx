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
          <div className="text-xs text-[#6B7280]">
            © {year} Babilon. Idealizado e desenvolvido por{' '}
            <span className="text-[#111827] font-medium">Pedro Ribeiro</span>.
          </div>


          <div className="text-xs text-[#6B7280] italic">
            Inspirado nos princípios do livro <span className="text-[#111827]">“O Homem Mais Rico da Babilônia”</span>.
          </div>
        </div>
      </div>
    </footer>
  )
}
