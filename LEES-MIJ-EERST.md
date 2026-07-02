# Agroria Landbouwvoertuigen — website

Een complete website met een eigen beheerpaneel. Je hoeft niets van techniek te weten.

## Starten (op je eigen computer)

1. Open de projectmap (de map met dit bestand erin) in de Verkenner.
   Tip: typ `cmd` in de adresbalk van de map en druk op Enter — je krijgt
   dan meteen een opdrachtvenster op de juiste plek.
2. Eerste keer: typ `npm install` en druk op Enter (even wachten).
3. Daarna, en elke volgende keer: typ `npm start` en druk op Enter.
4. Open je browser:
   - Website:       http://localhost:3000
   - Beheerpaneel:  http://localhost:3000/uadmin

Het opdrachtvenster moet open blijven zolang je de site gebruikt — dat venster
is de server. Stoppen doe je met Ctrl + C in dat venster.

## Inloggen op het beheer (/uadmin)

- Gebruikersnaam: root
- Wachtwoord:     Ajaxfreak11!

Verander dit wachtwoord zodra de site online staat (kan onder "Account").

## Wat kun je in het beheer?

- **Trekkers**: toevoegen, wijzigen, verwijderen, met meerdere foto's.
  - Vul je een **oude prijs** in (hoger dan de prijs), dan toont de trekker
    automatisch een **"Sale!"-label** met de doorgestreepte oude prijs.
  - Zet **"uitgelicht"** aan om een trekker op de homepage te tonen
    (maximaal 4 onder "Onze topmodellen").
  - Status **"verkocht"** toont een **"Uitverkocht"-label**.
- **Pagina's & foto's**: pas de teksten en foto's per pagina aan,
  en upload hier ook je **logo** en de **grote hero-foto** van de homepage.
- **Aanvragen**: alle vragen en inruil-aanvragen komen hier binnen.

## Tip voor de "wow" — zet er je eigen foto's op

De site staat klaar met nette illustraties als plaatshouder. Voor het echte
high-end gevoel: upload onder **Pagina's & foto's** een mooie grote hero-foto
(bijvoorbeeld een trekker in het veld) en voeg bij elke trekker je eigen foto's
toe. Daarmee komt de site pas echt tot leven.

## Pagina's op de site

Home · Over ons · Selectie & kwaliteit · Garantie & zekerheid · Ons aanbod ·
Veelgestelde vragen · plus losse pagina's voor inruil en contact.

## Online zetten (later)

De site draait op Node.js. Geschikte hosts zijn bijvoorbeeld Render of Railway.
Voor het online gaat:
- verander het wachtwoord van "root";
- zet in `server.js` een eigen, geheime `SESSION_SECRET`;
- bewaar af en toe een kopie van de map `data` (daar staat alles in:
  je trekkers, foto's en aanvragen).
