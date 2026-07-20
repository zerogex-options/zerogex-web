import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    badgeLabel: 'Privacy',
    pageTitle: 'Privacy Policy',
    effectiveDate: 'Effective date: {date}',

    s1Title: '1. Introduction',
    s1Body:
      'This Privacy Policy describes how ZeroGEX (“ZeroGEX,” “we,” or “us”) collects, uses, and shares information about you when you use the website at zerogex.io and related products and services (collectively, the “Services”). By using the Services, you agree to this Privacy Policy.',

    s2Title: '2. Information We Collect',
    s2Intro: 'We collect the following categories of information:',
    s2Item1Label: 'Account information.',
    s2Item1Text:
      'Email address, password (stored as a salted hash), and, if you sign in with Google or Apple, the unique provider identifier and email returned by that provider.',
    s2Item2Label: 'Subscription and payment information.',
    s2Item2Text:
      'Subscription tier, status, current billing period, and Stripe customer/subscription identifiers. Payment instruments (card numbers, expirations, billing addresses) are collected and processed by Stripe; we do not receive or store full card data.',
    s2Item3Label: 'Usage and device information.',
    s2Item3Text:
      'IP address, request timestamps, pages visited, and basic browser/device metadata, used for security, abuse prevention, and product analytics.',
    s2Item4Label: 'Audit events.',
    s2Item4Text:
      'Limited records of authentication and account-management actions (logins, role changes, subscription changes) for security and compliance.',

    s3Title: '3. How We Use Information',
    s3Item1: 'Provide, maintain, and improve the Services.',
    s3Item2: 'Authenticate users and prevent fraud or abuse.',
    s3Item3: 'Process subscriptions and payments via Stripe.',
    s3Item4: 'Enforce tier-based access to features.',
    s3Item5: 'Communicate with you about your account, billing, and material changes to the Services.',
    s3Item6: 'Comply with legal obligations and respond to lawful requests.',

    s4Title: '4. Third-Party Service Providers',
    s4Intro: 'We share information with third parties that help us operate the Services. The principal providers are:',
    s4Item1Label: 'Stripe',
    s4Item1TextPrefix: '— payment processing, billing portal, and subscription management. Stripe’s privacy practices are described at',
    s4Item2Label: 'Cloud infrastructure providers',
    s4Item2Text: '— hosting, storage, and content delivery for the Services.',
    s4Item3Label: 'Identity providers',
    s4Item3Text: '— Google and Apple, when you choose to sign in with those services.',
    s4Closing:
      'We do not sell your personal information. We do not share personal information with third parties for their own marketing purposes.',

    s5Title: '5. Cookies and Similar Technologies',
    s5Body:
      'We use first-party cookies to keep you signed in (a session cookie) and to mitigate cross-site-request-forgery attacks (a CSRF cookie). Stripe-hosted pages set their own cookies under their domain, governed by Stripe’s privacy policy. Most browsers allow you to refuse or delete cookies; however, doing so may make parts of the Services unusable.',

    s6Title: '6. Data Retention',
    s6Body:
      'We retain account, subscription, and audit information for as long as your account remains active and for a reasonable period afterward to comply with legal, tax, or accounting obligations and to resolve disputes. You may request deletion as described below.',

    s7Title: '7. Your Rights',
    s7Prefix:
      'Depending on where you live, you may have the right to access, correct, delete, or export your personal information, or to object to or restrict certain processing. To exercise any of these rights, contact us at',
    s7Suffix:
      '. We may need to verify your identity before acting on a request. We will not discriminate against you for exercising any of these rights.',

    s8Title: '8. Your U.S. State Privacy Rights (California and Other States)',
    s8Intro:
      'This section provides additional disclosures for residents of California under the California Consumer Privacy Act, as amended by the California Privacy Rights Act (collectively, “CCPA”), and for residents of other U.S. states with comprehensive privacy laws (including Virginia, Colorado, Connecticut, and Utah). These laws may give you the rights described below, subject to certain exceptions.',
    s8CategoriesLabel: 'Categories of personal information we collect.',
    s8CategoriesText:
      'In the preceding twelve months, we have collected the following categories of personal information, as described in Section 2: identifiers (such as email address and account identifiers); commercial information (such as subscription tier, status, and billing period); internet or other electronic network activity information (such as IP address, request timestamps, and pages visited); and audit records of account and authentication activity. We collect this information from you directly, from your use of the Services, and from identity and payment providers such as Google, Apple, and Stripe. We use it for the business purposes described in Section 3.',
    s8NoSaleLabel: 'No sale or sharing of personal information.',
    s8NoSaleText:
      'We do not sell your personal information and we do not share it for cross-context behavioral advertising or targeted advertising, as those terms are defined under the CCPA and other state privacy laws. We have not done so in the preceding twelve months, including with respect to information about consumers under 16 years of age. We also do not use or disclose sensitive personal information for purposes that would give rise to a right to limit its use.',
    s8RightsLabel: 'Your rights.',
    s8RightsIntro: 'Depending on your state of residence, you may have the right to:',
    s8RightsItem1Label: 'Know and access',
    s8RightsItem1Text:
      'the categories and specific pieces of personal information we have collected about you, the sources, the purposes, and the categories of third parties to whom it was disclosed.',
    s8RightsItem2Label: 'Delete',
    s8RightsItem2Text: 'personal information we have collected from you, subject to legal exceptions.',
    s8RightsItem3Label: 'Correct',
    s8RightsItem3Text: 'inaccurate personal information we maintain about you.',
    s8RightsItem4Label: 'Opt out',
    s8RightsItem4Text:
      'of the sale or sharing of personal information and of targeted advertising and certain profiling (we do not engage in these activities).',
    s8RightsItem5Label: 'Limit the use',
    s8RightsItem5Text:
      'of sensitive personal information (we do not use sensitive personal information for purposes requiring this option).',
    s8RightsItem6Label: 'Non-discrimination',
    s8RightsItem6TextPrefix: 'for exercising your privacy rights, and, where applicable, the right to',
    s8RightsItem6AppealLabel: 'appeal',
    s8RightsItem6TextSuffix: 'a denial of a request.',
    s8HowToLabel: 'How to exercise your rights.',
    s8HowToPrefix: 'You or an authorized agent acting on your behalf may submit a request by emailing',
    s8HowToSuffix:
      '. To protect your information, we will take reasonable steps to verify your identity before responding, and we may request additional information for that purpose. We will respond within the timeframes required by applicable law. If we deny your request, you may appeal by replying to our response; if you have concerns about the outcome, you may contact your state attorney general.',
    s8ShineLabel: 'California “Shine the Light.”',
    s8ShineText:
      'California Civil Code Section 1798.83 permits California residents to request information about disclosures of personal information to third parties for their direct marketing purposes. We do not share personal information with third parties for their own direct marketing purposes.',

    s9Title: '9. Security',
    s9Body:
      'We use technical and organizational measures designed to protect your information, including encryption in transit (TLS), salted password hashing, signed session tokens, and rate limiting on authentication endpoints. No method of transmission or storage is perfectly secure, and we cannot guarantee absolute security.',

    s10Title: '10. International Transfers',
    s10Body:
      'The Services are operated from the United States. If you access them from outside the United States, your information will be transferred to, processed in, and stored in the United States.',

    s11Title: '11. Children',
    s11Body:
      'The Services are not directed to children under 18. We do not knowingly collect personal information from children under 18. If you believe a child has provided us with personal information, please contact us so we can delete it.',

    s12Title: '12. Changes to This Policy',
    s12Body:
      'We may update this Privacy Policy from time to time. When we do, we will revise the effective date above and, where appropriate, provide additional notice through the Services.',

    s13Title: '13. Contact',
    s13Prefix: 'Questions about this Privacy Policy can be sent to',
  },
  it: {
    badgeLabel: 'Privacy',
    pageTitle: 'Informativa sulla privacy',
    effectiveDate: 'Data di entrata in vigore: {date}',

    s1Title: '1. Introduzione',
    s1Body:
      'La presente Informativa sulla privacy descrive come ZeroGEX (“ZeroGEX,” “noi”) raccoglie, utilizza e condivide le informazioni che ti riguardano quando utilizzi il sito web zerogex.io e i prodotti e servizi correlati (collettivamente, i “Servizi”). Utilizzando i Servizi, accetti la presente Informativa sulla privacy.',

    s2Title: '2. Informazioni che raccogliamo',
    s2Intro: 'Raccogliamo le seguenti categorie di informazioni:',
    s2Item1Label: 'Informazioni sull’account.',
    s2Item1Text:
      'Indirizzo email, password (memorizzata come hash con salt) e, se accedi con Google o Apple, l’identificatore univoco del provider e l’email restituita da tale provider.',
    s2Item2Label: 'Informazioni su abbonamento e pagamento.',
    s2Item2Text:
      'Livello di abbonamento, stato, periodo di fatturazione corrente e identificatori cliente/abbonamento di Stripe. Gli strumenti di pagamento (numeri di carta, scadenze, indirizzi di fatturazione) sono raccolti ed elaborati da Stripe; non riceviamo né conserviamo i dati completi della carta.',
    s2Item3Label: 'Informazioni sull’utilizzo e sul dispositivo.',
    s2Item3Text:
      'Indirizzo IP, orari delle richieste, pagine visitate e metadati di base su browser/dispositivo, utilizzati per sicurezza, prevenzione degli abusi e analisi del prodotto.',
    s2Item4Label: 'Eventi di audit.',
    s2Item4Text:
      'Registrazioni limitate di azioni di autenticazione e gestione dell’account (accessi, modifiche di ruolo, modifiche all’abbonamento) per sicurezza e conformità.',

    s3Title: '3. Come utilizziamo le informazioni',
    s3Item1: 'Fornire, mantenere e migliorare i Servizi.',
    s3Item2: 'Autenticare gli utenti e prevenire frodi o abusi.',
    s3Item3: 'Elaborare abbonamenti e pagamenti tramite Stripe.',
    s3Item4: 'Applicare l’accesso alle funzionalità in base al livello di abbonamento.',
    s3Item5: 'Comunicare con te riguardo al tuo account, alla fatturazione e a modifiche rilevanti dei Servizi.',
    s3Item6: 'Adempiere agli obblighi legali e rispondere a richieste legittime.',

    s4Title: '4. Fornitori di servizi terzi',
    s4Intro: 'Condividiamo informazioni con terze parti che ci aiutano a gestire i Servizi. I principali fornitori sono:',
    s4Item1Label: 'Stripe',
    s4Item1TextPrefix: '— elaborazione dei pagamenti, portale di fatturazione e gestione degli abbonamenti. Le pratiche sulla privacy di Stripe sono descritte su',
    s4Item2Label: 'Fornitori di infrastruttura cloud',
    s4Item2Text: '— hosting, archiviazione e distribuzione dei contenuti per i Servizi.',
    s4Item3Label: 'Provider di identità',
    s4Item3Text: '— Google e Apple, quando scegli di accedere tramite questi servizi.',
    s4Closing:
      'Non vendiamo le tue informazioni personali. Non condividiamo informazioni personali con terze parti per i loro scopi di marketing.',

    s5Title: '5. Cookie e tecnologie simili',
    s5Body:
      'Utilizziamo cookie proprietari per mantenerti connesso (un cookie di sessione) e per mitigare attacchi di cross-site-request-forgery (un cookie CSRF). Le pagine ospitate da Stripe impostano i propri cookie sotto il loro dominio, regolati dall’informativa sulla privacy di Stripe. La maggior parte dei browser consente di rifiutare o eliminare i cookie; tuttavia, ciò potrebbe rendere inutilizzabili alcune parti dei Servizi.',

    s6Title: '6. Conservazione dei dati',
    s6Body:
      'Conserviamo le informazioni relative ad account, abbonamento e audit per tutto il tempo in cui il tuo account rimane attivo e per un periodo ragionevole successivo, per adempiere a obblighi legali, fiscali o contabili e per risolvere controversie. Puoi richiedere la cancellazione come descritto di seguito.',

    s7Title: '7. I tuoi diritti',
    s7Prefix:
      'A seconda del luogo in cui vivi, potresti avere il diritto di accedere, correggere, eliminare o esportare le tue informazioni personali, oppure di opporti o limitare determinati trattamenti. Per esercitare uno di questi diritti, contattaci all’indirizzo',
    s7Suffix:
      '. Potremmo dover verificare la tua identità prima di agire su una richiesta. Non ti discrimineremo per aver esercitato uno di questi diritti.',

    s8Title: '8. I tuoi diritti sulla privacy negli Stati Uniti (California e altri Stati)',
    s8Intro:
      'Questa sezione fornisce ulteriori informazioni per i residenti in California ai sensi del California Consumer Privacy Act, come modificato dal California Privacy Rights Act (collettivamente, “CCPA”), e per i residenti di altri Stati USA con leggi complete sulla privacy (tra cui Virginia, Colorado, Connecticut e Utah). Queste leggi possono conferirti i diritti descritti di seguito, salvo alcune eccezioni.',
    s8CategoriesLabel: 'Categorie di informazioni personali che raccogliamo.',
    s8CategoriesText:
      'Negli ultimi dodici mesi abbiamo raccolto le seguenti categorie di informazioni personali, come descritto nella Sezione 2: identificativi (come indirizzo email e identificativi dell’account); informazioni commerciali (come livello di abbonamento, stato e periodo di fatturazione); informazioni sull’attività su reti elettroniche (come indirizzo IP, orari delle richieste e pagine visitate); e registrazioni di audit dell’attività dell’account e di autenticazione. Raccogliamo queste informazioni direttamente da te, dal tuo utilizzo dei Servizi e da fornitori di identità e pagamento come Google, Apple e Stripe. Le utilizziamo per le finalità commerciali descritte nella Sezione 3.',
    s8NoSaleLabel: 'Nessuna vendita o condivisione di informazioni personali.',
    s8NoSaleText:
      'Non vendiamo le tue informazioni personali e non le condividiamo per pubblicità comportamentale cross-context o pubblicità mirata, secondo le definizioni del CCPA e di altre leggi statali sulla privacy. Non lo abbiamo fatto negli ultimi dodici mesi, anche per quanto riguarda informazioni relative a consumatori di età inferiore ai 16 anni. Inoltre non utilizziamo né divulghiamo informazioni personali sensibili per finalità che darebbero diritto a limitarne l’uso.',
    s8RightsLabel: 'I tuoi diritti.',
    s8RightsIntro: 'A seconda del tuo Stato di residenza, potresti avere il diritto di:',
    s8RightsItem1Label: 'Conoscere e accedere',
    s8RightsItem1Text:
      'alle categorie e agli elementi specifici di informazioni personali che abbiamo raccolto su di te, alle fonti, alle finalità e alle categorie di terze parti a cui sono state divulgate.',
    s8RightsItem2Label: 'Eliminare',
    s8RightsItem2Text: 'le informazioni personali che abbiamo raccolto da te, fatte salve le eccezioni di legge.',
    s8RightsItem3Label: 'Correggere',
    s8RightsItem3Text: 'informazioni personali inesatte che conserviamo su di te.',
    s8RightsItem4Label: 'Rinunciare',
    s8RightsItem4Text:
      'alla vendita o condivisione di informazioni personali e alla pubblicità mirata e a determinate profilazioni (non svolgiamo queste attività).',
    s8RightsItem5Label: 'Limitare l’uso',
    s8RightsItem5Text:
      'di informazioni personali sensibili (non utilizziamo informazioni personali sensibili per finalità che richiedono questa opzione).',
    s8RightsItem6Label: 'Non discriminazione',
    s8RightsItem6TextPrefix: 'per aver esercitato i tuoi diritti sulla privacy e, ove applicabile, il diritto di',
    s8RightsItem6AppealLabel: 'presentare ricorso',
    s8RightsItem6TextSuffix: 'contro il diniego di una richiesta.',
    s8HowToLabel: 'Come esercitare i tuoi diritti.',
    s8HowToPrefix: 'Tu o un agente autorizzato che agisce per tuo conto potete inviare una richiesta scrivendo a',
    s8HowToSuffix:
      '. Per proteggere le tue informazioni, adotteremo misure ragionevoli per verificare la tua identità prima di rispondere e potremmo richiedere ulteriori informazioni a tale scopo. Risponderemo entro i tempi previsti dalla legge applicabile. Se rifiutiamo la tua richiesta, puoi presentare ricorso rispondendo alla nostra comunicazione; per dubbi sull’esito, puoi contattare il procuratore generale del tuo Stato.',
    s8ShineLabel: 'California “Shine the Light.”',
    s8ShineText:
      'La Sezione 1798.83 del California Civil Code consente ai residenti in California di richiedere informazioni sulla divulgazione di dati personali a terze parti per i loro scopi di marketing diretto. Non condividiamo informazioni personali con terze parti per i loro scopi di marketing diretto.',

    s9Title: '9. Sicurezza',
    s9Body:
      'Utilizziamo misure tecniche e organizzative progettate per proteggere le tue informazioni, tra cui crittografia in transito (TLS), hashing delle password con salt, token di sessione firmati e limitazione della frequenza sugli endpoint di autenticazione. Nessun metodo di trasmissione o archiviazione è perfettamente sicuro e non possiamo garantire una sicurezza assoluta.',

    s10Title: '10. Trasferimenti internazionali',
    s10Body:
      'I Servizi sono gestiti dagli Stati Uniti. Se vi accedi da al di fuori degli Stati Uniti, le tue informazioni saranno trasferite, elaborate e conservate negli Stati Uniti.',

    s11Title: '11. Minori',
    s11Body:
      'I Servizi non sono destinati a minori di 18 anni. Non raccogliamo consapevolmente informazioni personali da minori di 18 anni. Se ritieni che un minore ci abbia fornito informazioni personali, contattaci affinché possiamo eliminarle.',

    s12Title: '12. Modifiche alla presente Informativa',
    s12Body:
      'Potremmo aggiornare periodicamente questa Informativa sulla privacy. Quando lo faremo, aggiorneremo la data di entrata in vigore sopra indicata e, ove opportuno, forniremo un ulteriore avviso tramite i Servizi.',

    s13Title: '13. Contatti',
    s13Prefix: 'Per domande su questa Informativa sulla privacy puoi scrivere a',
  },
  de: {
    badgeLabel: 'Datenschutz',
    pageTitle: 'Datenschutzerklärung',
    effectiveDate: 'Gültig ab: {date}',

    s1Title: '1. Einleitung',
    s1Body:
      'Diese Datenschutzerklärung beschreibt, wie ZeroGEX (“ZeroGEX,” “wir”) Informationen über dich erhebt, verwendet und weitergibt, wenn du die Website zerogex.io sowie damit verbundene Produkte und Dienste (zusammen die “Dienste”) nutzt. Durch die Nutzung der Dienste stimmst du dieser Datenschutzerklärung zu.',

    s2Title: '2. Informationen, die wir erheben',
    s2Intro: 'Wir erheben die folgenden Kategorien von Informationen:',
    s2Item1Label: 'Kontoinformationen.',
    s2Item1Text:
      'E-Mail-Adresse, Passwort (als gesalzener Hash gespeichert) und, falls du dich mit Google oder Apple anmeldest, die eindeutige Anbieterkennung und die von diesem Anbieter zurückgegebene E-Mail-Adresse.',
    s2Item2Label: 'Abonnement- und Zahlungsinformationen.',
    s2Item2Text:
      'Abonnementstufe, Status, aktuelle Abrechnungsperiode sowie Stripe-Kunden-/Abonnement-Kennungen. Zahlungsmittel (Kartennummern, Ablaufdaten, Rechnungsadressen) werden von Stripe erhoben und verarbeitet; wir erhalten oder speichern keine vollständigen Kartendaten.',
    s2Item3Label: 'Nutzungs- und Geräteinformationen.',
    s2Item3Text:
      'IP-Adresse, Zeitstempel von Anfragen, besuchte Seiten sowie grundlegende Browser-/Gerätedaten, die zur Sicherheit, Missbrauchsverhinderung und Produktanalyse verwendet werden.',
    s2Item4Label: 'Audit-Ereignisse.',
    s2Item4Text:
      'Begrenzte Aufzeichnungen von Authentifizierungs- und Kontoverwaltungsmaßnahmen (Anmeldungen, Rollenänderungen, Abonnementänderungen) zu Sicherheits- und Compliance-Zwecken.',

    s3Title: '3. Wie wir Informationen verwenden',
    s3Item1: 'Bereitstellung, Pflege und Verbesserung der Dienste.',
    s3Item2: 'Authentifizierung von Nutzern und Verhinderung von Betrug oder Missbrauch.',
    s3Item3: 'Abwicklung von Abonnements und Zahlungen über Stripe.',
    s3Item4: 'Durchsetzung des stufenbasierten Zugriffs auf Funktionen.',
    s3Item5: 'Kommunikation mit dir zu deinem Konto, zur Abrechnung und zu wesentlichen Änderungen der Dienste.',
    s3Item6: 'Erfüllung rechtlicher Verpflichtungen und Reaktion auf rechtmäßige Anfragen.',

    s4Title: '4. Drittanbieter von Dienstleistungen',
    s4Intro: 'Wir geben Informationen an Dritte weiter, die uns beim Betrieb der Dienste unterstützen. Die wichtigsten Anbieter sind:',
    s4Item1Label: 'Stripe',
    s4Item1TextPrefix: '— Zahlungsabwicklung, Abrechnungsportal und Abonnementverwaltung. Die Datenschutzpraktiken von Stripe sind beschrieben unter',
    s4Item2Label: 'Cloud-Infrastrukturanbieter',
    s4Item2Text: '— Hosting, Speicherung und Content-Delivery für die Dienste.',
    s4Item3Label: 'Identitätsanbieter',
    s4Item3Text: '— Google und Apple, wenn du dich über diese Dienste anmeldest.',
    s4Closing:
      'Wir verkaufen deine personenbezogenen Daten nicht. Wir geben personenbezogene Daten nicht an Dritte für deren eigene Marketingzwecke weiter.',

    s5Title: '5. Cookies und ähnliche Technologien',
    s5Body:
      'Wir verwenden First-Party-Cookies, um dich angemeldet zu halten (ein Session-Cookie) und um Cross-Site-Request-Forgery-Angriffe abzumildern (ein CSRF-Cookie). Von Stripe gehostete Seiten setzen eigene Cookies unter ihrer Domain, die der Datenschutzerklärung von Stripe unterliegen. Die meisten Browser erlauben es, Cookies abzulehnen oder zu löschen; dies kann jedoch dazu führen, dass Teile der Dienste nicht mehr nutzbar sind.',

    s6Title: '6. Datenspeicherung',
    s6Body:
      'Wir speichern Konto-, Abonnement- und Audit-Informationen, solange dein Konto aktiv bleibt, sowie für einen angemessenen Zeitraum danach, um rechtliche, steuerliche oder buchhalterische Verpflichtungen zu erfüllen und Streitigkeiten beizulegen. Du kannst die Löschung wie unten beschrieben beantragen.',

    s7Title: '7. Deine Rechte',
    s7Prefix:
      'Je nachdem, wo du lebst, hast du möglicherweise das Recht, auf deine personenbezogenen Daten zuzugreifen, sie zu berichtigen, zu löschen oder zu exportieren, oder bestimmten Verarbeitungen zu widersprechen oder sie einzuschränken. Um eines dieser Rechte auszuüben, kontaktiere uns unter',
    s7Suffix:
      '. Möglicherweise müssen wir deine Identität überprüfen, bevor wir auf eine Anfrage reagieren. Wir werden dich nicht benachteiligen, weil du eines dieser Rechte ausübst.',

    s8Title: '8. Deine US-Datenschutzrechte (Kalifornien und andere Bundesstaaten)',
    s8Intro:
      'Dieser Abschnitt enthält zusätzliche Offenlegungen für Einwohner Kaliforniens gemäß dem California Consumer Privacy Act in der durch den California Privacy Rights Act geänderten Fassung (zusammen “CCPA”) sowie für Einwohner anderer US-Bundesstaaten mit umfassenden Datenschutzgesetzen (einschließlich Virginia, Colorado, Connecticut und Utah). Diese Gesetze können dir die unten beschriebenen Rechte einräumen, vorbehaltlich bestimmter Ausnahmen.',
    s8CategoriesLabel: 'Kategorien personenbezogener Daten, die wir erheben.',
    s8CategoriesText:
      'In den vorangegangenen zwölf Monaten haben wir die folgenden Kategorien personenbezogener Daten erhoben, wie in Abschnitt 2 beschrieben: Identifikatoren (z. B. E-Mail-Adresse und Kontokennungen); kommerzielle Informationen (z. B. Abonnementstufe, Status und Abrechnungszeitraum); Informationen zur Aktivität im Internet oder in elektronischen Netzwerken (z. B. IP-Adresse, Zeitstempel von Anfragen und besuchte Seiten); sowie Audit-Aufzeichnungen zur Konto- und Authentifizierungsaktivität. Wir erheben diese Informationen direkt von dir, aus deiner Nutzung der Dienste sowie von Identitäts- und Zahlungsanbietern wie Google, Apple und Stripe. Wir verwenden sie für die in Abschnitt 3 beschriebenen geschäftlichen Zwecke.',
    s8NoSaleLabel: 'Kein Verkauf oder keine Weitergabe personenbezogener Daten.',
    s8NoSaleText:
      'Wir verkaufen deine personenbezogenen Daten nicht und geben sie nicht für kontextübergreifende verhaltensbasierte Werbung oder zielgerichtete Werbung weiter, wie diese Begriffe im CCPA und anderen bundesstaatlichen Datenschutzgesetzen definiert sind. Wir haben dies in den vorangegangenen zwölf Monaten nicht getan, auch nicht in Bezug auf Informationen über Verbraucher unter 16 Jahren. Zudem verwenden oder offenbaren wir keine sensiblen personenbezogenen Daten für Zwecke, die ein Recht auf Nutzungsbeschränkung begründen würden.',
    s8RightsLabel: 'Deine Rechte.',
    s8RightsIntro: 'Je nach deinem Wohnsitzstaat hast du möglicherweise das Recht:',
    s8RightsItem1Label: 'Zu wissen und zuzugreifen',
    s8RightsItem1Text:
      'auf die Kategorien und spezifischen personenbezogenen Daten, die wir über dich erhoben haben, die Quellen, die Zwecke und die Kategorien Dritter, denen sie offengelegt wurden.',
    s8RightsItem2Label: 'Zu löschen',
    s8RightsItem2Text: 'personenbezogene Daten, die wir von dir erhoben haben, vorbehaltlich gesetzlicher Ausnahmen.',
    s8RightsItem3Label: 'Zu berichtigen',
    s8RightsItem3Text: 'unrichtige personenbezogene Daten, die wir über dich führen.',
    s8RightsItem4Label: 'Zu widersprechen',
    s8RightsItem4Text:
      'dem Verkauf oder der Weitergabe personenbezogener Daten sowie zielgerichteter Werbung und bestimmter Profilerstellung (wir betreiben diese Aktivitäten nicht).',
    s8RightsItem5Label: 'Die Nutzung zu beschränken',
    s8RightsItem5Text:
      'sensibler personenbezogener Daten (wir verwenden keine sensiblen personenbezogenen Daten für Zwecke, die diese Option erfordern).',
    s8RightsItem6Label: 'Nichtdiskriminierung',
    s8RightsItem6TextPrefix: 'für die Ausübung deiner Datenschutzrechte und, sofern zutreffend, das Recht auf',
    s8RightsItem6AppealLabel: 'Widerspruch',
    s8RightsItem6TextSuffix: 'gegen die Ablehnung einer Anfrage.',
    s8HowToLabel: 'Wie du deine Rechte ausübst.',
    s8HowToPrefix: 'Du oder ein autorisierter Vertreter in deinem Namen kann eine Anfrage per E-Mail an',
    s8HowToSuffix:
      'stellen. Zum Schutz deiner Informationen ergreifen wir angemessene Maßnahmen, um deine Identität zu überprüfen, bevor wir antworten, und können zu diesem Zweck zusätzliche Informationen anfordern. Wir werden innerhalb der gesetzlich vorgeschriebenen Fristen antworten. Wenn wir deine Anfrage ablehnen, kannst du Widerspruch einlegen, indem du auf unsere Antwort reagierst; bei Bedenken zum Ergebnis kannst du dich an den Attorney General deines Bundesstaates wenden.',
    s8ShineLabel: 'Kalifornisches “Shine the Light.”',
    s8ShineText:
      'Section 1798.83 des California Civil Code erlaubt es Einwohnern Kaliforniens, Informationen über die Offenlegung personenbezogener Daten an Dritte zu deren Direktmarketingzwecken anzufordern. Wir geben personenbezogene Daten nicht an Dritte für deren eigene Direktmarketingzwecke weiter.',

    s9Title: '9. Sicherheit',
    s9Body:
      'Wir verwenden technische und organisatorische Maßnahmen zum Schutz deiner Informationen, darunter Verschlüsselung bei der Übertragung (TLS), gesalzenes Passwort-Hashing, signierte Sitzungstoken und Ratenbegrenzung bei Authentifizierungs-Endpunkten. Keine Methode der Übertragung oder Speicherung ist absolut sicher, und wir können keine vollständige Sicherheit garantieren.',

    s10Title: '10. Internationale Übermittlungen',
    s10Body:
      'Die Dienste werden von den Vereinigten Staaten aus betrieben. Wenn du außerhalb der Vereinigten Staaten darauf zugreifst, werden deine Informationen in die Vereinigten Staaten übermittelt, dort verarbeitet und gespeichert.',

    s11Title: '11. Kinder',
    s11Body:
      'Die Dienste richten sich nicht an Kinder unter 18 Jahren. Wir erheben wissentlich keine personenbezogenen Daten von Kindern unter 18 Jahren. Falls du glaubst, dass ein Kind uns personenbezogene Daten übermittelt hat, kontaktiere uns bitte, damit wir diese löschen können.',

    s12Title: '12. Änderungen dieser Richtlinie',
    s12Body:
      'Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren. Wenn wir dies tun, aktualisieren wir das oben genannte Gültigkeitsdatum und geben, sofern angemessen, über die Dienste einen zusätzlichen Hinweis.',

    s13Title: '13. Kontakt',
    s13Prefix: 'Fragen zu dieser Datenschutzerklärung können gesendet werden an',
  },
  es: {
    badgeLabel: 'Privacidad',
    pageTitle: 'Política de privacidad',
    effectiveDate: 'Fecha de entrada en vigor: {date}',

    s1Title: '1. Introducción',
    s1Body:
      'Esta Política de privacidad describe cómo ZeroGEX (“ZeroGEX,” “nosotros”) recopila, utiliza y comparte información sobre ti cuando usas el sitio web zerogex.io y los productos y servicios relacionados (colectivamente, los “Servicios”). Al usar los Servicios, aceptas esta Política de privacidad.',

    s2Title: '2. Información que recopilamos',
    s2Intro: 'Recopilamos las siguientes categorías de información:',
    s2Item1Label: 'Información de la cuenta.',
    s2Item1Text:
      'Dirección de correo electrónico, contraseña (almacenada como hash con salt) y, si inicias sesión con Google o Apple, el identificador único del proveedor y el correo electrónico devuelto por dicho proveedor.',
    s2Item2Label: 'Información de suscripción y pago.',
    s2Item2Text:
      'Nivel de suscripción, estado, periodo de facturación actual e identificadores de cliente/suscripción de Stripe. Los instrumentos de pago (números de tarjeta, fechas de vencimiento, direcciones de facturación) son recopilados y procesados por Stripe; no recibimos ni almacenamos los datos completos de la tarjeta.',
    s2Item3Label: 'Información de uso y dispositivo.',
    s2Item3Text:
      'Dirección IP, marcas de tiempo de solicitudes, páginas visitadas y metadatos básicos del navegador/dispositivo, utilizados para seguridad, prevención de abusos y análisis del producto.',
    s2Item4Label: 'Eventos de auditoría.',
    s2Item4Text:
      'Registros limitados de acciones de autenticación y gestión de cuentas (inicios de sesión, cambios de rol, cambios de suscripción) para seguridad y cumplimiento.',

    s3Title: '3. Cómo utilizamos la información',
    s3Item1: 'Proporcionar, mantener y mejorar los Servicios.',
    s3Item2: 'Autenticar a los usuarios y prevenir fraudes o abusos.',
    s3Item3: 'Procesar suscripciones y pagos a través de Stripe.',
    s3Item4: 'Aplicar el acceso a funciones según el nivel de suscripción.',
    s3Item5: 'Comunicarnos contigo sobre tu cuenta, facturación y cambios importantes en los Servicios.',
    s3Item6: 'Cumplir con obligaciones legales y responder a solicitudes legítimas.',

    s4Title: '4. Proveedores de servicios externos',
    s4Intro: 'Compartimos información con terceros que nos ayudan a operar los Servicios. Los principales proveedores son:',
    s4Item1Label: 'Stripe',
    s4Item1TextPrefix: '— procesamiento de pagos, portal de facturación y gestión de suscripciones. Las prácticas de privacidad de Stripe se describen en',
    s4Item2Label: 'Proveedores de infraestructura en la nube',
    s4Item2Text: '— alojamiento, almacenamiento y distribución de contenido para los Servicios.',
    s4Item3Label: 'Proveedores de identidad',
    s4Item3Text: '— Google y Apple, cuando eliges iniciar sesión con esos servicios.',
    s4Closing:
      'No vendemos tu información personal. No compartimos información personal con terceros para sus propios fines de marketing.',

    s5Title: '5. Cookies y tecnologías similares',
    s5Body:
      'Utilizamos cookies propias para mantener tu sesión iniciada (una cookie de sesión) y para mitigar ataques de cross-site-request-forgery (una cookie CSRF). Las páginas alojadas por Stripe establecen sus propias cookies bajo su dominio, regidas por la política de privacidad de Stripe. La mayoría de los navegadores permiten rechazar o eliminar cookies; sin embargo, hacerlo puede hacer que partes de los Servicios dejen de funcionar.',

    s6Title: '6. Retención de datos',
    s6Body:
      'Conservamos la información de cuenta, suscripción y auditoría mientras tu cuenta permanezca activa y durante un periodo razonable después, para cumplir con obligaciones legales, fiscales o contables y resolver disputas. Puedes solicitar su eliminación como se describe a continuación.',

    s7Title: '7. Tus derechos',
    s7Prefix:
      'Según el lugar donde vivas, es posible que tengas derecho a acceder, corregir, eliminar o exportar tu información personal, o a oponerte o restringir determinados tratamientos. Para ejercer cualquiera de estos derechos, contáctanos en',
    s7Suffix:
      '. Es posible que necesitemos verificar tu identidad antes de actuar sobre una solicitud. No te discriminaremos por ejercer cualquiera de estos derechos.',

    s8Title: '8. Tus derechos de privacidad en EE. UU. (California y otros estados)',
    s8Intro:
      'Esta sección proporciona información adicional para residentes de California en virtud de la California Consumer Privacy Act, modificada por la California Privacy Rights Act (colectivamente, “CCPA”), y para residentes de otros estados de EE. UU. con leyes de privacidad integrales (incluyendo Virginia, Colorado, Connecticut y Utah). Estas leyes pueden otorgarte los derechos descritos a continuación, sujetos a ciertas excepciones.',
    s8CategoriesLabel: 'Categorías de información personal que recopilamos.',
    s8CategoriesText:
      'En los doce meses anteriores, hemos recopilado las siguientes categorías de información personal, como se describe en la Sección 2: identificadores (como la dirección de correo electrónico y los identificadores de cuenta); información comercial (como el nivel de suscripción, el estado y el periodo de facturación); información sobre actividad en internet u otras redes electrónicas (como la dirección IP, las marcas de tiempo de solicitudes y las páginas visitadas); y registros de auditoría de la actividad de cuenta y autenticación. Recopilamos esta información directamente de ti, de tu uso de los Servicios y de proveedores de identidad y pago como Google, Apple y Stripe. La utilizamos para los fines comerciales descritos en la Sección 3.',
    s8NoSaleLabel: 'Sin venta ni comparticiones de información personal.',
    s8NoSaleText:
      'No vendemos tu información personal ni la compartimos para publicidad conductual entre contextos o publicidad dirigida, según se definen estos términos en la CCPA y otras leyes estatales de privacidad. No lo hemos hecho en los doce meses anteriores, incluso respecto a información sobre consumidores menores de 16 años. Tampoco utilizamos ni divulgamos información personal sensible para fines que darían lugar a un derecho a limitar su uso.',
    s8RightsLabel: 'Tus derechos.',
    s8RightsIntro: 'Según tu estado de residencia, es posible que tengas derecho a:',
    s8RightsItem1Label: 'Conocer y acceder',
    s8RightsItem1Text:
      'a las categorías y elementos específicos de información personal que hemos recopilado sobre ti, las fuentes, los fines y las categorías de terceros a quienes se divulgó.',
    s8RightsItem2Label: 'Eliminar',
    s8RightsItem2Text: 'la información personal que hemos recopilado de ti, sujeto a excepciones legales.',
    s8RightsItem3Label: 'Corregir',
    s8RightsItem3Text: 'información personal inexacta que mantenemos sobre ti.',
    s8RightsItem4Label: 'Excluirte',
    s8RightsItem4Text:
      'de la venta o compartición de información personal y de la publicidad dirigida y ciertos perfiles (no realizamos estas actividades).',
    s8RightsItem5Label: 'Limitar el uso',
    s8RightsItem5Text:
      'de información personal sensible (no utilizamos información personal sensible para fines que requieran esta opción).',
    s8RightsItem6Label: 'No discriminación',
    s8RightsItem6TextPrefix: 'por ejercer tus derechos de privacidad y, cuando corresponda, el derecho a',
    s8RightsItem6AppealLabel: 'apelar',
    s8RightsItem6TextSuffix: 'una denegación de solicitud.',
    s8HowToLabel: 'Cómo ejercer tus derechos.',
    s8HowToPrefix: 'Tú o un agente autorizado que actúe en tu nombre puede enviar una solicitud escribiendo a',
    s8HowToSuffix:
      '. Para proteger tu información, tomaremos medidas razonables para verificar tu identidad antes de responder y podemos solicitar información adicional para ese fin. Responderemos dentro de los plazos exigidos por la ley aplicable. Si denegamos tu solicitud, puedes apelar respondiendo a nuestra respuesta; si tienes dudas sobre el resultado, puedes contactar a la fiscalía general de tu estado.',
    s8ShineLabel: '“Shine the Light” de California.',
    s8ShineText:
      'La Sección 1798.83 del Código Civil de California permite a los residentes de California solicitar información sobre la divulgación de información personal a terceros para sus fines de marketing directo. No compartimos información personal con terceros para sus propios fines de marketing directo.',

    s9Title: '9. Seguridad',
    s9Body:
      'Utilizamos medidas técnicas y organizativas diseñadas para proteger tu información, incluido el cifrado en tránsito (TLS), el hashing de contraseñas con salt, tokens de sesión firmados y limitación de tasa en los endpoints de autenticación. Ningún método de transmisión o almacenamiento es perfectamente seguro y no podemos garantizar una seguridad absoluta.',

    s10Title: '10. Transferencias internacionales',
    s10Body:
      'Los Servicios se operan desde Estados Unidos. Si accedes a ellos desde fuera de Estados Unidos, tu información será transferida, procesada y almacenada en Estados Unidos.',

    s11Title: '11. Menores',
    s11Body:
      'Los Servicios no están dirigidos a menores de 18 años. No recopilamos conscientemente información personal de menores de 18 años. Si crees que un menor nos ha proporcionado información personal, contáctanos para que podamos eliminarla.',

    s12Title: '12. Cambios a esta política',
    s12Body:
      'Podemos actualizar esta Política de privacidad de vez en cuando. Cuando lo hagamos, revisaremos la fecha de entrada en vigor indicada arriba y, cuando corresponda, proporcionaremos un aviso adicional a través de los Servicios.',

    s13Title: '13. Contacto',
    s13Prefix: 'Las preguntas sobre esta Política de privacidad pueden enviarse a',
  },
  fr: {
    badgeLabel: 'Confidentialité',
    pageTitle: 'Politique de confidentialité',
    effectiveDate: 'Date d’entrée en vigueur : {date}',

    s1Title: '1. Introduction',
    s1Body:
      'Cette Politique de confidentialité décrit comment ZeroGEX (« ZeroGEX », « nous ») collecte, utilise et partage des informations vous concernant lorsque vous utilisez le site zerogex.io ainsi que les produits et services associés (collectivement, les « Services »). En utilisant les Services, vous acceptez cette Politique de confidentialité.',

    s2Title: '2. Informations que nous collectons',
    s2Intro: 'Nous collectons les catégories d’informations suivantes :',
    s2Item1Label: 'Informations de compte.',
    s2Item1Text:
      'Adresse e-mail, mot de passe (stocké sous forme de hachage salé) et, si vous vous connectez avec Google ou Apple, l’identifiant unique du fournisseur et l’e-mail renvoyé par ce fournisseur.',
    s2Item2Label: 'Informations d’abonnement et de paiement.',
    s2Item2Text:
      'Niveau d’abonnement, statut, période de facturation en cours et identifiants client/abonnement Stripe. Les instruments de paiement (numéros de carte, dates d’expiration, adresses de facturation) sont collectés et traités par Stripe ; nous ne recevons ni ne conservons les données complètes de carte.',
    s2Item3Label: 'Informations d’utilisation et d’appareil.',
    s2Item3Text:
      'Adresse IP, horodatages des requêtes, pages visitées et métadonnées de base du navigateur/appareil, utilisés à des fins de sécurité, de prévention des abus et d’analyse du produit.',
    s2Item4Label: 'Événements d’audit.',
    s2Item4Text:
      'Enregistrements limités des actions d’authentification et de gestion de compte (connexions, changements de rôle, changements d’abonnement) à des fins de sécurité et de conformité.',

    s3Title: '3. Comment nous utilisons les informations',
    s3Item1: 'Fournir, maintenir et améliorer les Services.',
    s3Item2: 'Authentifier les utilisateurs et prévenir la fraude ou les abus.',
    s3Item3: 'Traiter les abonnements et les paiements via Stripe.',
    s3Item4: 'Appliquer l’accès aux fonctionnalités selon le niveau d’abonnement.',
    s3Item5: 'Communiquer avec vous au sujet de votre compte, de la facturation et des modifications importantes des Services.',
    s3Item6: 'Nous conformer aux obligations légales et répondre aux demandes légitimes.',

    s4Title: '4. Prestataires de services tiers',
    s4Intro: 'Nous partageons des informations avec des tiers qui nous aident à exploiter les Services. Les principaux prestataires sont :',
    s4Item1Label: 'Stripe',
    s4Item1TextPrefix: '— traitement des paiements, portail de facturation et gestion des abonnements. Les pratiques de confidentialité de Stripe sont décrites sur',
    s4Item2Label: 'Fournisseurs d’infrastructure cloud',
    s4Item2Text: '— hébergement, stockage et diffusion de contenu pour les Services.',
    s4Item3Label: 'Fournisseurs d’identité',
    s4Item3Text: '— Google et Apple, lorsque vous choisissez de vous connecter via ces services.',
    s4Closing:
      'Nous ne vendons pas vos informations personnelles. Nous ne partageons pas d’informations personnelles avec des tiers à des fins de marketing propres.',

    s5Title: '5. Cookies et technologies similaires',
    s5Body:
      'Nous utilisons des cookies propriétaires pour vous maintenir connecté (un cookie de session) et pour atténuer les attaques de type cross-site-request-forgery (un cookie CSRF). Les pages hébergées par Stripe placent leurs propres cookies sous leur domaine, régis par la politique de confidentialité de Stripe. La plupart des navigateurs permettent de refuser ou de supprimer les cookies ; toutefois, cela peut rendre certaines parties des Services inutilisables.',

    s6Title: '6. Conservation des données',
    s6Body:
      'Nous conservons les informations de compte, d’abonnement et d’audit tant que votre compte reste actif, puis pendant une période raisonnable par la suite afin de respecter des obligations légales, fiscales ou comptables et de résoudre d’éventuels litiges. Vous pouvez demander leur suppression comme décrit ci-dessous.',

    s7Title: '7. Vos droits',
    s7Prefix:
      'Selon votre lieu de résidence, vous pouvez avoir le droit d’accéder à vos informations personnelles, de les corriger, de les supprimer ou de les exporter, ou de vous opposer à certains traitements ou de les limiter. Pour exercer l’un de ces droits, contactez-nous à',
    s7Suffix:
      '. Nous pourrions avoir besoin de vérifier votre identité avant de donner suite à une demande. Nous ne vous discriminerons pas pour avoir exercé l’un de ces droits.',

    s8Title: '8. Vos droits en matière de confidentialité aux États-Unis (Californie et autres États)',
    s8Intro:
      'Cette section fournit des informations supplémentaires pour les résidents de Californie en vertu du California Consumer Privacy Act, tel que modifié par le California Privacy Rights Act (collectivement, le « CCPA »), ainsi que pour les résidents d’autres États américains dotés de lois complètes sur la confidentialité (notamment la Virginie, le Colorado, le Connecticut et l’Utah). Ces lois peuvent vous accorder les droits décrits ci-dessous, sous réserve de certaines exceptions.',
    s8CategoriesLabel: 'Catégories d’informations personnelles que nous collectons.',
    s8CategoriesText:
      'Au cours des douze derniers mois, nous avons collecté les catégories suivantes d’informations personnelles, comme décrit à la Section 2 : identifiants (tels que l’adresse e-mail et les identifiants de compte) ; informations commerciales (telles que le niveau d’abonnement, le statut et la période de facturation) ; informations sur l’activité sur Internet ou d’autres réseaux électroniques (telles que l’adresse IP, les horodatages des requêtes et les pages visitées) ; ainsi que les enregistrements d’audit relatifs à l’activité du compte et à l’authentification. Nous collectons ces informations directement auprès de vous, via votre utilisation des Services, et auprès de fournisseurs d’identité et de paiement tels que Google, Apple et Stripe. Nous les utilisons aux fins commerciales décrites à la Section 3.',
    s8NoSaleLabel: 'Aucune vente ni partage d’informations personnelles.',
    s8NoSaleText:
      'Nous ne vendons pas vos informations personnelles et nous ne les partageons pas à des fins de publicité comportementale intercontextuelle ou de publicité ciblée, tels que ces termes sont définis par le CCPA et d’autres lois d’État sur la confidentialité. Nous ne l’avons pas fait au cours des douze derniers mois, y compris pour les informations concernant des consommateurs de moins de 16 ans. Nous n’utilisons ni ne divulguons non plus d’informations personnelles sensibles à des fins qui donneraient droit à en limiter l’utilisation.',
    s8RightsLabel: 'Vos droits.',
    s8RightsIntro: 'Selon votre État de résidence, vous pouvez avoir le droit :',
    s8RightsItem1Label: 'De savoir et d’accéder',
    s8RightsItem1Text:
      'aux catégories et aux éléments spécifiques d’informations personnelles que nous avons collectés à votre sujet, aux sources, aux finalités et aux catégories de tiers auxquels elles ont été divulguées.',
    s8RightsItem2Label: 'De supprimer',
    s8RightsItem2Text: 'les informations personnelles que nous avons collectées auprès de vous, sous réserve d’exceptions légales.',
    s8RightsItem3Label: 'De corriger',
    s8RightsItem3Text: 'les informations personnelles inexactes que nous conservons à votre sujet.',
    s8RightsItem4Label: 'De vous opposer',
    s8RightsItem4Text:
      'à la vente ou au partage d’informations personnelles ainsi qu’à la publicité ciblée et à certains profilages (nous ne pratiquons pas ces activités).',
    s8RightsItem5Label: 'De limiter l’utilisation',
    s8RightsItem5Text:
      'des informations personnelles sensibles (nous n’utilisons pas d’informations personnelles sensibles à des fins nécessitant cette option).',
    s8RightsItem6Label: 'Non-discrimination',
    s8RightsItem6TextPrefix: 'pour avoir exercé vos droits en matière de confidentialité et, le cas échéant, le droit de',
    s8RightsItem6AppealLabel: 'faire appel',
    s8RightsItem6TextSuffix: 'd’un refus de demande.',
    s8HowToLabel: 'Comment exercer vos droits.',
    s8HowToPrefix: 'Vous ou un agent autorisé agissant en votre nom pouvez soumettre une demande par e-mail à',
    s8HowToSuffix:
      '. Pour protéger vos informations, nous prendrons des mesures raisonnables pour vérifier votre identité avant de répondre, et nous pourrons demander des informations supplémentaires à cette fin. Nous répondrons dans les délais requis par la loi applicable. Si nous refusons votre demande, vous pouvez faire appel en répondant à notre réponse ; en cas de doute sur le résultat, vous pouvez contacter le procureur général de votre État.',
    s8ShineLabel: '« Shine the Light » de Californie.',
    s8ShineText:
      'La Section 1798.83 du California Civil Code permet aux résidents de Californie de demander des informations sur la divulgation d’informations personnelles à des tiers à des fins de marketing direct. Nous ne partageons pas d’informations personnelles avec des tiers à des fins de marketing direct propres.',

    s9Title: '9. Sécurité',
    s9Body:
      'Nous utilisons des mesures techniques et organisationnelles conçues pour protéger vos informations, notamment le chiffrement en transit (TLS), le hachage salé des mots de passe, des jetons de session signés et une limitation de débit sur les points de terminaison d’authentification. Aucune méthode de transmission ou de stockage n’est parfaitement sécurisée et nous ne pouvons garantir une sécurité absolue.',

    s10Title: '10. Transferts internationaux',
    s10Body:
      'Les Services sont exploités depuis les États-Unis. Si vous y accédez depuis l’extérieur des États-Unis, vos informations seront transférées vers, traitées et stockées aux États-Unis.',

    s11Title: '11. Mineurs',
    s11Body:
      'Les Services ne s’adressent pas aux enfants de moins de 18 ans. Nous ne collectons pas sciemment d’informations personnelles auprès d’enfants de moins de 18 ans. Si vous pensez qu’un enfant nous a fourni des informations personnelles, veuillez nous contacter afin que nous puissions les supprimer.',

    s12Title: '12. Modifications de cette politique',
    s12Body:
      'Nous pouvons mettre à jour cette Politique de confidentialité de temps à autre. Le cas échéant, nous réviserons la date d’entrée en vigueur ci-dessus et, si approprié, fournirons un avis supplémentaire via les Services.',

    s13Title: '13. Contact',
    s13Prefix: 'Les questions concernant cette Politique de confidentialité peuvent être envoyées à',
  },
};
