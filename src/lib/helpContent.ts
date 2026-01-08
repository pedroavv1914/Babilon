
export type HelpArticle = {
  id: string
  title: string
  content: string // Pode conter Markdown básico ou HTML safe
  icon?: string // Nome do ícone ou categoria
}

export type HelpCategory = {
  id: string
  title: string
  articles: HelpArticle[]
}

export const helpContent: HelpCategory[] = [
  {
    id: 'intro',
    title: 'Conceitos do Babilon',
    articles: [
      {
        id: 'metodo-babilonia',
        title: 'O Método Babilônia',
        content: `
          <p>O Babilon não é apenas uma planilha de gastos. Ele é construído sobre a filosofia do livro <em>"O Homem Mais Rico da Babilônia"</em>.</p>
          <h3 class="text-lg font-semibold mt-4 mb-2">Pague-se Primeiro</h3>
          <p>A regra de ouro é: <strong>uma parte de tudo que você ganha pertence a você</strong>. Antes de pagar contas ou gastar com lazer, o sistema separa automaticamente uma porcentagem da sua renda para o seu "Eu do Futuro".</p>
          <h3 class="text-lg font-semibold mt-4 mb-2">Disciplina Automática</h3>
          <p>Ao registrar uma renda, o Babilon já calcula quanto você pode gastar livremente e quanto deve ser investido. Isso elimina a culpa de gastar e garante o crescimento do seu patrimônio.</p>
        `
      },
      {
        id: 'fluxo-sistema',
        title: 'Como o Sistema Funciona',
        content: `
          <p>O fluxo ideal de uso do Babilon segue 3 passos mensais:</p>
          <ol class="list-decimal list-inside space-y-2 mt-2 ml-1">
            <li><strong>Recebeu? Registre na Renda:</strong> Lance seu salário ou extra na aba <em>Rendas</em>. O sistema vai reter o percentual de investimento (padrão 10% ou mais).</li>
            <li><strong>Viva com o Restante:</strong> O valor que sobra é seu "Teto de Gastos". Use a aba <em>Transações</em> para registrar despesas do dia a dia.</li>
            <li><strong>Acompanhe as Metas:</strong> O valor retido é distribuído automaticamente para sua <em>Reserva de Emergência</em> e <em>Metas</em> (viagens, compras), conforme suas configurações.</li>
          </ol>
        `
      }
    ]
  },
  {
    id: 'primeiros-passos',
    title: 'Primeiros Passos',
    articles: [
      {
        id: 'configuracao-inicial',
        title: 'Configurando sua Conta',
        content: `
          <p>Antes de começar, vá até a aba <strong>Planejamento</strong> para definir as regras do jogo:</p>
          <ul class="list-disc list-inside space-y-2 mt-2 ml-1">
            <li><strong>Percentual do Futuro:</strong> Quanto da sua renda você quer guardar? Recomendamos começar com 10%.</li>
            <li><strong>Reserva de Emergência:</strong> Defina quantos meses de custo de vida você quer ter guardados para segurança (ex: 6 meses).</li>
            <li><strong>Metas:</strong> Crie objetivos específicos, como "Trocar de Carro" ou "Viagem de Férias".</li>
          </ul>
        `
      },
      {
        id: 'cadastro-renda',
        title: 'Registrando sua Renda',
        content: `
          <p>Vá até a aba <strong>Renda</strong> e clique no botão de adicionar (+).</p>
          <p class="mt-2">Você pode definir se aquela renda segue a regra padrão (ex: guardar 10%) ou se é uma renda extra que você quer guardar 100% (regra personalizada).</p>
          <div class="bg-blue-50 p-3 rounded-lg mt-3 text-sm text-blue-800">
            <strong>Dica:</strong> Lance o valor líquido (o que cai na conta), já descontando impostos retidos na fonte.
          </div>
        `
      }
    ]
  },
  {
    id: 'dia-a-dia',
    title: 'Gestão do Dia a Dia',
    articles: [
      {
        id: 'transacoes',
        title: 'Registrando Gastos',
        content: `
          <p>Comprou algo? Registre na aba <strong>Transações</strong>.</p>
          <p class="mt-2">Selecione a categoria correta para que o Dashboard possa te mostrar onde seu dinheiro está indo. Se foi uma compra parcelada, marque a opção "Parcelado" para o sistema projetar os gastos nos meses seguintes.</p>
        `
      },
      {
        id: 'recorrentes',
        title: 'Contas Fixas (Recorrentes)',
        content: `
          <p>Contas que chegam todo mês (Aluguel, Internet, Netflix) devem ir para a aba <strong>Recorrentes</strong>.</p>
          <p class="mt-2">Isso permite que o sistema calcule seu "Custo de Vida Fixo" e mostre quanto sobra do seu salário antes mesmo de você gastar.</p>
        `
      },
      {
        id: 'transferencias',
        title: 'Realocando Recursos (Transferências)',
        content: `
          <p>Mudança de planos faz parte da estratégia. Você pode transferir valores entre suas Metas e sua Reserva de Emergência.</p>
          <ol class="list-decimal list-inside space-y-2 mt-2 ml-1">
            <li>Vá até a aba <strong>Planejamento</strong>.</li>
            <li>Na seção de Metas, clique no botão <strong>Transferir Valores</strong>.</li>
            <li>Escolha a <strong>Origem</strong> (de onde o dinheiro sai) e o <strong>Destino</strong> (para onde ele vai).</li>
          </ol>
          <p class="mt-2">O sistema garante que todas as transferências fiquem registradas no histórico para você não perder o controle.</p>
        `
      },
      {
        id: 'dashboard',
        title: 'Entendendo o Dashboard',
        content: `
          <p>O Dashboard é seu painel de comando. Entenda os indicadores:</p>
          <ul class="list-disc list-inside space-y-2 mt-2 ml-1">
            <li><strong>Saldo Restante:</strong> Quanto você ainda pode gastar neste mês sem ferir seus investimentos. Se estiver negativo, cuidado!</li>
            <li><strong>Ouro Guardado:</strong> Quanto você já acumulou em Reserva e Metas.</li>
            <li><strong>Gráfico de Orçamento:</strong> Mostra visualmente se seus gastos estão comendo sua capacidade de poupança.</li>
          </ul>
        `
      }
    ]
  },
  {
    id: 'seguranca',
    title: 'Segurança e Privacidade',
    articles: [
      {
        id: 'modo-privacidade',
        title: 'Modo Privacidade',
        content: `
          <p>Vai abrir o Babilon em público? Clique no ícone de <strong>Olho</strong> no topo da tela.</p>
          <p class="mt-2">Isso oculta todos os valores monetários (substituindo por ••••) e neutraliza as cores de alerta, permitindo que você navegue sem expor seus dados financeiros para quem está ao lado.</p>
        `
      },
      {
        id: 'criptografia',
        title: 'Proteção de Dados',
        content: `
          <p>Seus dados são protegidos por criptografia de ponta a ponta via HTTPS.</p>
          <p>Além disso, utilizamos <strong>Row Level Security (RLS)</strong> no banco de dados, o que significa que é fisicamente impossível um usuário acessar os dados de outro. Sua conta é um cofre isolado.</p>
        `
      }
    ]
  }
]
