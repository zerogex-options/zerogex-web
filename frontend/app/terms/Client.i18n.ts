import type { PageDictionary } from '@/core/LanguageContext';

export const dict: PageDictionary = {
  en: {
    legalBadge: 'Legal',
    pageTitle: 'Terms of Service',
    effectiveDateLabel: 'Effective date: {date}',

    sectionTitle1: '1. Acceptance of Terms',
    s1Pre:
      'These Terms of Service (“Terms”) form a binding agreement between you and ZeroGEX (“ZeroGEX,” “we,” or “us”). By creating an account or using the website at zerogex.io and any related products and services (collectively, the “Services”), you accept these Terms and our',
    s1PrivacyLink: 'Privacy Policy',
    s1Post: '. If you do not agree, do not use the Services.',

    sectionTitle2: '2. Eligibility',
    s2Body:
      'You must be at least 18 years old and able to form a binding contract under applicable law to use the Services. By using the Services, you represent that you meet these requirements.',

    sectionTitle3: '3. Accounts',
    s3Pre:
      'You are responsible for the accuracy of your registration information, for safeguarding your credentials, and for all activity that occurs under your account. Notify us immediately at',
    s3Post: 'if you suspect unauthorized use.',

    sectionTitle4: '4. Subscriptions, Billing, and Cancellation',
    s4Intro:
      'Paid subscriptions are billed in advance on a recurring basis through Stripe at the rates and intervals shown when you subscribe. By subscribing, you authorize us and Stripe to charge your payment method for the applicable fees.',
    s4PlanChangesLabel: 'Plan changes.',
    s4PlanChangesBody:
      'Upgrades take effect immediately and are pro-rated for the remainder of the current billing period. Downgrades take effect at the end of the current billing period unless otherwise stated.',
    s4CancellationLabel: 'Cancellation.',
    s4CancellationBody:
      'You may cancel at any time through the Stripe-hosted billing portal. Cancellation takes effect at the end of the current paid billing period; you retain access to paid features until that period ends.',
    s4RefundsLabel: 'Refunds.',
    s4RefundsBody: 'Except where required by law, fees are non-refundable.',
    s4TaxesLabel: 'Taxes.',
    s4TaxesBody: 'Stated prices do not include taxes; you are responsible for any applicable taxes.',
    s4FailedPaymentsLabel: 'Failed payments.',
    s4FailedPaymentsBody:
      'If a charge fails, we may suspend or terminate access to paid features until the balance is resolved.',

    sectionTitle5: '5. Not Investment Advice',
    s5Body:
      'The Services provide options-market analytics, signals, and educational content for informational purposes only. Nothing on the Services constitutes investment advice, a recommendation to buy or sell any security or derivative, or a solicitation to enter into any transaction. ZeroGEX is not a registered investment adviser, broker-dealer, or financial planner. Trading options and derivatives involves substantial risk of loss and is not suitable for every investor. Past performance does not guarantee future results. You are solely responsible for your trading and investment decisions and should consult a qualified professional before making any.',

    sectionTitle6: '6. Acceptable Use',
    s6Intro: 'You agree not to:',
    s6Item1: 'Reverse engineer, decompile, or attempt to extract source code from the Services.',
    s6Item2:
      'Use the Services to build a competing product, scrape data at scale, or redistribute content without our written permission.',
    s6Item3: 'Share or resell account credentials or paid access.',
    s6Item4: 'Use the Services to violate any law or third-party rights.',
    s6Item5: 'Interfere with or disrupt the Services or any servers or networks connected to them.',
    s6Item6: 'Probe, scan, or test the vulnerability of the Services without authorization.',

    sectionTitle7: '7. Intellectual Property',
    s7Body:
      'We and our licensors retain all rights, title, and interest in and to the Services, including all software, content, and trademarks. Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Services for your personal or internal business use.',

    sectionTitle8: '8. Third-Party Services',
    s8Body:
      'The Services integrate with third-party providers, including Stripe for payment processing and Google or Apple for authentication. Your use of those services is governed by the respective provider’s terms and privacy policy. We are not responsible for the availability or behavior of any third-party service.',

    sectionTitle9: '9. Disclaimers',
    s9Body:
      'THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY DATA OR SIGNALS WILL BE ACCURATE OR PROFITABLE.',

    sectionTitle10: '10. Limitation of Liability',
    s10Body:
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, ZEROGEX AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST REVENUES, OR LOST DATA, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES WILL NOT EXCEED THE AMOUNTS YOU PAID US FOR THE SERVICES IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.',

    sectionTitle11: '11. Indemnification',
    s11Body:
      'You agree to defend, indemnify, and hold harmless ZeroGEX and its affiliates from any claims, liabilities, damages, losses, and expenses (including reasonable attorneys’ fees) arising out of your use of the Services, your violation of these Terms, or your violation of any third-party right.',

    sectionTitle12: '12. Termination',
    s12Body:
      'We may suspend or terminate your access to the Services at any time, with or without notice, for conduct that we reasonably believe violates these Terms or harms other users, us, or third parties. You may stop using the Services at any time and may cancel any active subscription as described in Section 4.',

    sectionTitle13: '13. Governing Law',
    s13Body:
      'These Terms are governed by the laws of the United States and the State of Delaware, without regard to conflict-of-laws rules. Subject to the arbitration agreement in Section 14, the exclusive venue for any dispute not subject to arbitration will be the state or federal courts located in Delaware, and you consent to personal jurisdiction in those courts.',

    sectionTitle14: '14. Dispute Resolution; Binding Arbitration',
    s14Intro:
      'Please read this section carefully. It affects your legal rights, including your right to file a lawsuit in court and to have disputes resolved by a jury or in a class action.',
    s14InformalLabel: 'Informal resolution.',
    s14InformalPre:
      'Before initiating any arbitration, you and ZeroGEX agree to first attempt to resolve the dispute informally by sending a written notice describing the dispute and the relief sought to',
    s14InformalPost:
      '. If the dispute is not resolved within sixty (60) days of the notice, either party may proceed to arbitration.',
    s14AgreementLabel: 'Agreement to arbitrate.',
    s14AgreementBody:
      'You and ZeroGEX agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Services, whether based in contract, tort, statute, fraud, or any other legal theory, will be resolved exclusively through final and binding individual arbitration, rather than in court, except as set out below. The Federal Arbitration Act governs the interpretation and enforcement of this Section.',
    s14RulesLabel: 'Arbitration rules and forum.',
    s14RulesBody:
      'The arbitration will be administered by the American Arbitration Association (“AAA”) under its Consumer Arbitration Rules then in effect, as modified by these Terms. The arbitration will be conducted by a single arbitrator. The arbitrator may conduct proceedings by telephone or video, or in writing, and any in-person hearing will take place in the county of your residence or another mutually agreed location. The arbitrator has exclusive authority to resolve any dispute relating to the interpretation, applicability, or enforceability of this arbitration agreement.',
    s14ClassActionLabel: 'Class action and jury trial waiver.',
    s14ClassActionBody:
      'YOU AND ZEROGEX AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON’S CLAIMS OR PRESIDE OVER ANY FORM OF A REPRESENTATIVE OR CLASS PROCEEDING. YOU AND ZEROGEX ALSO WAIVE ANY RIGHT TO A TRIAL BY JURY. If this class action waiver is found to be unenforceable as to a particular claim, that claim will be severed and may proceed in court, while all other claims will remain in arbitration.',
    s14ExceptionsLabel: 'Exceptions.',
    s14ExceptionsBody:
      'Either party may bring an individual action in small-claims court for disputes within that court’s jurisdiction. Nothing in this Section prevents either party from seeking injunctive or other equitable relief in court to protect its intellectual property rights.',
    s14OptOutLabel: '30-day opt-out.',
    s14OptOutPre: 'You may opt out of this arbitration agreement by sending written notice of your decision to',
    s14OptOutPost:
      'within thirty (30) days of first accepting these Terms. The notice must include your name, the email associated with your account, and a clear statement that you wish to opt out of arbitration. Opting out will not affect any other provision of these Terms.',

    sectionTitle15: '15. Changes to These Terms',
    s15Body:
      'We may modify these Terms from time to time. If we make material changes, we will revise the effective date above and, where appropriate, provide additional notice through the Services. Your continued use of the Services after the effective date constitutes acceptance of the revised Terms.',

    sectionTitle16: '16. Contact',
    s16Pre: 'Questions about these Terms can be sent to',
  },
  it: {
    legalBadge: 'Legale',
    pageTitle: 'Termini di Servizio',
    effectiveDateLabel: 'Data di entrata in vigore: {date}',

    sectionTitle1: '1. Accettazione dei Termini',
    s1Pre:
      'I presenti Termini di Servizio (i “Termini”) costituiscono un accordo vincolante tra te e ZeroGEX (“ZeroGEX”, “noi”). Creando un account o utilizzando il sito zerogex.io e qualsiasi prodotto o servizio correlato (collettivamente, i “Servizi”), accetti questi Termini e la nostra',
    s1PrivacyLink: 'Informativa sulla Privacy',
    s1Post: '. Se non accetti, non utilizzare i Servizi.',

    sectionTitle2: '2. Idoneità',
    s2Body:
      'Devi avere almeno 18 anni ed essere in grado di stipulare un contratto vincolante ai sensi della legge applicabile per utilizzare i Servizi. Utilizzando i Servizi, dichiari di soddisfare questi requisiti.',

    sectionTitle3: '3. Account',
    s3Pre:
      'Sei responsabile dell’accuratezza dei tuoi dati di registrazione, della protezione delle tue credenziali e di tutte le attività svolte tramite il tuo account. Contattaci immediatamente a',
    s3Post: 'se sospetti un utilizzo non autorizzato.',

    sectionTitle4: '4. Abbonamenti, Fatturazione e Cancellazione',
    s4Intro:
      'Gli abbonamenti a pagamento vengono fatturati anticipatamente su base ricorrente tramite Stripe alle tariffe e agli intervalli indicati al momento dell’iscrizione. Iscrivendoti, autorizzi noi e Stripe ad addebitare il tuo metodo di pagamento per le tariffe applicabili.',
    s4PlanChangesLabel: 'Cambio piano.',
    s4PlanChangesBody:
      'Gli upgrade hanno effetto immediato e sono calcolati proporzionalmente per il resto del periodo di fatturazione in corso. I downgrade hanno effetto alla fine del periodo di fatturazione in corso, salvo diversa indicazione.',
    s4CancellationLabel: 'Cancellazione.',
    s4CancellationBody:
      'Puoi cancellare in qualsiasi momento tramite il portale di fatturazione ospitato da Stripe. La cancellazione ha effetto alla fine del periodo di fatturazione a pagamento in corso; mantieni l’accesso alle funzionalità a pagamento fino alla fine di tale periodo.',
    s4RefundsLabel: 'Rimborsi.',
    s4RefundsBody: 'Salvo quanto richiesto dalla legge, le tariffe non sono rimborsabili.',
    s4TaxesLabel: 'Tasse.',
    s4TaxesBody: 'I prezzi indicati non includono le tasse; sei responsabile di eventuali imposte applicabili.',
    s4FailedPaymentsLabel: 'Pagamenti falliti.',
    s4FailedPaymentsBody:
      'In caso di addebito non riuscito, potremmo sospendere o terminare l’accesso alle funzionalità a pagamento fino alla risoluzione del saldo.',

    sectionTitle5: '5. Non Costituisce Consulenza sugli Investimenti',
    s5Body:
      'I Servizi forniscono analisi, segnali e contenuti educativi sul mercato delle opzioni esclusivamente a scopo informativo. Nulla nei Servizi costituisce consulenza sugli investimenti, una raccomandazione ad acquistare o vendere titoli o derivati, o una sollecitazione a concludere alcuna transazione. ZeroGEX non è un consulente per gli investimenti registrato, un broker-dealer o un pianificatore finanziario. Il trading di opzioni e derivati comporta un rischio sostanziale di perdita e non è adatto a tutti gli investitori. I risultati passati non garantiscono risultati futuri. Sei l’unico responsabile delle tue decisioni di trading e di investimento e dovresti consultare un professionista qualificato prima di prenderne.',

    sectionTitle6: '6. Uso Consentito',
    s6Intro: 'Accetti di non:',
    s6Item1: 'Decompilare, decodificare o tentare di estrarre il codice sorgente dei Servizi.',
    s6Item2:
      'Utilizzare i Servizi per creare un prodotto concorrente, effettuare scraping massivo di dati o ridistribuire contenuti senza il nostro consenso scritto.',
    s6Item3: 'Condividere o rivendere le credenziali dell’account o l’accesso a pagamento.',
    s6Item4: 'Utilizzare i Servizi per violare leggi o diritti di terzi.',
    s6Item5: 'Interferire con o interrompere i Servizi o qualsiasi server o rete a essi collegati.',
    s6Item6: 'Sondare, scansionare o testare la vulnerabilità dei Servizi senza autorizzazione.',

    sectionTitle7: '7. Proprietà Intellettuale',
    s7Body:
      'Noi e i nostri licenzianti manteniamo tutti i diritti, i titoli e gli interessi relativi ai Servizi, incluso tutto il software, i contenuti e i marchi. Nel rispetto di questi Termini, ti concediamo una licenza limitata, non esclusiva, non trasferibile e revocabile per accedere e utilizzare i Servizi per uso personale o aziendale interno.',

    sectionTitle8: '8. Servizi di Terze Parti',
    s8Body:
      'I Servizi si integrano con fornitori terzi, tra cui Stripe per l’elaborazione dei pagamenti e Google o Apple per l’autenticazione. L’uso di tali servizi è regolato dai rispettivi termini e informative sulla privacy dei fornitori. Non siamo responsabili della disponibilità o del comportamento di alcun servizio di terze parti.',

    sectionTitle9: '9. Esclusioni di Garanzia',
    s9Body:
      'I SERVIZI SONO FORNITI “COSÌ COME SONO” E “COME DISPONIBILI”, SENZA GARANZIE DI ALCUN TIPO, ESPRESSE, IMPLICITE O DI LEGGE, COMPRESE LE GARANZIE DI COMMERCIABILITÀ, IDONEITÀ A UNO SCOPO PARTICOLARE, NON VIOLAZIONE E ACCURATEZZA. NON GARANTIAMO CHE I SERVIZI SARANNO ININTERROTTI, PRIVI DI ERRORI O SICURI, NÉ CHE QUALSIASI DATO O SEGNALE SIA ACCURATO O REDDITIZIO.',

    sectionTitle10: '10. Limitazione di Responsabilità',
    s10Body:
      'NELLA MISURA MASSIMA CONSENTITA DALLA LEGGE, ZEROGEX E LE SUE AFFILIATE, DIRIGENTI, DIPENDENTI E AGENTI NON SARANNO RESPONSABILI PER DANNI INDIRETTI, INCIDENTALI, SPECIALI, CONSEQUENZIALI O PUNITIVI, INCLUSI MANCATI PROFITTI, MANCATI RICAVI O PERDITA DI DATI, DERIVANTI DALL’USO DEI SERVIZI, ANCHE SE INFORMATI DELLA POSSIBILITÀ DI TALI DANNI. LA NOSTRA RESPONSABILITÀ TOTALE PER QUALSIASI RECLAMO DERIVANTE DA QUESTI TERMINI O DAI SERVIZI NON SUPERERÀ GLI IMPORTI DA TE PAGATI PER I SERVIZI NEI DODICI (12) MESI PRECEDENTI L’EVENTO CHE HA DATO ORIGINE AL RECLAMO.',

    sectionTitle11: '11. Manleva',
    s11Body:
      'Accetti di difendere, indennizzare e tenere indenne ZeroGEX e le sue affiliate da qualsiasi reclamo, responsabilità, danno, perdita e spesa (comprese le ragionevoli spese legali) derivanti dal tuo utilizzo dei Servizi, dalla tua violazione di questi Termini o dalla tua violazione di diritti di terzi.',

    sectionTitle12: '12. Risoluzione',
    s12Body:
      'Possiamo sospendere o terminare il tuo accesso ai Servizi in qualsiasi momento, con o senza preavviso, per condotte che riteniamo ragionevolmente violino questi Termini o danneggino altri utenti, noi o terze parti. Puoi interrompere l’uso dei Servizi in qualsiasi momento e cancellare qualsiasi abbonamento attivo come descritto nella Sezione 4.',

    sectionTitle13: '13. Legge Applicabile',
    s13Body:
      'Questi Termini sono regolati dalle leggi degli Stati Uniti e dello Stato del Delaware, senza riguardo ai principi di conflitto di leggi. Fatto salvo l’accordo di arbitrato di cui alla Sezione 14, il foro esclusivo per qualsiasi controversia non soggetta ad arbitrato saranno i tribunali statali o federali situati nel Delaware, e acconsenti alla giurisdizione personale di tali tribunali.',

    sectionTitle14: '14. Risoluzione delle Controversie; Arbitrato Vincolante',
    s14Intro:
      'Leggi attentamente questa sezione. Riguarda i tuoi diritti legali, incluso il diritto di intentare una causa in tribunale e di far risolvere le controversie da una giuria o in un’azione collettiva.',
    s14InformalLabel: 'Risoluzione informale.',
    s14InformalPre:
      'Prima di avviare qualsiasi arbitrato, tu e ZeroGEX concordate di tentare prima di risolvere la controversia in modo informale inviando una notifica scritta che descriva la controversia e il rimedio richiesto a',
    s14InformalPost:
      '. Se la controversia non viene risolta entro sessanta (60) giorni dalla notifica, entrambe le parti possono procedere all’arbitrato.',
    s14AgreementLabel: 'Accordo di arbitrato.',
    s14AgreementBody:
      'Tu e ZeroGEX concordate che qualsiasi controversia, reclamo o disputa derivante da o relativa a questi Termini o ai Servizi, basata su contratto, illecito, statuto, frode o qualsiasi altra teoria legale, sarà risolta esclusivamente tramite arbitrato individuale finale e vincolante, anziché in tribunale, salvo quanto indicato di seguito. Il Federal Arbitration Act disciplina l’interpretazione e l’applicazione di questa Sezione.',
    s14RulesLabel: 'Regole e sede dell’arbitrato.',
    s14RulesBody:
      'L’arbitrato sarà amministrato dalla American Arbitration Association (“AAA”) secondo le sue Consumer Arbitration Rules allora in vigore, come modificate da questi Termini. L’arbitrato sarà condotto da un singolo arbitro. L’arbitro può condurre i procedimenti telefonicamente, tramite video o per iscritto, ed eventuali udienze di persona si terranno nella contea della tua residenza o in un’altra sede concordata reciprocamente. L’arbitro ha autorità esclusiva per risolvere qualsiasi controversia relativa all’interpretazione, applicabilità o eseguibilità di questo accordo di arbitrato.',
    s14ClassActionLabel: 'Rinuncia all’azione collettiva e al processo con giuria.',
    s14ClassActionBody:
      'TU E ZEROGEX CONCORDATE CHE CIASCUNO PUÒ PRESENTARE RECLAMI CONTRO L’ALTRO SOLO A TITOLO INDIVIDUALE, E NON COME ATTORE O MEMBRO DI UNA CLASSE IN QUALSIASI PROCEDIMENTO DI CLASSE, COLLETTIVO, CONSOLIDATO O RAPPRESENTATIVO. L’ARBITRO NON PUÒ CONSOLIDARE I RECLAMI DI PIÙ DI UNA PERSONA NÉ PRESIEDERE ALCUNA FORMA DI PROCEDIMENTO RAPPRESENTATIVO O DI CLASSE. TU E ZEROGEX RINUNCIATE ANCHE A QUALSIASI DIRITTO A UN PROCESSO CON GIURIA. Se questa rinuncia all’azione collettiva dovesse risultare inapplicabile a un particolare reclamo, tale reclamo sarà separato e potrà procedere in tribunale, mentre tutti gli altri reclami rimarranno in arbitrato.',
    s14ExceptionsLabel: 'Eccezioni.',
    s14ExceptionsBody:
      'Ciascuna parte può intentare un’azione individuale presso il tribunale delle piccole controversie per le dispute rientranti nella giurisdizione di tale tribunale. Nulla in questa Sezione impedisce a ciascuna parte di richiedere provvedimenti ingiuntivi o altra tutela equitativa in tribunale per proteggere i propri diritti di proprietà intellettuale.',
    s14OptOutLabel: 'Rinuncia entro 30 giorni.',
    s14OptOutPre:
      'Puoi rinunciare a questo accordo di arbitrato inviando una notifica scritta della tua decisione a',
    s14OptOutPost:
      'entro trenta (30) giorni dalla prima accettazione di questi Termini. La notifica deve includere il tuo nome, l’email associata al tuo account e una chiara dichiarazione che desideri rinunciare all’arbitrato. La rinuncia non inciderà su nessun’altra disposizione di questi Termini.',

    sectionTitle15: '15. Modifiche a Questi Termini',
    s15Body:
      'Potremmo modificare questi Termini di tanto in tanto. Se apportiamo modifiche sostanziali, aggiorneremo la data di entrata in vigore sopra indicata e, ove opportuno, forniremo un’ulteriore notifica tramite i Servizi. Il continuo utilizzo dei Servizi dopo la data di entrata in vigore costituisce accettazione dei Termini rivisti.',

    sectionTitle16: '16. Contatti',
    s16Pre: 'Le domande su questi Termini possono essere inviate a',
  },
  de: {
    legalBadge: 'Rechtliches',
    pageTitle: 'Nutzungsbedingungen',
    effectiveDateLabel: 'Gültig ab: {date}',

    sectionTitle1: '1. Annahme der Bedingungen',
    s1Pre:
      'Diese Nutzungsbedingungen (die „Bedingungen“) bilden eine verbindliche Vereinbarung zwischen Ihnen und ZeroGEX („ZeroGEX“, „wir“ oder „uns“). Durch die Erstellung eines Kontos oder die Nutzung der Website zerogex.io sowie damit verbundener Produkte und Dienste (zusammen die „Dienste“) akzeptieren Sie diese Bedingungen und unsere',
    s1PrivacyLink: 'Datenschutzrichtlinie',
    s1Post: '. Wenn Sie nicht einverstanden sind, nutzen Sie die Dienste nicht.',

    sectionTitle2: '2. Voraussetzungen',
    s2Body:
      'Sie müssen mindestens 18 Jahre alt und nach geltendem Recht in der Lage sein, einen verbindlichen Vertrag abzuschließen, um die Dienste nutzen zu können. Mit der Nutzung der Dienste bestätigen Sie, dass Sie diese Voraussetzungen erfüllen.',

    sectionTitle3: '3. Konten',
    s3Pre:
      'Sie sind verantwortlich für die Richtigkeit Ihrer Registrierungsdaten, den Schutz Ihrer Zugangsdaten und alle Aktivitäten, die unter Ihrem Konto stattfinden. Benachrichtigen Sie uns umgehend unter',
    s3Post: 'wenn Sie eine unbefugte Nutzung vermuten.',

    sectionTitle4: '4. Abonnements, Abrechnung und Kündigung',
    s4Intro:
      'Kostenpflichtige Abonnements werden im Voraus wiederkehrend über Stripe zu den bei der Anmeldung angezeigten Preisen und Intervallen abgerechnet. Mit dem Abschluss eines Abonnements autorisieren Sie uns und Stripe, Ihre Zahlungsmethode mit den entsprechenden Gebühren zu belasten.',
    s4PlanChangesLabel: 'Planänderungen.',
    s4PlanChangesBody:
      'Upgrades werden sofort wirksam und anteilig für den Rest des aktuellen Abrechnungszeitraums berechnet. Downgrades werden am Ende des aktuellen Abrechnungszeitraums wirksam, sofern nicht anders angegeben.',
    s4CancellationLabel: 'Kündigung.',
    s4CancellationBody:
      'Sie können jederzeit über das von Stripe gehostete Abrechnungsportal kündigen. Die Kündigung wird am Ende des aktuellen bezahlten Abrechnungszeitraums wirksam; Sie behalten den Zugang zu kostenpflichtigen Funktionen bis zum Ende dieses Zeitraums.',
    s4RefundsLabel: 'Erstattungen.',
    s4RefundsBody: 'Sofern gesetzlich nicht anders vorgeschrieben, sind Gebühren nicht erstattungsfähig.',
    s4TaxesLabel: 'Steuern.',
    s4TaxesBody:
      'Die angegebenen Preise enthalten keine Steuern; Sie sind für etwaige anfallende Steuern verantwortlich.',
    s4FailedPaymentsLabel: 'Fehlgeschlagene Zahlungen.',
    s4FailedPaymentsBody:
      'Wenn eine Zahlung fehlschlägt, können wir den Zugang zu kostenpflichtigen Funktionen aussetzen oder beenden, bis der ausstehende Betrag beglichen ist.',

    sectionTitle5: '5. Keine Anlageberatung',
    s5Body:
      'Die Dienste bieten Optionsmarkt-Analysen, Signale und Bildungsinhalte ausschließlich zu Informationszwecken. Nichts in den Diensten stellt eine Anlageberatung, eine Empfehlung zum Kauf oder Verkauf von Wertpapieren oder Derivaten oder eine Aufforderung zum Abschluss einer Transaktion dar. ZeroGEX ist kein registrierter Anlageberater, Broker-Dealer oder Finanzplaner. Der Handel mit Optionen und Derivaten ist mit erheblichem Verlustrisiko verbunden und nicht für jeden Anleger geeignet. Die vergangene Performance garantiert keine zukünftigen Ergebnisse. Sie sind allein verantwortlich für Ihre Handels- und Anlageentscheidungen und sollten vor jeder Entscheidung einen qualifizierten Fachmann konsultieren.',

    sectionTitle6: '6. Zulässige Nutzung',
    s6Intro: 'Sie verpflichten sich, Folgendes zu unterlassen:',
    s6Item1: 'Reverse Engineering, Dekompilierung oder der Versuch, Quellcode aus den Diensten zu extrahieren.',
    s6Item2:
      'Die Nutzung der Dienste zum Aufbau eines Konkurrenzprodukts, zum massenhaften Scrapen von Daten oder zur Weiterverbreitung von Inhalten ohne unsere schriftliche Genehmigung.',
    s6Item3: 'Weitergabe oder Weiterverkauf von Kontodaten oder kostenpflichtigem Zugang.',
    s6Item4: 'Die Nutzung der Dienste zur Verletzung von Gesetzen oder Rechten Dritter.',
    s6Item5: 'Die Störung oder Unterbrechung der Dienste oder damit verbundener Server oder Netzwerke.',
    s6Item6: 'Das unbefugte Testen, Scannen oder Untersuchen der Schwachstellen der Dienste.',

    sectionTitle7: '7. Geistiges Eigentum',
    s7Body:
      'Wir und unsere Lizenzgeber behalten alle Rechte, Titel und Ansprüche an den Diensten, einschließlich sämtlicher Software, Inhalte und Marken. Vorbehaltlich Ihrer Einhaltung dieser Bedingungen gewähren wir Ihnen eine beschränkte, nicht ausschließliche, nicht übertragbare und widerrufliche Lizenz zur Nutzung der Dienste für Ihren persönlichen oder internen geschäftlichen Gebrauch.',

    sectionTitle8: '8. Dienste Dritter',
    s8Body:
      'Die Dienste sind mit Drittanbietern integriert, darunter Stripe für die Zahlungsabwicklung sowie Google oder Apple für die Authentifizierung. Ihre Nutzung dieser Dienste unterliegt den jeweiligen Bedingungen und Datenschutzrichtlinien der Anbieter. Wir sind nicht verantwortlich für die Verfügbarkeit oder das Verhalten von Diensten Dritter.',

    sectionTitle9: '9. Haftungsausschluss',
    s9Body:
      'DIE DIENSTE WERDEN „WIE BESEHEN“ UND „WIE VERFÜGBAR“ BEREITGESTELLT, OHNE JEGLICHE GEWÄHRLEISTUNG, WEDER AUSDRÜCKLICH, KONKLUDENT NOCH GESETZLICH, EINSCHLIEßLICH DER GEWÄHRLEISTUNG DER MARKTGÄNGIGKEIT, EIGNUNG FÜR EINEN BESTIMMTEN ZWECK, NICHTVERLETZUNG UND GENAUIGKEIT. WIR GEWÄHRLEISTEN NICHT, DASS DIE DIENSTE UNUNTERBROCHEN, FEHLERFREI ODER SICHER SIND ODER DASS DATEN ODER SIGNALE GENAU ODER GEWINNBRINGEND SIND.',

    sectionTitle10: '10. Haftungsbeschränkung',
    s10Body:
      'SOWEIT GESETZLICH ZULÄSSIG, HAFTEN ZEROGEX UND SEINE VERBUNDENEN UNTERNEHMEN, LEITENDEN ANGESTELLTEN, MITARBEITER UND VERTRETER NICHT FÜR INDIREKTE, ZUFÄLLIGE, BESONDERE, FOLGE- ODER STRAFSCHADEN, EINSCHLIESSLICH ENTGANGENER GEWINNE, ENTGANGENER EINNAHMEN ODER DATENVERLUSTE, DIE SICH AUS ODER IM ZUSAMMENHANG MIT IHRER NUTZUNG DER DIENSTE ERGEBEN, SELBST WENN AUF DIE MÖGLICHKEIT SOLCHER SCHÄDEN HINGEWIESEN WURDE. UNSERE GESAMTHAFTUNG FÜR ANSPRÜCHE IM ZUSAMMENHANG MIT DIESEN BEDINGUNGEN ODER DEN DIENSTEN ÜBERSTEIGT NICHT DIE BETRÄGE, DIE SIE UNS IN DEN ZWÖLF (12) MONATEN VOR DEM EREIGNIS, DAS ZU DEM ANSPRUCH FÜHRTE, FÜR DIE DIENSTE GEZAHLT HABEN.',

    sectionTitle11: '11. Freistellung',
    s11Body:
      'Sie verpflichten sich, ZeroGEX und seine verbundenen Unternehmen von allen Ansprüchen, Haftungen, Schäden, Verlusten und Kosten (einschließlich angemessener Anwaltskosten) zu verteidigen, freizustellen und schadlos zu halten, die sich aus Ihrer Nutzung der Dienste, Ihrer Verletzung dieser Bedingungen oder Ihrer Verletzung von Rechten Dritter ergeben.',

    sectionTitle12: '12. Kündigung',
    s12Body:
      'Wir können Ihren Zugang zu den Diensten jederzeit mit oder ohne Vorankündigung aussetzen oder beenden, wenn wir vernünftigerweise glauben, dass ein Verhalten gegen diese Bedingungen verstößt oder anderen Nutzern, uns oder Dritten schadet. Sie können die Nutzung der Dienste jederzeit beenden und ein aktives Abonnement gemäß Abschnitt 4 kündigen.',

    sectionTitle13: '13. Anwendbares Recht',
    s13Body:
      'Diese Bedingungen unterliegen den Gesetzen der Vereinigten Staaten und des Bundesstaates Delaware, ohne Rücksicht auf Kollisionsnormen. Vorbehaltlich der Schiedsvereinbarung in Abschnitt 14 ist der ausschließliche Gerichtsstand für Streitigkeiten, die nicht dem Schiedsverfahren unterliegen, die staatlichen oder bundesstaatlichen Gerichte in Delaware, und Sie stimmen der persönlichen Zuständigkeit dieser Gerichte zu.',

    sectionTitle14: '14. Streitbeilegung; Verbindliches Schiedsverfahren',
    s14Intro:
      'Bitte lesen Sie diesen Abschnitt sorgfältig. Er betrifft Ihre gesetzlichen Rechte, einschließlich Ihres Rechts, eine Klage vor Gericht zu erheben und Streitigkeiten durch eine Jury oder in einer Sammelklage klären zu lassen.',
    s14InformalLabel: 'Informelle Beilegung.',
    s14InformalPre:
      'Bevor ein Schiedsverfahren eingeleitet wird, vereinbaren Sie und ZeroGEX, zunächst zu versuchen, den Streit informell beizulegen, indem eine schriftliche Mitteilung mit Beschreibung des Streits und der gewünschten Abhilfe gesendet wird an',
    s14InformalPost:
      '. Wird der Streit nicht innerhalb von sechzig (60) Tagen nach der Mitteilung beigelegt, kann jede Partei ein Schiedsverfahren einleiten.',
    s14AgreementLabel: 'Schiedsvereinbarung.',
    s14AgreementBody:
      'Sie und ZeroGEX vereinbaren, dass jede Streitigkeit, jeder Anspruch oder jede Kontroverse, die sich aus oder im Zusammenhang mit diesen Bedingungen oder den Diensten ergibt, unabhängig davon, ob sie auf Vertrag, unerlaubter Handlung, Gesetz, Betrug oder einer anderen Rechtstheorie beruht, ausschließlich durch ein endgültiges und verbindliches Einzelschiedsverfahren und nicht vor Gericht beigelegt wird, außer wie nachstehend angegeben. Der Federal Arbitration Act regelt die Auslegung und Durchsetzung dieses Abschnitts.',
    s14RulesLabel: 'Schiedsregeln und Schiedsort.',
    s14RulesBody:
      'Das Schiedsverfahren wird von der American Arbitration Association („AAA“) gemäß ihren jeweils geltenden Consumer Arbitration Rules, wie durch diese Bedingungen abgeändert, durchgeführt. Das Schiedsverfahren wird von einem einzelnen Schiedsrichter durchgeführt. Der Schiedsrichter kann Verfahren telefonisch, per Video oder schriftlich durchführen, und persönliche Anhörungen finden im Landkreis Ihres Wohnsitzes oder an einem anderen einvernehmlich vereinbarten Ort statt. Der Schiedsrichter hat die ausschließliche Befugnis, Streitigkeiten über die Auslegung, Anwendbarkeit oder Durchsetzbarkeit dieser Schiedsvereinbarung zu entscheiden.',
    s14ClassActionLabel: 'Verzicht auf Sammelklagen und Geschworenenverfahren.',
    s14ClassActionBody:
      'SIE UND ZEROGEX VEREINBAREN, DASS JEDE PARTEI ANSPRÜCHE GEGEN DIE ANDERE NUR ALS EINZELPERSON GELTEND MACHEN KANN UND NICHT ALS KLÄGER ODER MITGLIED EINER SAMMEL-, GEMEINSCHAFTS-, ZUSAMMENGEFASSTEN ODER REPRÄSENTATIVEN KLAGE. DER SCHIEDSRICHTER DARF DIE ANSPRÜCHE MEHRERER PERSONEN NICHT ZUSAMMENFASSEN ODER EINER FORM VON REPRÄSENTATIVEM VERFAHREN ODER SAMMELKLAGE VORSITZEN. SIE UND ZEROGEX VERZICHTEN AUCH AUF JEDES RECHT AUF EIN GESCHWORENENVERFAHREN. Sollte dieser Verzicht auf Sammelklagen in Bezug auf einen bestimmten Anspruch als nicht durchsetzbar angesehen werden, wird dieser Anspruch abgetrennt und kann vor Gericht fortgesetzt werden, während alle anderen Ansprüche im Schiedsverfahren verbleiben.',
    s14ExceptionsLabel: 'Ausnahmen.',
    s14ExceptionsBody:
      'Jede Partei kann eine Einzelklage vor einem Bagatellgericht für Streitigkeiten einreichen, die in dessen Zuständigkeit fallen. Nichts in diesem Abschnitt hindert eine Partei daran, einstweilige Verfügungen oder andere Billigkeitsmaßnahmen vor Gericht zum Schutz ihrer Rechte an geistigem Eigentum zu beantragen.',
    s14OptOutLabel: '30-tägiges Opt-out.',
    s14OptOutPre:
      'Sie können von dieser Schiedsvereinbarung zurücktreten, indem Sie eine schriftliche Mitteilung über Ihre Entscheidung senden an',
    s14OptOutPost:
      'innerhalb von dreißig (30) Tagen nach erstmaliger Annahme dieser Bedingungen. Die Mitteilung muss Ihren Namen, die mit Ihrem Konto verknüpfte E-Mail-Adresse und eine klare Erklärung enthalten, dass Sie vom Schiedsverfahren zurücktreten möchten. Der Rücktritt hat keine Auswirkungen auf andere Bestimmungen dieser Bedingungen.',

    sectionTitle15: '15. Änderungen dieser Bedingungen',
    s15Body:
      'Wir können diese Bedingungen von Zeit zu Zeit ändern. Bei wesentlichen Änderungen aktualisieren wir das oben genannte Gültigkeitsdatum und geben, sofern angemessen, eine zusätzliche Mitteilung über die Dienste. Die fortgesetzte Nutzung der Dienste nach dem Gültigkeitsdatum gilt als Annahme der überarbeiteten Bedingungen.',

    sectionTitle16: '16. Kontakt',
    s16Pre: 'Fragen zu diesen Bedingungen können gesendet werden an',
  },
  es: {
    legalBadge: 'Legal',
    pageTitle: 'Términos de Servicio',
    effectiveDateLabel: 'Fecha de entrada en vigor: {date}',

    sectionTitle1: '1. Aceptación de los Términos',
    s1Pre:
      'Estos Términos de Servicio (los “Términos”) constituyen un acuerdo vinculante entre usted y ZeroGEX (“ZeroGEX”, “nosotros”). Al crear una cuenta o utilizar el sitio web zerogex.io y cualquier producto o servicio relacionado (colectivamente, los “Servicios”), usted acepta estos Términos y nuestra',
    s1PrivacyLink: 'Política de Privacidad',
    s1Post: '. Si no está de acuerdo, no utilice los Servicios.',

    sectionTitle2: '2. Requisitos de Elegibilidad',
    s2Body:
      'Debe tener al menos 18 años y ser capaz de celebrar un contrato vinculante conforme a la ley aplicable para utilizar los Servicios. Al utilizar los Servicios, usted declara que cumple con estos requisitos.',

    sectionTitle3: '3. Cuentas',
    s3Pre:
      'Usted es responsable de la exactitud de su información de registro, de proteger sus credenciales y de toda la actividad que ocurra bajo su cuenta. Notifíquenos de inmediato a',
    s3Post: 'si sospecha de un uso no autorizado.',

    sectionTitle4: '4. Suscripciones, Facturación y Cancelación',
    s4Intro:
      'Las suscripciones de pago se facturan por adelantado de forma recurrente a través de Stripe, a las tarifas e intervalos mostrados al suscribirse. Al suscribirse, usted nos autoriza a nosotros y a Stripe a cobrar a su método de pago las tarifas correspondientes.',
    s4PlanChangesLabel: 'Cambios de plan.',
    s4PlanChangesBody:
      'Las mejoras entran en vigor de inmediato y se prorratean por el resto del período de facturación actual. Las degradaciones entran en vigor al final del período de facturación actual, salvo que se indique lo contrario.',
    s4CancellationLabel: 'Cancelación.',
    s4CancellationBody:
      'Puede cancelar en cualquier momento a través del portal de facturación alojado por Stripe. La cancelación entra en vigor al final del período de facturación pagado actual; conservará el acceso a las funciones de pago hasta que finalice ese período.',
    s4RefundsLabel: 'Reembolsos.',
    s4RefundsBody: 'Salvo que la ley lo exija, las tarifas no son reembolsables.',
    s4TaxesLabel: 'Impuestos.',
    s4TaxesBody: 'Los precios indicados no incluyen impuestos; usted es responsable de los impuestos aplicables.',
    s4FailedPaymentsLabel: 'Pagos fallidos.',
    s4FailedPaymentsBody:
      'Si un cargo falla, podemos suspender o dar de baja el acceso a las funciones de pago hasta que se resuelva el saldo.',

    sectionTitle5: '5. No Constituye Asesoramiento de Inversión',
    s5Body:
      'Los Servicios ofrecen análisis, señales y contenido educativo del mercado de opciones únicamente con fines informativos. Nada en los Servicios constituye asesoramiento de inversión, una recomendación para comprar o vender valores o derivados, ni una solicitud para realizar transacción alguna. ZeroGEX no es un asesor de inversiones registrado, un broker-dealer ni un planificador financiero. Operar con opciones y derivados implica un riesgo sustancial de pérdida y no es adecuado para todos los inversores. El rendimiento pasado no garantiza resultados futuros. Usted es el único responsable de sus decisiones de trading e inversión y debe consultar a un profesional calificado antes de tomarlas.',

    sectionTitle6: '6. Uso Aceptable',
    s6Intro: 'Usted se compromete a no:',
    s6Item1: 'Realizar ingeniería inversa, descompilar o intentar extraer el código fuente de los Servicios.',
    s6Item2:
      'Utilizar los Servicios para crear un producto competidor, extraer datos a gran escala o redistribuir contenido sin nuestro permiso por escrito.',
    s6Item3: 'Compartir o revender credenciales de cuenta o acceso de pago.',
    s6Item4: 'Utilizar los Servicios para violar cualquier ley o derecho de terceros.',
    s6Item5: 'Interferir o interrumpir los Servicios o cualquier servidor o red conectados a ellos.',
    s6Item6: 'Sondear, escanear o probar la vulnerabilidad de los Servicios sin autorización.',

    sectionTitle7: '7. Propiedad Intelectual',
    s7Body:
      'Nosotros y nuestros licenciantes conservamos todos los derechos, títulos e intereses sobre los Servicios, incluyendo todo el software, contenido y marcas. Sujeto a su cumplimiento de estos Términos, le otorgamos una licencia limitada, no exclusiva, intransferible y revocable para acceder y utilizar los Servicios para su uso personal o comercial interno.',

    sectionTitle8: '8. Servicios de Terceros',
    s8Body:
      'Los Servicios se integran con proveedores externos, incluyendo Stripe para el procesamiento de pagos y Google o Apple para la autenticación. Su uso de esos servicios se rige por los términos y la política de privacidad del proveedor correspondiente. No somos responsables de la disponibilidad o el comportamiento de ningún servicio de terceros.',

    sectionTitle9: '9. Renuncias de Garantía',
    s9Body:
      'LOS SERVICIOS SE PROPORCIONAN “TAL CUAL” Y “SEGÚN DISPONIBILIDAD”, SIN GARANTÍAS DE NINGÚN TIPO, YA SEAN EXPRESAS, IMPLÍCITAS O LEGALES, INCLUYENDO GARANTÍAS DE COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO PARTICULAR, NO INFRACCIÓN Y EXACTITUD. NO GARANTIZAMOS QUE LOS SERVICIOS SERÁN ININTERRUMPIDOS, LIBRES DE ERRORES O SEGUROS, NI QUE LOS DATOS O SEÑALES SEAN PRECISOS O RENTABLES.',

    sectionTitle10: '10. Limitación de Responsabilidad',
    s10Body:
      'EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, ZEROGEX Y SUS AFILIADOS, DIRECTIVOS, EMPLEADOS Y AGENTES NO SERÁN RESPONSABLES DE DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENTES O PUNITIVOS, INCLUYENDO PÉRDIDA DE GANANCIAS, INGRESOS O DATOS, DERIVADOS DE O RELACIONADOS CON SU USO DE LOS SERVICIOS, INCLUSO SI SE LES ADVIRTIÓ DE LA POSIBILIDAD DE TALES DAÑOS. NUESTRA RESPONSABILIDAD TOTAL POR CUALQUIER RECLAMO DERIVADO DE ESTOS TÉRMINOS O DE LOS SERVICIOS NO EXCEDERÁ LOS MONTOS QUE USTED NOS HAYA PAGADO POR LOS SERVICIOS EN LOS DOCE (12) MESES ANTERIORES AL EVENTO QUE DIO ORIGEN AL RECLAMO.',

    sectionTitle11: '11. Indemnización',
    s11Body:
      'Usted se compromete a defender, indemnizar y eximir de responsabilidad a ZeroGEX y sus afiliados de cualquier reclamo, responsabilidad, daño, pérdida y gasto (incluidos honorarios razonables de abogados) derivados de su uso de los Servicios, su incumplimiento de estos Términos o su violación de cualquier derecho de terceros.',

    sectionTitle12: '12. Terminación',
    s12Body:
      'Podemos suspender o dar por terminado su acceso a los Servicios en cualquier momento, con o sin previo aviso, por conductas que razonablemente creamos que violan estos Términos o perjudican a otros usuarios, a nosotros o a terceros. Usted puede dejar de utilizar los Servicios en cualquier momento y cancelar cualquier suscripción activa como se describe en la Sección 4.',

    sectionTitle13: '13. Ley Aplicable',
    s13Body:
      'Estos Términos se rigen por las leyes de los Estados Unidos y del Estado de Delaware, sin considerar sus normas de conflicto de leyes. Sujeto al acuerdo de arbitraje de la Sección 14, el foro exclusivo para cualquier disputa no sujeta a arbitraje serán los tribunales estatales o federales ubicados en Delaware, y usted consiente la jurisdicción personal de dichos tribunales.',

    sectionTitle14: '14. Resolución de Disputas; Arbitraje Vinculante',
    s14Intro:
      'Lea atentamente esta sección. Afecta sus derechos legales, incluido su derecho a presentar una demanda ante un tribunal y a que las disputas se resuelvan mediante un jurado o en una acción colectiva.',
    s14InformalLabel: 'Resolución informal.',
    s14InformalPre:
      'Antes de iniciar cualquier arbitraje, usted y ZeroGEX acuerdan intentar primero resolver la disputa de manera informal enviando una notificación escrita que describa la disputa y la reparación solicitada a',
    s14InformalPost:
      '. Si la disputa no se resuelve dentro de sesenta (60) días desde la notificación, cualquiera de las partes podrá proceder al arbitraje.',
    s14AgreementLabel: 'Acuerdo de arbitraje.',
    s14AgreementBody:
      'Usted y ZeroGEX acuerdan que cualquier disputa, reclamo o controversia que surja de o esté relacionada con estos Términos o los Servicios, ya sea basada en contrato, agravio, estatuto, fraude o cualquier otra teoría legal, se resolverá exclusivamente mediante arbitraje individual final y vinculante, en lugar de en un tribunal, salvo lo indicado a continuación. La Ley Federal de Arbitraje rige la interpretación y aplicación de esta Sección.',
    s14RulesLabel: 'Reglas y sede del arbitraje.',
    s14RulesBody:
      'El arbitraje será administrado por la American Arbitration Association (“AAA”) conforme a sus Reglas de Arbitraje de Consumo entonces vigentes, según modificadas por estos Términos. El arbitraje será conducido por un árbitro único. El árbitro puede realizar los procedimientos por teléfono, video o por escrito, y cualquier audiencia presencial se llevará a cabo en el condado de su residencia u otro lugar mutuamente acordado. El árbitro tiene autoridad exclusiva para resolver cualquier disputa relacionada con la interpretación, aplicabilidad o exigibilidad de este acuerdo de arbitraje.',
    s14ClassActionLabel: 'Renuncia a acción colectiva y juicio con jurado.',
    s14ClassActionBody:
      'USTED Y ZEROGEX ACUERDAN QUE CADA UNO PODRÁ PRESENTAR RECLAMOS CONTRA EL OTRO ÚNICAMENTE A TÍTULO INDIVIDUAL, Y NO COMO DEMANDANTE O MIEMBRO DE UNA CLASE EN NINGÚN PROCEDIMIENTO COLECTIVO, CONSOLIDADO O REPRESENTATIVO. EL ÁRBITRO NO PODRÁ CONSOLIDAR LOS RECLAMOS DE MÁS DE UNA PERSONA NI PRESIDIR NINGUNA FORMA DE PROCEDIMIENTO REPRESENTATIVO O COLECTIVO. USTED Y ZEROGEX TAMBIÉN RENUNCIAN A CUALQUIER DERECHO A UN JUICIO CON JURADO. Si esta renuncia a la acción colectiva se considera inaplicable respecto de un reclamo particular, dicho reclamo se separará y podrá proceder ante un tribunal, mientras que todos los demás reclamos permanecerán en arbitraje.',
    s14ExceptionsLabel: 'Excepciones.',
    s14ExceptionsBody:
      'Cualquiera de las partes puede presentar una acción individual en un tribunal de reclamos menores para disputas dentro de la jurisdicción de dicho tribunal. Nada en esta Sección impide que cualquiera de las partes busque medidas cautelares u otra reparación equitativa en un tribunal para proteger sus derechos de propiedad intelectual.',
    s14OptOutLabel: 'Exclusión voluntaria de 30 días.',
    s14OptOutPre:
      'Puede excluirse voluntariamente de este acuerdo de arbitraje enviando una notificación escrita de su decisión a',
    s14OptOutPost:
      'dentro de los treinta (30) días posteriores a la primera aceptación de estos Términos. La notificación debe incluir su nombre, el correo electrónico asociado a su cuenta y una declaración clara de que desea excluirse del arbitraje. La exclusión no afectará ninguna otra disposición de estos Términos.',

    sectionTitle15: '15. Cambios a Estos Términos',
    s15Body:
      'Podemos modificar estos Términos de vez en cuando. Si realizamos cambios importantes, revisaremos la fecha de entrada en vigor indicada arriba y, cuando sea apropiado, proporcionaremos un aviso adicional a través de los Servicios. El uso continuado de los Servicios después de la fecha de entrada en vigor constituye la aceptación de los Términos revisados.',

    sectionTitle16: '16. Contacto',
    s16Pre: 'Las preguntas sobre estos Términos pueden enviarse a',
  },
  fr: {
    legalBadge: 'Mentions Légales',
    pageTitle: 'Conditions d’Utilisation',
    effectiveDateLabel: 'Date d’entrée en vigueur : {date}',

    sectionTitle1: '1. Acceptation des Conditions',
    s1Pre:
      'Les présentes Conditions d’Utilisation (les «Conditions») constituent un accord contraignant entre vous et ZeroGEX («ZeroGEX», «nous»). En créant un compte ou en utilisant le site zerogex.io et tout produit ou service connexe (collectivement, les «Services»), vous acceptez les présentes Conditions ainsi que notre',
    s1PrivacyLink: 'Politique de Confidentialité',
    s1Post: '. Si vous n’acceptez pas ces Conditions, n’utilisez pas les Services.',

    sectionTitle2: '2. Admissibilité',
    s2Body:
      'Vous devez avoir au moins 18 ans et être en mesure de conclure un contrat contraignant en vertu de la loi applicable pour utiliser les Services. En utilisant les Services, vous déclarez satisfaire à ces exigences.',

    sectionTitle3: '3. Comptes',
    s3Pre:
      'Vous êtes responsable de l’exactitude des informations de votre inscription, de la protection de vos identifiants et de toute activité réalisée sous votre compte. Contactez-nous immédiatement à',
    s3Post: 'si vous soupçonnez une utilisation non autorisée.',

    sectionTitle4: '4. Abonnements, Facturation et Résiliation',
    s4Intro:
      'Les abonnements payants sont facturés à l’avance de manière récurrente via Stripe, aux tarifs et intervalles indiqués lors de l’abonnement. En vous abonnant, vous nous autorisez, ainsi que Stripe, à prélever les frais applicables sur votre moyen de paiement.',
    s4PlanChangesLabel: 'Changements de forfait.',
    s4PlanChangesBody:
      'Les mises à niveau prennent effet immédiatement et sont calculées au prorata pour le reste de la période de facturation en cours. Les rétrogradations prennent effet à la fin de la période de facturation en cours, sauf indication contraire.',
    s4CancellationLabel: 'Résiliation.',
    s4CancellationBody:
      'Vous pouvez résilier à tout moment via le portail de facturation hébergé par Stripe. La résiliation prend effet à la fin de la période de facturation payante en cours ; vous conservez l’accès aux fonctionnalités payantes jusqu’à la fin de cette période.',
    s4RefundsLabel: 'Remboursements.',
    s4RefundsBody: 'Sauf disposition contraire de la loi, les frais ne sont pas remboursables.',
    s4TaxesLabel: 'Taxes.',
    s4TaxesBody: 'Les prix indiqués n’incluent pas les taxes ; vous êtes responsable de toute taxe applicable.',
    s4FailedPaymentsLabel: 'Échecs de paiement.',
    s4FailedPaymentsBody:
      'En cas d’échec d’un prélèvement, nous pouvons suspendre ou résilier l’accès aux fonctionnalités payantes jusqu’à régularisation du solde.',

    sectionTitle5: '5. Ne Constitue Pas un Conseil en Investissement',
    s5Body:
      'Les Services fournissent des analyses, des signaux et du contenu éducatif relatifs au marché des options à des fins purement informatives. Rien dans les Services ne constitue un conseil en investissement, une recommandation d’acheter ou de vendre un titre ou un produit dérivé, ou une sollicitation à conclure une transaction. ZeroGEX n’est pas un conseiller en investissement enregistré, un courtier-négociant ou un planificateur financier. Le trading d’options et de produits dérivés comporte un risque important de perte et ne convient pas à tous les investisseurs. Les performances passées ne garantissent pas les résultats futurs. Vous êtes seul responsable de vos décisions de trading et d’investissement et devriez consulter un professionnel qualifié avant d’en prendre.',

    sectionTitle6: '6. Utilisation Acceptable',
    s6Intro: 'Vous acceptez de ne pas :',
    s6Item1: 'Décompiler, rétro-concevoir ou tenter d’extraire le code source des Services.',
    s6Item2:
      'Utiliser les Services pour créer un produit concurrent, extraire des données à grande échelle ou redistribuer du contenu sans notre autorisation écrite.',
    s6Item3: 'Partager ou revendre des identifiants de compte ou un accès payant.',
    s6Item4: 'Utiliser les Services pour violer une loi ou les droits d’un tiers.',
    s6Item5: 'Interférer avec ou perturber les Services ou tout serveur ou réseau qui y est connecté.',
    s6Item6: 'Sonder, scanner ou tester la vulnérabilité des Services sans autorisation.',

    sectionTitle7: '7. Propriété Intellectuelle',
    s7Body:
      'Nous et nos concessionnaires de licence conservons tous les droits, titres et intérêts relatifs aux Services, y compris l’ensemble des logiciels, contenus et marques. Sous réserve de votre respect des présentes Conditions, nous vous accordons une licence limitée, non exclusive, incessible et révocable pour accéder aux Services et les utiliser à des fins personnelles ou professionnelles internes.',

    sectionTitle8: '8. Services Tiers',
    s8Body:
      'Les Services s’intègrent à des fournisseurs tiers, notamment Stripe pour le traitement des paiements et Google ou Apple pour l’authentification. Votre utilisation de ces services est régie par les conditions et la politique de confidentialité du fournisseur concerné. Nous ne sommes pas responsables de la disponibilité ou du comportement de tout service tiers.',

    sectionTitle9: '9. Exclusions de Garantie',
    s9Body:
      'LES SERVICES SONT FOURNIS «EN L’ÉTAT» ET «SELON DISPONIBILITÉ», SANS GARANTIE D’AUCUNE SORTE, EXPRESSE, IMPLICITE OU LÉGALE, Y COMPRIS LES GARANTIES DE QUALITÉ MARCHANDE, D’ADÉQUATION À UN USAGE PARTICULIER, DE NON-CONTREFAÇON ET D’EXACTITUDE. NOUS NE GARANTISSONS PAS QUE LES SERVICES SERONT ININTERROMPUS, EXEMPTS D’ERREURS OU SÉCURISÉS, NI QUE LES DONNÉES OU SIGNAUX SERONT EXACTS OU RENTABLES.',

    sectionTitle10: '10. Limitation de Responsabilité',
    s10Body:
      'DANS TOUTE LA MESURE PERMISE PAR LA LOI, ZEROGEX ET SES AFFILIÉS, DIRIGEANTS, EMPLOYÉS ET AGENTS NE SERONT PAS RESPONSABLES DES DOMMAGES INDIRECTS, ACCESSOIRES, SPÉCIAUX, CONSÉCUTIFS OU PUNITIFS, Y COMPRIS LA PERTE DE PROFITS, DE REVENUS OU DE DONNÉES, DÉCOULANT DE OU LIÉS À VOTRE UTILISATION DES SERVICES, MÊME S’ILS ONT ÉTÉ AVERTIS DE LA POSSIBILITÉ DE TELS DOMMAGES. NOTRE RESPONSABILITÉ TOTALE POUR TOUTE RÉCLAMATION DÉCOULANT DES PRÉSENTES CONDITIONS OU DES SERVICES NE DÉPASSERA PAS LES MONTANTS QUE VOUS NOUS AVEZ VERSÉS POUR LES SERVICES AU COURS DES DOUZE (12) MOIS PRÉCÉDANT L’ÉVÉNEMENT À L’ORIGINE DE LA RÉCLAMATION.',

    sectionTitle11: '11. Indemnisation',
    s11Body:
      'Vous acceptez de défendre, d’indemniser et de tenir indéparaé ZeroGEX et ses affiliés de toute réclamation, responsabilité, dommage, perte et dépense (y compris les honoraires d’avocat raisonnables) découlant de votre utilisation des Services, de votre violation des présentes Conditions ou de votre violation des droits d’un tiers.',

    sectionTitle12: '12. Résiliation',
    s12Body:
      'Nous pouvons suspendre ou résilier votre accès aux Services à tout moment, avec ou sans préavis, pour toute conduite que nous estimons raisonnablement contraire aux présentes Conditions ou préjudiciable à d’autres utilisateurs, à nous-mêmes ou à des tiers. Vous pouvez cesser d’utiliser les Services à tout moment et résilier tout abonnement actif comme décrit à la Section 4.',

    sectionTitle13: '13. Droit Applicable',
    s13Body:
      'Les présentes Conditions sont régies par les lois des États-Unis et de l’État du Delaware, sans égard aux principes de conflit de lois. Sous réserve de la convention d’arbitrage prévue à la Section 14, le for exclusif pour tout litige non soumis à arbitrage sera les tribunaux d’État ou fédéraux situés dans le Delaware, et vous consentez à la compétence personnelle de ces tribunaux.',

    sectionTitle14: '14. Règlement des Litiges ; Arbitrage Contraignant',
    s14Intro:
      'Veuillez lire attentivement cette section. Elle affecte vos droits légaux, y compris votre droit d’intenter une action en justice devant un tribunal et de faire trancher les litiges par un jury ou dans le cadre d’une action collective.',
    s14InformalLabel: 'Règlement à l’amiable.',
    s14InformalPre:
      'Avant d’engager tout arbitrage, vous et ZeroGEX convenez de tenter d’abord de résoudre le litige à l’amiable en envoyant un avis écrit décrivant le litige et la réparation demandée à',
    s14InformalPost:
      '. Si le litige n’est pas résolu dans les soixante (60) jours suivant l’avis, l’une ou l’autre partie peut engager une procédure d’arbitrage.',
    s14AgreementLabel: 'Convention d’arbitrage.',
    s14AgreementBody:
      'Vous et ZeroGEX convenez que tout litige, réclamation ou controverse découlant des présentes Conditions ou des Services, ou s’y rapportant, qu’il soit fondé sur un contrat, un délit, une loi, une fraude ou toute autre théorie juridique, sera résolu exclusivement par arbitrage individuel final et contraignant, plutôt que devant un tribunal, sauf indication contraire ci-dessous. Le Federal Arbitration Act régit l’interprétation et l’application de la présente Section.',
    s14RulesLabel: 'Règles et lieu de l’arbitrage.',
    s14RulesBody:
      'L’arbitrage sera administré par l’American Arbitration Association («AAA») conformément à ses règles d’arbitrage pour consommateurs alors en vigueur, telles que modifiées par les présentes Conditions. L’arbitrage sera mené par un arbitre unique. L’arbitre peut mener les procédures par téléphone, par vidéo ou par écrit, et toute audience en personne se tiendra dans le comté de votre résidence ou en un autre lieu convenu mutuellement. L’arbitre dispose d’une autorité exclusive pour trancher tout litige relatif à l’interprétation, l’applicabilité ou le caractère exécutoire de la présente convention d’arbitrage.',
    s14ClassActionLabel: 'Renonciation à l’action collective et au procès devant jury.',
    s14ClassActionBody:
      'VOUS ET ZEROGEX CONVENEZ QUE CHACUN NE PEUT INTENTER DES RÉCLAMATIONS CONTRE L’AUTRE QU’À TITRE INDIVIDUEL, ET NON EN TANT QUE DEMANDEUR OU MEMBRE D’UN GROUPE DANS TOUTE PROCÉDURE COLLECTIVE, GROUPÉE, CONSOLIDÉE OU REPRÉSENTATIVE. L’ARBITRE NE PEUT PAS CONSOLIDER LES RÉCLAMATIONS DE PLUS D’UNE PERSONNE NI PRÉSIDER UNE FORME QUELCONQUE DE PROCÉDURE REPRÉSENTATIVE OU COLLECTIVE. VOUS ET ZEROGEX RENONCEZ ÉGALEMENT À TOUT DROIT À UN PROCÈS DEVANT JURY. Si cette renonciation à l’action collective est jugée inapplicable à une réclamation particulière, cette réclamation sera disjointe et pourra être poursuivie devant un tribunal, tandis que toutes les autres réclamations resteront soumises à l’arbitrage.',
    s14ExceptionsLabel: 'Exceptions.',
    s14ExceptionsBody:
      'Chaque partie peut intenter une action individuelle devant un tribunal des petites créances pour les litiges relevant de la compétence de ce tribunal. Rien dans la présente Section n’empêche l’une ou l’autre partie de demander une injonction ou une autre réparation équitable devant un tribunal afin de protéger ses droits de propriété intellectuelle.',
    s14OptOutLabel: 'Retrait sous 30 jours.',
    s14OptOutPre:
      'Vous pouvez vous retirer de cette convention d’arbitrage en envoyant un avis écrit de votre décision à',
    s14OptOutPost:
      'dans les trente (30) jours suivant votre première acceptation des présentes Conditions. L’avis doit inclure votre nom, l’adresse e-mail associée à votre compte et une déclaration claire indiquant que vous souhaitez vous retirer de l’arbitrage. Ce retrait n’affectera aucune autre disposition des présentes Conditions.',

    sectionTitle15: '15. Modifications des Présentes Conditions',
    s15Body:
      'Nous pouvons modifier les présentes Conditions de temps à autre. Si nous apportons des modifications substantielles, nous réviserons la date d’entrée en vigueur indiquée ci-dessus et, le cas échéant, fournirons un avis supplémentaire via les Services. La poursuite de l’utilisation des Services après la date d’entrée en vigueur vaut acceptation des Conditions révisées.',

    sectionTitle16: '16. Contact',
    s16Pre: 'Les questions relatives aux présentes Conditions peuvent être envoyées à',
  },
};
