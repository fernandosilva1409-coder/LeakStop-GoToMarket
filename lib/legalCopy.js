// i18n for the legal pages (Terms of Service, Privacy Policy). These documents
// are governed by Portuguese law (see terms section 10) — non-PT versions are
// convenience translations, flagged as such via `translationNotice`.

export const LEGAL_COPY = {
  pt: {
    common: {
      back: "← Voltar", lastUpdated: "Última atualização: 15 de agosto de 2026",
      draftWarning: "Rascunho de partida com dados fiscais provisórios — a atualizar com os dados definitivos antes do lançamento comercial, e a rever por um advogado.",
      translationNotice: null,
    },
    terms: {
      title: "Termos de Serviço",
      sections: [
        { title: "1. Identificação do prestador de serviço", body: ["O serviço LeakStop é prestado por Fernando Miguel dos Santos Silva, empresário em nome individual, NIF [A PREENCHER], com morada fiscal em [A PREENCHER], doravante \"LeakStop\" ou \"nós\". Contacto: [EMAIL A PREENCHER]."] },
        { title: "2. Objeto do serviço", body: ["O LeakStop é uma aplicação web (SaaS) que permite a restaurantes registar o seu menu, compras, vendas e custos fixos, e obter análises de desperdício, margem por prato e recomendações de engenharia de menu com base nos dados introduzidos pelo próprio utilizador."] },
        { title: "3. Registo e conta", body: ["Para usar o LeakStop é necessário criar uma conta com email e palavra-passe. É responsável por manter a confidencialidade das suas credenciais e por toda a atividade realizada na sua conta. Deve fornecer informação verdadeira e mantê-la atualizada."] },
        { title: "4. Preço e faturação", body: ["O acesso ao LeakStop tem o custo de 49€/mês, IVA incluído, cobrado de forma recorrente através da Stripe. O pagamento é processado diretamente pela Stripe — o LeakStop não armazena dados de cartão. A fatura correspondente é emitida manualmente pelo prestador de serviço após cada cobrança."] },
        { title: "5. Duração e cancelamento", body: [
          "Novas contas incluem um período de teste gratuito de 5 dias, durante o qual é pedido um cartão de pagamento válido no momento do registo. Se não cancelares antes do final do período de teste, a subscrição é automaticamente cobrada ao cartão indicado, ao preço em vigor (49€/mês, IVA incluído).",
          "Após o período de teste, a subscrição é mensal, sem período de fidelização, e renova-se automaticamente até ser cancelada. Podes cancelar a qualquer momento através da opção \"Gerir subscrição\" no painel — o acesso mantém-se ativo até ao final do período já pago (ou até ao final do teste gratuito, se cancelares durante o mesmo), sem reembolso proporcional.",
        ] },
        { title: "6. Obrigações do utilizador", body: ["Compromete-se a usar o LeakStop apenas para fins lícitos, a não partilhar as suas credenciais de acesso com terceiros não autorizados, e a não tentar aceder a dados de outros restaurantes ou contornar as medidas de segurança da aplicação."] },
        { title: "7. Limitação de responsabilidade", body: ["As análises, margens e recomendações apresentadas resultam de cálculos automáticos sobre os dados introduzidos pelo utilizador — a sua exatidão depende da exatidão desses dados. O LeakStop não se responsabiliza por decisões de gestão tomadas com base nestas análises, nem garante disponibilidade ininterrupta do serviço."] },
        { title: "8. Proteção de dados", link: { pre: "O tratamento de dados pessoais está descrito na nossa", post: "." } },
        { title: "9. Alterações aos termos", body: ["Podemos atualizar estes Termos ocasionalmente. Alterações materiais serão comunicadas por email ou através de aviso no painel antes de entrarem em vigor."] },
        { title: "10. Lei aplicável", body: ["Estes Termos regem-se pela lei portuguesa. Para qualquer litígio, é competente o foro da comarca da morada fiscal do prestador de serviço, sem prejuízo dos direitos do consumidor."] },
        { title: "11. Contacto", body: ["Para questões sobre estes Termos: [EMAIL A PREENCHER]."] },
      ],
    },
    privacy: {
      title: "Política de Privacidade",
      sections: [
        { title: "1. Responsável pelo tratamento", body: ["Fernando Miguel dos Santos Silva, empresário em nome individual, NIF [A PREENCHER], com morada fiscal em [A PREENCHER], é o responsável pelo tratamento dos dados pessoais recolhidos através do LeakStop. Contacto para questões de proteção de dados: [EMAIL A PREENCHER]."] },
        { title: "2. Que dados recolhemos", items: [
          ["Dados de conta:", "email e palavra-passe (a palavra-passe é gerida de forma encriptada pela Supabase, nunca vemos nem armazenamos a palavra-passe em texto simples)."],
          ["Dados do restaurante:", "nome, moeda, menu, ingredientes, compras, vendas e custos fixos que introduz na aplicação."],
          ["Dados de faturação:", "a Stripe processa e armazena os dados do cartão de pagamento diretamente — o LeakStop nunca tem acesso ao número do cartão. Guardamos apenas o identificador de cliente e de subscrição da Stripe, e o estado da subscrição."],
          ["Dados técnicos:", "registos de acesso e erros gerados automaticamente pela infraestrutura (Supabase, Fly.io), para efeitos de segurança e diagnóstico."],
        ] },
        { title: "3. Finalidade e base legal", body: ["Tratamos estes dados para prestar o serviço contratado (execução do contrato — art. 6.º/1/b do RGPD), para faturação e cumprimento de obrigações fiscais (obrigação legal — art. 6.º/1/c), e para comunicações de suporte relacionadas com a sua conta (interesse legítimo — art. 6.º/1/f)."] },
        { title: "4. Com quem partilhamos os dados", itemSep: " — ", intro: "Os seus dados são partilhados apenas com os subcontratantes necessários para operar o serviço:", items: [
          ["Supabase", "base de dados e autenticação."],
          ["Stripe", "processamento de pagamentos."],
          ["Fly.io", "alojamento da aplicação."],
        ], outro: "Não vendemos nem partilhamos os seus dados com terceiros para fins de marketing." },
        { title: "5. Transferências internacionais", body: ["Alguns destes subcontratantes podem processar dados fora do Espaço Económico Europeu. Nesses casos, a transferência é feita ao abrigo de Cláusulas Contratuais-Tipo aprovadas pela Comissão Europeia ou mecanismo equivalente."] },
        { title: "6. Prazo de conservação", body: ["Conservamos os seus dados enquanto a conta estiver ativa. Após o cancelamento da conta, os dados são conservados pelo prazo legal aplicável a obrigações fiscais e contabilísticas, findo o qual são eliminados ou anonimizados."] },
        { title: "7. Os seus direitos", body: ["Nos termos do RGPD, tem direito a aceder, retificar, apagar, limitar ou opor-se ao tratamento dos seus dados, e a portabilidade dos mesmos. Pode exercer estes direitos contactando [EMAIL A PREENCHER]. Tem também o direito de apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD)."] },
        { title: "8. Segurança", body: ["O acesso aos dados de cada restaurante é isolado ao nível da base de dados através de Row Level Security — um utilizador só consegue ler ou escrever dados dos restaurantes a que pertence. Ligações à aplicação são feitas por HTTPS."] },
        { title: "9. Cookies", body: ["Usamos apenas cookies essenciais ao funcionamento da aplicação (manter a sessão autenticada). Não usamos cookies de publicidade ou rastreio de terceiros."] },
        { title: "10. Alterações a esta política", body: ["Podemos atualizar esta política ocasionalmente. Alterações materiais serão comunicadas por email ou através de aviso no painel antes de entrarem em vigor."] },
        { title: "11. Contacto", body: ["Para questões sobre esta política: [EMAIL A PREENCHER]."] },
      ],
    },
  },
  en: {
    common: {
      back: "← Back", lastUpdated: "Last updated: August 15, 2026",
      draftWarning: "Starting draft with provisional tax details — to be updated with final details before commercial launch, and reviewed by a lawyer.",
      translationNotice: "This page is a convenience translation. In case of any discrepancy, the Portuguese version is the legally binding one.",
    },
    terms: {
      title: "Terms of Service",
      sections: [
        { title: "1. Service provider identification", body: ["The LeakStop service is provided by Fernando Miguel dos Santos Silva, sole trader, Tax ID [TO BE COMPLETED], with registered tax address at [TO BE COMPLETED], hereinafter \"LeakStop\" or \"we\". Contact: [EMAIL TO BE COMPLETED]."] },
        { title: "2. Purpose of the service", body: ["LeakStop is a web application (SaaS) that lets restaurants record their menu, purchases, sales and fixed costs, and get waste analysis, per-dish margin, and menu engineering recommendations based on the data entered by the user."] },
        { title: "3. Registration and account", body: ["Using LeakStop requires creating an account with an email and password. You are responsible for keeping your credentials confidential and for all activity carried out on your account. You must provide truthful information and keep it up to date."] },
        { title: "4. Price and billing", body: ["Access to LeakStop costs €49/month, VAT included, charged on a recurring basis through Stripe. Payment is processed directly by Stripe — LeakStop does not store card data. The corresponding invoice is issued manually by the service provider after each charge."] },
        { title: "5. Duration and cancellation", body: [
          "New accounts include a free 5-day trial period, during which a valid payment card is requested at sign-up. If you don't cancel before the trial ends, the subscription is automatically charged to the card provided, at the price then in effect (€49/month, VAT included).",
          "After the trial, the subscription is monthly, with no minimum commitment, and renews automatically until cancelled. You can cancel at any time through the \"Manage subscription\" option in the dashboard — access remains active until the end of the period already paid for (or until the end of the free trial, if you cancel during it), with no pro-rata refund.",
        ] },
        { title: "6. User obligations", body: ["You agree to use LeakStop only for lawful purposes, not to share your login credentials with unauthorized third parties, and not to attempt to access other restaurants' data or bypass the application's security measures."] },
        { title: "7. Limitation of liability", body: ["The analyses, margins and recommendations shown result from automatic calculations based on the data entered by the user — their accuracy depends on the accuracy of that data. LeakStop is not liable for management decisions made based on these analyses, nor does it guarantee uninterrupted availability of the service."] },
        { title: "8. Data protection", link: { pre: "The processing of personal data is described in our", post: "." } },
        { title: "9. Changes to these terms", body: ["We may update these Terms from time to time. Material changes will be communicated by email or via a notice in the dashboard before they take effect."] },
        { title: "10. Governing law", body: ["These Terms are governed by Portuguese law. For any dispute, the courts of the district of the service provider's tax address have jurisdiction, without prejudice to consumer rights."] },
        { title: "11. Contact", body: ["For questions about these Terms: [EMAIL TO BE COMPLETED]."] },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      sections: [
        { title: "1. Data controller", body: ["Fernando Miguel dos Santos Silva, sole trader, Tax ID [TO BE COMPLETED], with registered tax address at [TO BE COMPLETED], is the controller responsible for the personal data collected through LeakStop. Contact for data protection questions: [EMAIL TO BE COMPLETED]."] },
        { title: "2. What data we collect", items: [
          ["Account data:", "email and password (the password is managed in encrypted form by Supabase — we never see or store the password in plain text)."],
          ["Restaurant data:", "name, currency, menu, ingredients, purchases, sales and fixed costs that you enter into the application."],
          ["Billing data:", "Stripe processes and stores payment card data directly — LeakStop never has access to the card number. We only store the Stripe customer and subscription identifiers, and the subscription status."],
          ["Technical data:", "access and error logs automatically generated by the infrastructure (Supabase, Fly.io), for security and diagnostic purposes."],
        ] },
        { title: "3. Purpose and legal basis", body: ["We process this data to provide the contracted service (performance of a contract — GDPR art. 6(1)(b)), for billing and compliance with tax obligations (legal obligation — art. 6(1)(c)), and for support communications related to your account (legitimate interest — art. 6(1)(f))."] },
        { title: "4. Who we share data with", itemSep: " — ", intro: "Your data is shared only with the subprocessors necessary to operate the service:", items: [
          ["Supabase", "database and authentication."],
          ["Stripe", "payment processing."],
          ["Fly.io", "application hosting."],
        ], outro: "We do not sell or share your data with third parties for marketing purposes." },
        { title: "5. International transfers", body: ["Some of these subprocessors may process data outside the European Economic Area. In those cases, the transfer is carried out under Standard Contractual Clauses approved by the European Commission or an equivalent mechanism."] },
        { title: "6. Retention period", body: ["We retain your data for as long as the account is active. After the account is cancelled, data is retained for the legal period applicable to tax and accounting obligations, after which it is deleted or anonymized."] },
        { title: "7. Your rights", body: ["Under the GDPR, you have the right to access, rectify, erase, restrict or object to the processing of your data, and to data portability. You can exercise these rights by contacting [EMAIL TO BE COMPLETED]. You also have the right to lodge a complaint with the Portuguese data protection authority (CNPD)."] },
        { title: "8. Security", body: ["Access to each restaurant's data is isolated at the database level via Row Level Security — a user can only read or write data for the restaurants they belong to. Connections to the application are made over HTTPS."] },
        { title: "9. Cookies", body: ["We only use cookies that are essential for the application to work (keeping you signed in). We do not use advertising or third-party tracking cookies."] },
        { title: "10. Changes to this policy", body: ["We may update this policy from time to time. Material changes will be communicated by email or via a notice in the dashboard before they take effect."] },
        { title: "11. Contact", body: ["For questions about this policy: [EMAIL TO BE COMPLETED]."] },
      ],
    },
  },
  de: {
    common: {
      back: "← Zurück", lastUpdated: "Zuletzt aktualisiert: 15. August 2026",
      draftWarning: "Erster Entwurf mit vorläufigen Steuerdaten — vor dem kommerziellen Start mit den endgültigen Daten zu aktualisieren und von einem Anwalt zu prüfen.",
      translationNotice: "Diese Seite ist eine Übersetzung zur Orientierung. Bei Abweichungen ist die portugiesische Fassung rechtsverbindlich.",
    },
    terms: {
      title: "Nutzungsbedingungen",
      sections: [
        { title: "1. Angaben zum Dienstanbieter", body: ["Der Dienst LeakStop wird von Fernando Miguel dos Santos Silva, Einzelunternehmer, Steuernummer [AUSZUFÜLLEN], mit Steueranschrift in [AUSZUFÜLLEN], im Folgenden „LeakStop\" oder „wir\", erbracht. Kontakt: [E-MAIL AUSZUFÜLLEN]."] },
        { title: "2. Gegenstand der Dienstleistung", body: ["LeakStop ist eine Webanwendung (SaaS), mit der Restaurants ihr Menü, ihre Einkäufe, Verkäufe und Fixkosten erfassen und auf Basis der eingegebenen Daten Verschwendungsanalysen, Margen pro Gericht und Empfehlungen zum Menü-Engineering erhalten können."] },
        { title: "3. Registrierung und Konto", body: ["Die Nutzung von LeakStop erfordert die Erstellung eines Kontos mit E-Mail und Passwort. Du bist für die Vertraulichkeit deiner Zugangsdaten und für alle über dein Konto durchgeführten Aktivitäten verantwortlich. Du musst wahrheitsgemäße Angaben machen und diese aktuell halten."] },
        { title: "4. Preis und Abrechnung", body: ["Der Zugang zu LeakStop kostet 49 €/Monat, inkl. MwSt., und wird wiederkehrend über Stripe abgerechnet. Die Zahlung wird direkt von Stripe verarbeitet — LeakStop speichert keine Kartendaten. Die entsprechende Rechnung wird nach jeder Abbuchung manuell vom Dienstanbieter ausgestellt."] },
        { title: "5. Laufzeit und Kündigung", body: [
          "Neue Konten enthalten eine kostenlose 5-tägige Testphase, für die bei der Registrierung eine gültige Zahlungskarte verlangt wird. Wenn du nicht vor Ablauf der Testphase kündigst, wird das Abonnement automatisch der angegebenen Karte zum dann geltenden Preis (49 €/Monat, inkl. MwSt.) belastet.",
          "Nach der Testphase ist das Abonnement monatlich, ohne Mindestlaufzeit, und verlängert sich automatisch bis zur Kündigung. Du kannst jederzeit über die Option „Abo verwalten\" im Dashboard kündigen — der Zugang bleibt bis zum Ende des bereits bezahlten Zeitraums aktiv (oder bis zum Ende der kostenlosen Testphase, falls du während dieser kündigst), ohne anteilige Rückerstattung.",
        ] },
        { title: "6. Pflichten des Nutzers", body: ["Du verpflichtest dich, LeakStop nur für rechtmäßige Zwecke zu nutzen, deine Zugangsdaten nicht an unbefugte Dritte weiterzugeben und nicht zu versuchen, auf Daten anderer Restaurants zuzugreifen oder die Sicherheitsmaßnahmen der Anwendung zu umgehen."] },
        { title: "7. Haftungsbeschränkung", body: ["Die angezeigten Analysen, Margen und Empfehlungen ergeben sich aus automatischen Berechnungen auf Basis der vom Nutzer eingegebenen Daten — ihre Genauigkeit hängt von der Genauigkeit dieser Daten ab. LeakStop haftet nicht für Managemententscheidungen, die auf Basis dieser Analysen getroffen werden, und garantiert keine unterbrechungsfreie Verfügbarkeit des Dienstes."] },
        { title: "8. Datenschutz", link: { pre: "Die Verarbeitung personenbezogener Daten ist in unserer", post: " beschrieben." } },
        { title: "9. Änderungen dieser Bedingungen", body: ["Wir können diese Bedingungen gelegentlich aktualisieren. Wesentliche Änderungen werden per E-Mail oder durch einen Hinweis im Dashboard mitgeteilt, bevor sie in Kraft treten."] },
        { title: "10. Anwendbares Recht", body: ["Diese Bedingungen unterliegen portugiesischem Recht. Für Streitigkeiten ist das Gericht des Bezirks der Steueranschrift des Dienstanbieters zuständig, unbeschadet der Verbraucherrechte."] },
        { title: "11. Kontakt", body: ["Bei Fragen zu diesen Bedingungen: [E-MAIL AUSZUFÜLLEN]."] },
      ],
    },
    privacy: {
      title: "Datenschutzerklärung",
      sections: [
        { title: "1. Verantwortlicher für die Verarbeitung", body: ["Fernando Miguel dos Santos Silva, Einzelunternehmer, Steuernummer [AUSZUFÜLLEN], mit Steueranschrift in [AUSZUFÜLLEN], ist der Verantwortliche für die über LeakStop erhobenen personenbezogenen Daten. Kontakt für Datenschutzfragen: [E-MAIL AUSZUFÜLLEN]."] },
        { title: "2. Welche Daten wir erheben", items: [
          ["Kontodaten:", "E-Mail und Passwort (das Passwort wird von Supabase verschlüsselt verwaltet — wir sehen oder speichern das Passwort niemals im Klartext)."],
          ["Restaurantdaten:", "Name, Währung, Menü, Zutaten, Einkäufe, Verkäufe und Fixkosten, die du in der Anwendung eingibst."],
          ["Abrechnungsdaten:", "Stripe verarbeitet und speichert die Zahlungskartendaten direkt — LeakStop hat niemals Zugriff auf die Kartennummer. Wir speichern nur die Stripe-Kunden- und Abo-Kennung sowie den Abo-Status."],
          ["Technische Daten:", "automatisch von der Infrastruktur (Supabase, Fly.io) erzeugte Zugriffs- und Fehlerprotokolle, zu Sicherheits- und Diagnosezwecken."],
        ] },
        { title: "3. Zweck und Rechtsgrundlage", body: ["Wir verarbeiten diese Daten, um den vertraglich vereinbarten Dienst zu erbringen (Vertragserfüllung — DSGVO Art. 6 Abs. 1 lit. b), für die Abrechnung und die Erfüllung steuerlicher Pflichten (rechtliche Verpflichtung — Art. 6 Abs. 1 lit. c) sowie für Support-Kommunikation im Zusammenhang mit deinem Konto (berechtigtes Interesse — Art. 6 Abs. 1 lit. f)."] },
        { title: "4. Mit wem wir Daten teilen", itemSep: " — ", intro: "Deine Daten werden nur mit den für den Betrieb des Dienstes notwendigen Auftragsverarbeitern geteilt:", items: [
          ["Supabase", "Datenbank und Authentifizierung."],
          ["Stripe", "Zahlungsabwicklung."],
          ["Fly.io", "Hosting der Anwendung."],
        ], outro: "Wir verkaufen oder teilen deine Daten nicht mit Dritten zu Marketingzwecken." },
        { title: "5. Internationale Datenübermittlungen", body: ["Einige dieser Auftragsverarbeiter können Daten außerhalb des Europäischen Wirtschaftsraums verarbeiten. In diesen Fällen erfolgt die Übermittlung auf Grundlage von der Europäischen Kommission genehmigter Standardvertragsklauseln oder eines gleichwertigen Mechanismus."] },
        { title: "6. Aufbewahrungsdauer", body: ["Wir bewahren deine Daten auf, solange das Konto aktiv ist. Nach Kündigung des Kontos werden die Daten für den gesetzlich vorgeschriebenen Zeitraum für steuerliche und buchhalterische Pflichten aufbewahrt und anschließend gelöscht oder anonymisiert."] },
        { title: "7. Deine Rechte", body: ["Gemäß der DSGVO hast du das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung oder Widerspruch gegen die Verarbeitung deiner Daten sowie auf Datenübertragbarkeit. Du kannst diese Rechte ausüben, indem du [E-MAIL AUSZUFÜLLEN] kontaktierst. Du hast außerdem das Recht, Beschwerde bei der portugiesischen Datenschutzbehörde (CNPD) einzureichen."] },
        { title: "8. Sicherheit", body: ["Der Zugriff auf die Daten jedes Restaurants ist auf Datenbankebene durch Row Level Security isoliert — ein Nutzer kann nur Daten der Restaurants lesen oder schreiben, denen er angehört. Verbindungen zur Anwendung erfolgen über HTTPS."] },
        { title: "9. Cookies", body: ["Wir verwenden nur Cookies, die für den Betrieb der Anwendung erforderlich sind (Aufrechterhaltung der angemeldeten Sitzung). Wir verwenden keine Werbe- oder Tracking-Cookies von Drittanbietern."] },
        { title: "10. Änderungen dieser Richtlinie", body: ["Wir können diese Richtlinie gelegentlich aktualisieren. Wesentliche Änderungen werden per E-Mail oder durch einen Hinweis im Dashboard mitgeteilt, bevor sie in Kraft treten."] },
        { title: "11. Kontakt", body: ["Bei Fragen zu dieser Richtlinie: [E-MAIL AUSZUFÜLLEN]."] },
      ],
    },
  },
  fr: {
    common: {
      back: "← Retour", lastUpdated: "Dernière mise à jour : 15 août 2026",
      draftWarning: "Brouillon de départ avec des données fiscales provisoires — à mettre à jour avec les données définitives avant le lancement commercial, et à faire relire par un avocat.",
      translationNotice: "Cette page est une traduction fournie à titre indicatif. En cas de divergence, la version portugaise fait foi.",
    },
    terms: {
      title: "Conditions d'utilisation",
      sections: [
        { title: "1. Identification du prestataire de services", body: ["Le service LeakStop est fourni par Fernando Miguel dos Santos Silva, entrepreneur individuel, numéro fiscal [À COMPLÉTER], avec adresse fiscale à [À COMPLÉTER], ci-après « LeakStop » ou « nous ». Contact : [EMAIL À COMPLÉTER]."] },
        { title: "2. Objet du service", body: ["LeakStop est une application web (SaaS) qui permet aux restaurants d'enregistrer leur menu, leurs achats, leurs ventes et leurs coûts fixes, et d'obtenir des analyses de gaspillage, la marge par plat et des recommandations d'ingénierie de menu à partir des données saisies par l'utilisateur."] },
        { title: "3. Inscription et compte", body: ["L'utilisation de LeakStop nécessite la création d'un compte avec un email et un mot de passe. Tu es responsable de la confidentialité de tes identifiants et de toute activité réalisée sur ton compte. Tu dois fournir des informations exactes et les tenir à jour."] },
        { title: "4. Prix et facturation", body: ["L'accès à LeakStop coûte 49 €/mois, TVA incluse, facturé de manière récurrente via Stripe. Le paiement est traité directement par Stripe — LeakStop ne stocke aucune donnée de carte. La facture correspondante est émise manuellement par le prestataire après chaque prélèvement."] },
        { title: "5. Durée et résiliation", body: [
          "Les nouveaux comptes incluent une période d'essai gratuite de 5 jours, durant laquelle une carte de paiement valide est demandée lors de l'inscription. Si tu n'annules pas avant la fin de la période d'essai, l'abonnement est automatiquement débité sur la carte indiquée, au prix en vigueur (49 €/mois, TVA incluse).",
          "Après la période d'essai, l'abonnement est mensuel, sans engagement de durée, et se renouvelle automatiquement jusqu'à résiliation. Tu peux annuler à tout moment via l'option « Gérer l'abonnement » du tableau de bord — l'accès reste actif jusqu'à la fin de la période déjà payée (ou jusqu'à la fin de l'essai gratuit, si tu annules pendant celui-ci), sans remboursement au prorata.",
        ] },
        { title: "6. Obligations de l'utilisateur", body: ["Tu t'engages à utiliser LeakStop uniquement à des fins licites, à ne pas partager tes identifiants avec des tiers non autorisés, et à ne pas tenter d'accéder aux données d'autres restaurants ni de contourner les mesures de sécurité de l'application."] },
        { title: "7. Limitation de responsabilité", body: ["Les analyses, marges et recommandations présentées résultent de calculs automatiques effectués à partir des données saisies par l'utilisateur — leur exactitude dépend de l'exactitude de ces données. LeakStop n'est pas responsable des décisions de gestion prises sur la base de ces analyses, et ne garantit pas une disponibilité ininterrompue du service."] },
        { title: "8. Protection des données", link: { pre: "Le traitement des données personnelles est décrit dans notre", post: "." } },
        { title: "9. Modifications des présentes conditions", body: ["Nous pouvons mettre à jour ces Conditions occasionnellement. Les modifications importantes seront communiquées par email ou par une notification dans le tableau de bord avant leur entrée en vigueur."] },
        { title: "10. Droit applicable", body: ["Les présentes Conditions sont régies par le droit portugais. Pour tout litige, le tribunal du ressort de l'adresse fiscale du prestataire est compétent, sans préjudice des droits du consommateur."] },
        { title: "11. Contact", body: ["Pour toute question concernant ces Conditions : [EMAIL À COMPLÉTER]."] },
      ],
    },
    privacy: {
      title: "Politique de confidentialité",
      sections: [
        { title: "1. Responsable du traitement", body: ["Fernando Miguel dos Santos Silva, entrepreneur individuel, numéro fiscal [À COMPLÉTER], avec adresse fiscale à [À COMPLÉTER], est le responsable du traitement des données personnelles collectées via LeakStop. Contact pour les questions de protection des données : [EMAIL À COMPLÉTER]."] },
        { title: "2. Quelles données nous collectons", items: [
          ["Données de compte :", "email et mot de passe (le mot de passe est géré de manière chiffrée par Supabase — nous ne voyons ni ne stockons jamais le mot de passe en clair)."],
          ["Données du restaurant :", "nom, devise, menu, ingrédients, achats, ventes et coûts fixes que tu saisis dans l'application."],
          ["Données de facturation :", "Stripe traite et stocke directement les données de carte de paiement — LeakStop n'a jamais accès au numéro de carte. Nous ne conservons que l'identifiant client et d'abonnement Stripe, ainsi que le statut de l'abonnement."],
          ["Données techniques :", "journaux d'accès et d'erreurs générés automatiquement par l'infrastructure (Supabase, Fly.io), à des fins de sécurité et de diagnostic."],
        ] },
        { title: "3. Finalité et base juridique", body: ["Nous traitons ces données pour fournir le service contracté (exécution du contrat — art. 6.1.b du RGPD), pour la facturation et le respect des obligations fiscales (obligation légale — art. 6.1.c), et pour les communications d'assistance liées à ton compte (intérêt légitime — art. 6.1.f)."] },
        { title: "4. Avec qui nous partageons les données", itemSep: " — ", intro: "Tes données sont partagées uniquement avec les sous-traitants nécessaires au fonctionnement du service :", items: [
          ["Supabase", "base de données et authentification."],
          ["Stripe", "traitement des paiements."],
          ["Fly.io", "hébergement de l'application."],
        ], outro: "Nous ne vendons ni ne partageons tes données avec des tiers à des fins marketing." },
        { title: "5. Transferts internationaux", body: ["Certains de ces sous-traitants peuvent traiter des données en dehors de l'Espace économique européen. Dans ce cas, le transfert est effectué sur la base de Clauses Contractuelles Types approuvées par la Commission européenne ou d'un mécanisme équivalent."] },
        { title: "6. Durée de conservation", body: ["Nous conservons tes données tant que le compte est actif. Après la résiliation du compte, les données sont conservées pendant le délai légal applicable aux obligations fiscales et comptables, à l'issue duquel elles sont supprimées ou anonymisées."] },
        { title: "7. Tes droits", body: ["Conformément au RGPD, tu as le droit d'accéder à tes données, de les rectifier, de les effacer, d'en limiter ou de t'opposer au traitement, ainsi que le droit à la portabilité. Tu peux exercer ces droits en contactant [EMAIL À COMPLÉTER]. Tu as également le droit de déposer une réclamation auprès de l'autorité portugaise de protection des données (CNPD)."] },
        { title: "8. Sécurité", body: ["L'accès aux données de chaque restaurant est isolé au niveau de la base de données grâce à la Row Level Security — un utilisateur ne peut lire ou écrire que les données des restaurants auxquels il appartient. Les connexions à l'application se font en HTTPS."] },
        { title: "9. Cookies", body: ["Nous utilisons uniquement les cookies essentiels au fonctionnement de l'application (maintien de la session connectée). Nous n'utilisons pas de cookies publicitaires ou de suivi tiers."] },
        { title: "10. Modifications de cette politique", body: ["Nous pouvons mettre à jour cette politique occasionnellement. Les modifications importantes seront communiquées par email ou par une notification dans le tableau de bord avant leur entrée en vigueur."] },
        { title: "11. Contact", body: ["Pour toute question concernant cette politique : [EMAIL À COMPLÉTER]."] },
      ],
    },
  },
  es: {
    common: {
      back: "← Volver", lastUpdated: "Última actualización: 15 de agosto de 2026",
      draftWarning: "Borrador inicial con datos fiscales provisionales — a actualizar con los datos definitivos antes del lanzamiento comercial, y a revisar por un abogado.",
      translationNotice: "Esta página es una traducción de cortesía. En caso de discrepancia, prevalece la versión en portugués.",
    },
    terms: {
      title: "Términos de Servicio",
      sections: [
        { title: "1. Identificación del prestador del servicio", body: ["El servicio LeakStop es prestado por Fernando Miguel dos Santos Silva, empresario individual, NIF [A COMPLETAR], con domicilio fiscal en [A COMPLETAR], en adelante \"LeakStop\" o \"nosotros\". Contacto: [EMAIL A COMPLETAR]."] },
        { title: "2. Objeto del servicio", body: ["LeakStop es una aplicación web (SaaS) que permite a los restaurantes registrar su menú, compras, ventas y costes fijos, y obtener análisis de desperdicio, margen por plato y recomendaciones de ingeniería de menú a partir de los datos introducidos por el propio usuario."] },
        { title: "3. Registro y cuenta", body: ["Para usar LeakStop es necesario crear una cuenta con email y contraseña. Eres responsable de mantener la confidencialidad de tus credenciales y de toda la actividad realizada en tu cuenta. Debes proporcionar información veraz y mantenerla actualizada."] },
        { title: "4. Precio y facturación", body: ["El acceso a LeakStop tiene un coste de 49 €/mes, IVA incluido, cobrado de forma recurrente a través de Stripe. El pago se procesa directamente por Stripe — LeakStop no almacena datos de tarjeta. La factura correspondiente es emitida manualmente por el prestador del servicio tras cada cobro."] },
        { title: "5. Duración y cancelación", body: [
          "Las cuentas nuevas incluyen un período de prueba gratuito de 5 días, durante el cual se solicita una tarjeta de pago válida en el momento del registro. Si no cancelas antes de que finalice el período de prueba, la suscripción se cobrará automáticamente a la tarjeta indicada, al precio vigente (49 €/mes, IVA incluido).",
          "Tras el período de prueba, la suscripción es mensual, sin permanencia, y se renueva automáticamente hasta que se cancele. Puedes cancelar en cualquier momento mediante la opción \"Gestionar suscripción\" del panel — el acceso permanece activo hasta el final del período ya pagado (o hasta el final de la prueba gratuita, si cancelas durante la misma), sin reembolso proporcional.",
        ] },
        { title: "6. Obligaciones del usuario", body: ["Te comprometes a usar LeakStop solo para fines lícitos, a no compartir tus credenciales de acceso con terceros no autorizados, y a no intentar acceder a datos de otros restaurantes ni eludir las medidas de seguridad de la aplicación."] },
        { title: "7. Limitación de responsabilidad", body: ["Los análisis, márgenes y recomendaciones mostrados resultan de cálculos automáticos sobre los datos introducidos por el usuario — su exactitud depende de la exactitud de esos datos. LeakStop no se responsabiliza de las decisiones de gestión tomadas con base en estos análisis, ni garantiza la disponibilidad ininterrumpida del servicio."] },
        { title: "8. Protección de datos", link: { pre: "El tratamiento de datos personales se describe en nuestra", post: "." } },
        { title: "9. Cambios en estos términos", body: ["Podemos actualizar estos Términos ocasionalmente. Los cambios materiales se comunicarán por email o mediante un aviso en el panel antes de su entrada en vigor."] },
        { title: "10. Ley aplicable", body: ["Estos Términos se rigen por la legislación portuguesa. Para cualquier litigio, es competente el fuero del partido judicial del domicilio fiscal del prestador del servicio, sin perjuicio de los derechos del consumidor."] },
        { title: "11. Contacto", body: ["Para preguntas sobre estos Términos: [EMAIL A COMPLETAR]."] },
      ],
    },
    privacy: {
      title: "Política de Privacidad",
      sections: [
        { title: "1. Responsable del tratamiento", body: ["Fernando Miguel dos Santos Silva, empresario individual, NIF [A COMPLETAR], con domicilio fiscal en [A COMPLETAR], es el responsable del tratamiento de los datos personales recogidos a través de LeakStop. Contacto para cuestiones de protección de datos: [EMAIL A COMPLETAR]."] },
        { title: "2. Qué datos recopilamos", items: [
          ["Datos de cuenta:", "email y contraseña (la contraseña se gestiona de forma cifrada por Supabase; nunca vemos ni almacenamos la contraseña en texto plano)."],
          ["Datos del restaurante:", "nombre, moneda, menú, ingredientes, compras, ventas y costes fijos que introduces en la aplicación."],
          ["Datos de facturación:", "Stripe procesa y almacena los datos de la tarjeta de pago directamente — LeakStop nunca tiene acceso al número de tarjeta. Solo guardamos el identificador de cliente y de suscripción de Stripe, y el estado de la suscripción."],
          ["Datos técnicos:", "registros de acceso y errores generados automáticamente por la infraestructura (Supabase, Fly.io), con fines de seguridad y diagnóstico."],
        ] },
        { title: "3. Finalidad y base legal", body: ["Tratamos estos datos para prestar el servicio contratado (ejecución del contrato — art. 6.1.b del RGPD), para la facturación y el cumplimiento de obligaciones fiscales (obligación legal — art. 6.1.c), y para comunicaciones de soporte relacionadas con tu cuenta (interés legítimo — art. 6.1.f)."] },
        { title: "4. Con quién compartimos los datos", itemSep: " — ", intro: "Tus datos se comparten únicamente con los subencargados necesarios para operar el servicio:", items: [
          ["Supabase", "base de datos y autenticación."],
          ["Stripe", "procesamiento de pagos."],
          ["Fly.io", "alojamiento de la aplicación."],
        ], outro: "No vendemos ni compartimos tus datos con terceros con fines de marketing." },
        { title: "5. Transferencias internacionales", body: ["Algunos de estos subencargados pueden procesar datos fuera del Espacio Económico Europeo. En esos casos, la transferencia se realiza al amparo de Cláusulas Contractuales Tipo aprobadas por la Comisión Europea o un mecanismo equivalente."] },
        { title: "6. Plazo de conservación", body: ["Conservamos tus datos mientras la cuenta esté activa. Tras la cancelación de la cuenta, los datos se conservan durante el plazo legal aplicable a las obligaciones fiscales y contables, transcurrido el cual se eliminan o anonimizan."] },
        { title: "7. Tus derechos", body: ["De acuerdo con el RGPD, tienes derecho a acceder, rectificar, suprimir, limitar u oponerte al tratamiento de tus datos, y a la portabilidad de los mismos. Puedes ejercer estos derechos contactando con [EMAIL A COMPLETAR]. También tienes derecho a presentar una reclamación ante la Comisión Nacional de Protección de Datos (CNPD) de Portugal."] },
        { title: "8. Seguridad", body: ["El acceso a los datos de cada restaurante está aislado a nivel de base de datos mediante Row Level Security — un usuario solo puede leer o escribir datos de los restaurantes a los que pertenece. Las conexiones a la aplicación se realizan mediante HTTPS."] },
        { title: "9. Cookies", body: ["Solo utilizamos cookies esenciales para el funcionamiento de la aplicación (mantener la sesión iniciada). No utilizamos cookies de publicidad ni de rastreo de terceros."] },
        { title: "10. Cambios en esta política", body: ["Podemos actualizar esta política ocasionalmente. Los cambios materiales se comunicarán por email o mediante un aviso en el panel antes de su entrada en vigor."] },
        { title: "11. Contacto", body: ["Para preguntas sobre esta política: [EMAIL A COMPLETAR]."] },
      ],
    },
  },
};

export function getLegalCopy(lang) {
  return LEGAL_COPY[lang] || LEGAL_COPY.pt;
}
