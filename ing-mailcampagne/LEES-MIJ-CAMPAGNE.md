# ING Beleggen — e-mailcampagne

E-mailcampagne voor beleggers in ING-huisstijl, geïnspireerd op de opbouw van het
aangeleverde voorbeeld (hero met prikkelende vraag → spaargeld-vs-beleggen →
drie manieren om te starten → waarom ING → testimonial → call-to-action).

**Bestand:** `ing-beleggen-campagne.html` — open het in je browser om het te bekijken.

## Onderwerpregels (suggesties voor een A/B-test)

| Variant | Onderwerpregel | Insteek |
|---|---|---|
| A | Uw geld kan meer dan stilstaan | nieuwsgierigheid |
| B | Wat doet inflatie met uw spaargeld? | urgentie / verlies-framing |
| C | Beleggen vanaf € 10 — op uw manier | laagdrempeligheid |

**Preheader** (staat al in de HTML): *"Met de huidige inflatie wordt uw spaargeld
elk jaar minder waard. Ontdek in 3 minuten welke manier van beleggen bij u past."*

## Vóór verzending vervangen

Zoek in de HTML op `VERVANG-DOOR` — daar staan alle plekken die je moet invullen:

1. **Links**: webversie, campagne-landingspagina, keuzehulp, afspraak plannen,
   e-mailvoorkeuren en afmelden (verplicht!).
2. **Logo**: de tekst "ING" in de header vervangen door het officiële logo
   (img-tag, hoogte ± 40 px, gehost op een publieke URL).
3. **Testimonial**: vervang de fictieve quote door een echte klantquote
   (met schriftelijke toestemming) plus foto.
4. **Rekenvoorbeeld**: de bedragen (€ 11.605 / € 20.789) zijn fictief
   (15 jaar, € 10.000, 1% rente vs. 5% netto rendement). Laat de aannames
   en de disclaimer controleren door compliance.

## Compliance (belangrijk!)

Dit is marketing voor een beleggingsproduct. Vóór verzending **altijd** langs
jullie compliance-/legal-afdeling. In de mail is alvast rekening gehouden met:

- Risicowaarschuwing ("beleggen brengt risico's en kosten met zich mee, u kunt
  (een deel van) uw inleg verliezen") prominent boven de footer én bij het
  rekenvoorbeeld.
- "In het verleden behaalde resultaten bieden geen garantie voor de toekomst"
  bij het rekenvoorbeeld; het voorbeeld is expliciet gemarkeerd als fictief en
  geen prognose of persoonlijk advies.
- Afmeldlink en reden van ontvangst in de footer (AVG / Telecommunicatiewet).
- Geen absolute beloftes over rendement; beide uitkomsten (mee- en tegenvallen)
  worden genoemd.

Let op: officiële ING-campagnes lopen normaal via de interne marketing- en
compliance-processen en de officiële huisstijl-assets (ING Me-lettertype,
logo, leeuw). Dit bestand is een opzet/concept om dat proces te starten.

## Technisch

- Volledig table-based HTML met inline styles → werkt in Outlook (incl. MSO-
  fallbacks), Gmail, Apple Mail en op mobiel (responsive vanaf 640 px breed).
- Lettertypes: Georgia (koppen) en Arial (tekst) als veilige e-mailfallbacks
  voor de ING-huisstijl. Webfonts worden door veel e-mailclients genegeerd.
- Geen externe afbeeldingen nodig; alles rendert ook met afbeeldingen uit.
- Test vóór verzending met bijvoorbeeld Litmus of Email on Acid.
