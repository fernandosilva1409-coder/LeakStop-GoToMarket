// Real release history, grouped from the actual commit log — rewritten in
// plain, user-facing language rather than raw commit messages. PT only for
// now (an admin/internal-facing page, not customer marketing copy); ask
// before translating if that turns out to matter.
export const CHANGELOG = [
  {
    version: "0.11.0",
    date: "2026-08-23",
    entries: [
      "Gráficos com várias cores em vez de uma só — mais fácil distinguir ingredientes, categorias e condições num relance.",
      "Novo filtro de período (30 dias / 90 dias / 1 ano / tudo) na página Tempo.",
      "No Dashboard, o gráfico de desperdício ganhou um seletor de métrica (custo/quantidade) e de quantidade a mostrar (top 5/10/todos), e o separador Rentabilidade ganhou um gráfico de receita por categoria.",
      "Recomendações ganhou um resumo visual da matriz Estrela/Cavalo de batalha/Enigma/Fraco desempenho.",
      "Vendas e Compras ganharam um gráfico de tendência mensal no topo da página.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-08-23",
    entries: [
      "Nova página \"Tempo\" no menu: impacto do tempo nas vendas, gráficos por condição meteorológica e por temperatura, pratos mais sensíveis ao tempo, e previsão dos próximos 7 dias com comparação face à tua média histórica.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-08-23",
    entries: [
      "Nova pergunta possível no Chat with Your Data: como é que o tempo (chuva, sol, frio) afeta as tuas vendas — basta configurar a cidade do restaurante em Definições.",
      "Definições ganhou um novo campo para a localização do restaurante, usado para associar dados meteorológicos históricos às vendas.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-08-23",
    entries: [
      "Novo separador \"Categorias\" em Definições: podes excluir uma categoria do menu (ex: bebidas, garrafas) dos cálculos de margem e lucro — útil quando o modelo de custo por prato não faz sentido para esse tipo de item. As vendas e o desperdício de ingredientes continuam a ser contabilizados na mesma.",
      "O Dashboard passou a ter separadores (Visão Geral / Desperdício / Rentabilidade) em vez de uma única página com tudo empilhado.",
      "O sidebar já não some a barra separadora do botão \"Sair\" em telemóvel.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-08-20",
    entries: [
      "Novo Chat de Suporte para tirar dúvidas sobre como usar a aplicação — importar CSVs, calcular margens, o que faz cada página.",
      "Definições agora mostra o nome do restaurante e o número da versão, e liga diretamente ao Chat de Suporte para pedidos de integração.",
      "Este changelog.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-08-20",
    entries: [
      "Corrigido um bug importante: vendas e compras acima de 1000 registos estavam a ser cortadas silenciosamente, afetando todos os cálculos de margem, desperdício e receita.",
      "O Chat with Your Data passou a distinguir corretamente lucro de receita (a categoria com mais receita nem sempre é a mais lucrativa), e a mostrar sempre os dois extremos (melhor e pior margem) quando pedido.",
      "Perguntas sobre crescimento respondem agora em receita, não apenas em unidades vendidas.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-08-20",
    entries: [
      "Nova página Análises: fixa gráficos e KPIs a partir de respostas do chat, para consulta permanente.",
      "O chat passou a mostrar o gráfico diretamente na conversa, sem ser preciso fixar primeiro.",
      "Perguntas rápidas sugeridas no Chat with Your Data.",
      "O histórico do chat passa a ficar guardado entre sessões e dispositivos.",
      "Novas capacidades do chat: comparações por semana, por mês, por categoria de prato, e por dia da semana.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-08-20",
    entries: [
      "Dashboard e Recomendações completamente reformulados: KPIs, gráfico de ingredientes com mais desperdício, tabela de rentabilidade por prato, e a matriz de classificação Star / Plowhorse / Puzzle / Dog.",
      "Várias correções de legibilidade e de formatação de números nas tabelas.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-08-18",
    entries: [
      "Novo assistente Chat with Your Data, para fazer perguntas sobre os teus próprios números — vendas, compras, margens, desperdício.",
      "Novo visual em toda a aplicação: barra lateral e tema claro.",
      "Barra de progresso ao importar ficheiros CSV, com deteção de linhas inválidas que antes falhavam sem aviso.",
      "Página inicial redesenhada, com foco claro em restaurantes.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-08-17",
    entries: [
      "Aplicação totalmente traduzida para português, inglês, alemão, francês e espanhol.",
      "Importação de ficheiros CSV para Compras e Vendas, com modelos prontos a descarregar.",
      "Período de teste gratuito de 5 dias com subscrição real via Stripe.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-08-15",
    entries: [
      "Lançamento do LeakStop: registo de restaurante, menu, compras, vendas e overhead.",
      "Recuperação de password.",
      "Página inicial em vários idiomas.",
    ],
  },
];
