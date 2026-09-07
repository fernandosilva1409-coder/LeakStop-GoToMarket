// Real release history, grouped from the actual commit log — rewritten in
// plain, user-facing language rather than raw commit messages. PT only for
// now (an admin/internal-facing page, not customer marketing copy); ask
// before translating if that turns out to matter.
export const CHANGELOG = [
  {
    version: "0.18.0",
    date: "2026-09-07",
    entries: [
      "Novo botão \"Porque está o overhead assim?\" no separador Rentabilidade do Dashboard — a IA (Claude) explica em linguagem simples, com os teus números reais, porque é que o overhead por prato está alto (ex: volume de vendas baixo face ao overhead configurado), e sugere o que rever.",
    ],
  },
  {
    version: "0.17.1",
    date: "2026-08-31",
    entries: [
      "A coluna \"Ficheiro\" em Compras/Vendas passou a mostrar também o nome do ficheiro nas importações por CSV, não só nas por PDF.",
    ],
  },
  {
    version: "0.17.0",
    date: "2026-08-31",
    entries: [
      "Nova importação de PDFs em Compras e Vendas: sobe a fatura ou o relatório de vendas e a IA (Claude) extrai as linhas automaticamente, com uma pré-visualização editável antes de confirmares — nada é gravado sem a tua aprovação.",
      "Podes importar vários PDFs de uma vez; linhas parecidas com compras/vendas já registadas ficam assinaladas como possível duplicado, e reimportar o mesmo ficheiro é ignorado automaticamente.",
      "Cada linha importada por PDF guarda o nome do ficheiro de origem, visível na lista de Compras/Vendas.",
      "Corrigido: mudar de separador (CSV/PDF) ou de página a meio de uma importação de PDF perdia o trabalho em curso sem aviso — agora pede confirmação antes de saíres.",
    ],
  },
  {
    version: "0.16.0",
    date: "2026-08-23",
    entries: [
      "Página principal renovada: nova secção destacando a IA (Claude, da Anthropic) por trás do Chat with Your Data e da Proposta da semana do Tempo, com fundo escuro e distintivo \"Powered by Claude\".",
      "Os exemplos visuais (menu, compras, overhead, recomendações, chat, tempo) na página principal deixaram de estar sempre em português — agora traduzem consoante o idioma escolhido, nas 5 línguas.",
      "Corrigido o texto de preço na página principal: dizia \"restaurantes ilimitados por conta\", mas a subscrição é (e sempre foi) por localização de restaurante — o texto agora reflete isso.",
    ],
  },
  {
    version: "0.15.2",
    date: "2026-08-23",
    entries: [
      "O filtro de categoria da página Tempo passou a aparecer também junto à previsão dos próximos dias, não só na lista de pratos sensíveis — as duas secções continuam sincronizadas.",
    ],
  },
  {
    version: "0.15.1",
    date: "2026-08-23",
    entries: [
      "Página Tempo: a lista de pratos sensíveis ao tempo e as sugestões da previsão já não misturam bebidas/garrafas com comida — passam a respeitar as categorias que excluíste em Definições, e ganharam um filtro por categoria para veres só Entradas, Carne, Peixe ou Sobremesas, por exemplo. A Proposta da semana (IA) também deixou de sugerir bebidas.",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-08-23",
    entries: [
      "Trabalho de performance para restaurantes com muito histórico: o cálculo do Dashboard/Recomendações/Chat passou a ficar guardado no servidor (atualiza-se sozinho sempre que registas uma venda, compra, prato ou alteras o overhead — nunca fica desatualizado), a paginação de dados ficou ~10x mais rápida, e uma consulta interna deixou de varrer dados de outros restaurantes por engano.",
    ],
  },
  {
    version: "0.14.1",
    date: "2026-08-23",
    entries: [
      "Corrigido um crash em Dashboard/Recomendações/Chat para restaurantes com muitos anos de vendas registadas (a partir de dezenas de milhares de linhas).",
      "Corrigido: dois pratos do menu com exatamente o mesmo nome faziam as vendas serem contadas em dobro, inflacionando ligeiramente o overhead por prato de todos os outros pratos.",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-08-23",
    entries: [
      "Página principal (leakstop.pt) atualizada: agora apresenta o Chat with Your Data e a Proposta da semana (Tempo + IA), com uma mensagem mais direta sobre o que o LeakStop faz.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-08-23",
    entries: [
      "Nova \"Proposta da semana\" na página Tempo: um resumo escrito pela IA que interpreta o histórico de tempo, os pratos mais sensíveis e a previsão dos próximos 7 dias, com sugestões concretas — atualizado uma vez por dia.",
      "Corrigido: mudar a localização do restaurante em Definições agora limpa o histórico de tempo em cache da localização antiga, para não misturar dados de duas cidades diferentes.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-08-23",
    entries: [
      "Dashboard ganhou um filtro de período (30 dias / 90 dias / 1 ano / tudo), aplicado a todos os separadores.",
      "Gráficos com muitas barras no Chat with Your Data e na página Análises ganharam um seletor Top 5 / Top 10 / Todos.",
      "Na página Tempo, dias de previsão com um tipo de tempo raro no teu histórico (ex: trovoada) passam a mostrar uma estimativa baseada na temperatura em vez de ficarem sem nenhuma informação.",
    ],
  },
  {
    version: "0.11.1",
    date: "2026-08-23",
    entries: [
      "Corrigido um bug visual nos gráficos novos: valores muito grandes e sem arredondar (ex: custo de desperdício) faziam o eixo mostrar números sem sentido, tipo \"137310775\" em vez de \"1806,74\". Não era um erro nos teus dados — só na forma como o gráfico os desenhava.",
      "Na página Tempo, os símbolos ↑/↓ nos cartões de previsão passaram a ter uma legenda visível (Destacar / Reduzir), para não haver dúvidas sobre o que cada um significa.",
    ],
  },
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
