// i18n for the pre-login pages (login, signup, password recovery). Same language
// codes as lib/landingCopy.js and lib/dashboardCopy.js — there's no restaurant
// record yet at this point, so the language comes from detectLanguage()
// (URL ?lang= or browser locale), not from a stored preference.

export const AUTH_COPY = {
  pt: {
    login: {
      title: "Entrar", password: "Palavra-passe", forgotPassword: "Esqueci-me da password",
      loggingIn: "A entrar…", submit: "Entrar",
      noAccount: "Ainda não tens conta?", createAccount: "Criar conta",
    },
    signup: {
      title: "Criar conta", restaurantName: "Nome do restaurante", password: "Palavra-passe",
      language: "Idioma", currency: "Moeda", openingStripe: "A abrir o Stripe…", submit: "Criar conta",
      confirmEmail: "Conta criada — confirma o teu email antes de continuar.",
      checkoutFailed: "Conta criada, mas não foi possível iniciar o checkout. Tenta a partir do painel.",
      stripeConnectFailed: "Conta criada, mas não foi possível ligar ao Stripe. Tenta a partir do painel.",
      alreadyHaveAccount: "Já tens conta?", login: "Entrar",
      trialPricing: "5 dias grátis, depois 49€/mês — cartão pedido a seguir, cancela quando quiseres.",
      marketingConsent: "Aceito receber emails com novidades e promoções do LeakStop.",
      acceptTerms: "Ao criar conta, aceitas os", and: "e a",
    },
    forgotPassword: {
      title: "Recuperar palavra-passe",
      sentMessage: "Se existir uma conta com esse email, enviámos um link para redefinires a palavra-passe. Verifica a caixa de entrada (e o spam).",
      instructions: "Indica o email da tua conta e enviamos-te um link para criares uma nova palavra-passe.",
      sending: "A enviar…", submit: "Enviar link de recuperação", backToLogin: "← Voltar ao login",
    },
    resetPassword: {
      title: "Nova palavra-passe", newPassword: "Nova palavra-passe", confirmPassword: "Confirmar palavra-passe",
      mismatch: "As palavras-passe não coincidem.", saving: "A guardar…", submit: "Guardar nova palavra-passe",
    },
  },
  en: {
    login: {
      title: "Log in", password: "Password", forgotPassword: "Forgot your password",
      loggingIn: "Logging in…", submit: "Log in",
      noAccount: "Don't have an account yet?", createAccount: "Create account",
    },
    signup: {
      title: "Create account", restaurantName: "Restaurant name", password: "Password",
      language: "Language", currency: "Currency", openingStripe: "Opening Stripe…", submit: "Create account",
      confirmEmail: "Account created — confirm your email before continuing.",
      checkoutFailed: "Account created, but checkout could not be started. Try again from the dashboard.",
      stripeConnectFailed: "Account created, but could not connect to Stripe. Try again from the dashboard.",
      alreadyHaveAccount: "Already have an account?", login: "Log in",
      trialPricing: "5 days free, then €49/month — card required next, cancel anytime.",
      marketingConsent: "I'd like to receive emails about LeakStop news and offers.",
      acceptTerms: "By creating an account, you accept the", and: "and the",
    },
    forgotPassword: {
      title: "Recover password",
      sentMessage: "If an account exists with that email, we sent a link to reset your password. Check your inbox (and spam).",
      instructions: "Enter your account's email and we'll send you a link to set a new password.",
      sending: "Sending…", submit: "Send recovery link", backToLogin: "← Back to login",
    },
    resetPassword: {
      title: "New password", newPassword: "New password", confirmPassword: "Confirm password",
      mismatch: "Passwords don't match.", saving: "Saving…", submit: "Save new password",
    },
  },
  de: {
    login: {
      title: "Anmelden", password: "Passwort", forgotPassword: "Passwort vergessen",
      loggingIn: "Anmeldung…", submit: "Anmelden",
      noAccount: "Noch kein Konto?", createAccount: "Konto erstellen",
    },
    signup: {
      title: "Konto erstellen", restaurantName: "Name des Restaurants", password: "Passwort",
      language: "Sprache", currency: "Währung", openingStripe: "Stripe wird geöffnet…", submit: "Konto erstellen",
      confirmEmail: "Konto erstellt — bestätige deine E-Mail, bevor du fortfährst.",
      checkoutFailed: "Konto erstellt, aber der Checkout konnte nicht gestartet werden. Versuche es erneut über das Dashboard.",
      stripeConnectFailed: "Konto erstellt, aber die Verbindung zu Stripe ist fehlgeschlagen. Versuche es erneut über das Dashboard.",
      alreadyHaveAccount: "Hast du schon ein Konto?", login: "Anmelden",
      trialPricing: "5 Tage kostenlos, danach 49 €/Monat — Karte wird danach benötigt, jederzeit kündbar.",
      marketingConsent: "Ich möchte E-Mails mit Neuigkeiten und Angeboten von LeakStop erhalten.",
      acceptTerms: "Mit der Kontoerstellung akzeptierst du die", and: "und die",
    },
    forgotPassword: {
      title: "Passwort zurücksetzen",
      sentMessage: "Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum Zurücksetzen des Passworts gesendet. Prüfe deinen Posteingang (und den Spam-Ordner).",
      instructions: "Gib die E-Mail deines Kontos ein und wir senden dir einen Link, um ein neues Passwort festzulegen.",
      sending: "Wird gesendet…", submit: "Link zum Zurücksetzen senden", backToLogin: "← Zurück zur Anmeldung",
    },
    resetPassword: {
      title: "Neues Passwort", newPassword: "Neues Passwort", confirmPassword: "Passwort bestätigen",
      mismatch: "Die Passwörter stimmen nicht überein.", saving: "Speichert…", submit: "Neues Passwort speichern",
    },
  },
  fr: {
    login: {
      title: "Connexion", password: "Mot de passe", forgotPassword: "Mot de passe oublié",
      loggingIn: "Connexion…", submit: "Connexion",
      noAccount: "Pas encore de compte ?", createAccount: "Créer un compte",
    },
    signup: {
      title: "Créer un compte", restaurantName: "Nom du restaurant", password: "Mot de passe",
      language: "Langue", currency: "Devise", openingStripe: "Ouverture de Stripe…", submit: "Créer un compte",
      confirmEmail: "Compte créé — confirme ton email avant de continuer.",
      checkoutFailed: "Compte créé, mais impossible de démarrer le paiement. Réessaie depuis le tableau de bord.",
      stripeConnectFailed: "Compte créé, mais impossible de se connecter à Stripe. Réessaie depuis le tableau de bord.",
      alreadyHaveAccount: "Tu as déjà un compte ?", login: "Connexion",
      trialPricing: "5 jours gratuits, puis 49 €/mois — carte requise ensuite, annule quand tu veux.",
      marketingConsent: "Je souhaite recevoir des emails sur les actualités et offres de LeakStop.",
      acceptTerms: "En créant un compte, tu acceptes les", and: "et la",
    },
    forgotPassword: {
      title: "Récupérer le mot de passe",
      sentMessage: "Si un compte existe avec cet email, nous avons envoyé un lien pour réinitialiser le mot de passe. Vérifie ta boîte de réception (et les spams).",
      instructions: "Indique l'email de ton compte et nous t'enverrons un lien pour créer un nouveau mot de passe.",
      sending: "Envoi…", submit: "Envoyer le lien de récupération", backToLogin: "← Retour à la connexion",
    },
    resetPassword: {
      title: "Nouveau mot de passe", newPassword: "Nouveau mot de passe", confirmPassword: "Confirmer le mot de passe",
      mismatch: "Les mots de passe ne correspondent pas.", saving: "Enregistrement…", submit: "Enregistrer le nouveau mot de passe",
    },
  },
  es: {
    login: {
      title: "Iniciar sesión", password: "Contraseña", forgotPassword: "Olvidé mi contraseña",
      loggingIn: "Iniciando sesión…", submit: "Iniciar sesión",
      noAccount: "¿Todavía no tienes cuenta?", createAccount: "Crear cuenta",
    },
    signup: {
      title: "Crear cuenta", restaurantName: "Nombre del restaurante", password: "Contraseña",
      language: "Idioma", currency: "Moneda", openingStripe: "Abriendo Stripe…", submit: "Crear cuenta",
      confirmEmail: "Cuenta creada — confirma tu email antes de continuar.",
      checkoutFailed: "Cuenta creada, pero no se pudo iniciar el pago. Inténtalo de nuevo desde el panel.",
      stripeConnectFailed: "Cuenta creada, pero no se pudo conectar con Stripe. Inténtalo de nuevo desde el panel.",
      alreadyHaveAccount: "¿Ya tienes cuenta?", login: "Iniciar sesión",
      trialPricing: "5 días gratis, luego 49 €/mes — se pedirá tarjeta a continuación, cancela cuando quieras.",
      marketingConsent: "Quiero recibir emails con novedades y ofertas de LeakStop.",
      acceptTerms: "Al crear una cuenta, aceptas los", and: "y la",
    },
    forgotPassword: {
      title: "Recuperar contraseña",
      sentMessage: "Si existe una cuenta con ese email, enviamos un enlace para restablecer la contraseña. Revisa tu bandeja de entrada (y el spam).",
      instructions: "Indica el email de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.",
      sending: "Enviando…", submit: "Enviar enlace de recuperación", backToLogin: "← Volver al inicio de sesión",
    },
    resetPassword: {
      title: "Nueva contraseña", newPassword: "Nueva contraseña", confirmPassword: "Confirmar contraseña",
      mismatch: "Las contraseñas no coinciden.", saving: "Guardando…", submit: "Guardar nueva contraseña",
    },
  },
};

export function getAuthCopy(lang) {
  return AUTH_COPY[lang] || AUTH_COPY.pt;
}
