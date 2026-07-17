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

- Gebruikersnaam: **root**
- Wachtwoord: **agroria**

**Belangrijk:** wijzig dit wachtwoord meteen na de eerste keer inloggen, onder
"Account" in het beheerpaneel. Zolang het op `agroria` staat, kan iedereen die
het weet inloggen.

### Wachtwoord kwijt? Zo zet je het terug

Kun je niet meer inloggen? Open het opdrachtvenster in de projectmap en typ:

```
npm run wachtwoord
```

Daarna staat het wachtwoord weer op **agroria** (gebruikersnaam `root`).
Start de site vervolgens gewoon weer met `npm start` en log in.

Wil je meteen je eigen wachtwoord kiezen? Typ het erachter, bijvoorbeeld:

```
npm run wachtwoord -- MijnWachtwoord
```

Dan is je wachtwoord `MijnWachtwoord`.

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
- **Facturen**: maak professionele facturen in de Agroria-huisstijl, met je
  logo en de garantievoorwaarden er automatisch netjes op (12 maanden
  volledige garantie + 6 maanden geld-terug bij motorisch defect).
  - Start een factuur direct vanuit een trekker (knop **"Factuur"** in de
    trekkerlijst) — de machinegegevens en prijs worden dan alvast ingevuld.
  - Kies **margeregeling** (één totaalprijs) of **BTW-regeling** (21% BTW
    wordt apart uitgerekend en vermeld), en vul eventueel een **aanbetaling**
    in voor een betaalschema.
  - Klik op **"PDF / print"** en kies "Opslaan als PDF" — klaar om te mailen.

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
Voor het online gaat, zet deze omgevingsvariabelen (environment variables):
- `NODE_ENV=production` — schakelt veilige cookies in;
- `SESSION_SECRET` — een lange, willekeurige, geheime tekst (wordt anders
  automatisch aangemaakt en bewaard in `data/db.json`);
- `ADMIN_PASSWORD` — het beheerderswachtwoord bij de allereerste start;
- `SITE_URL` — het volledige webadres van je site, bijvoorbeeld
  `https://www.agroria.nl` (gebruikt voor SEO, de sitemap en social previews).

Verder:
- verander het wachtwoord van "root" na de eerste keer inloggen;
- vul je echte contactgegevens in onder "Pagina's & foto's";
- bewaar af en toe een kopie van de map `data` (daar staat alles in:
  je trekkers, foto's en aanvragen).

## Je gegevens bewaren op Render (belangrijk!)

Op het **gratis** Render-plan is de opslag tijdelijk: bij elke herstart of
nieuwe versie verdwijnen je geüploade foto's en toegevoegde trekkers. Om alles
blijvend te bewaren heb je een **persistente schijf** nodig — die is bij Render
alleen beschikbaar op een **betaald plan**.

Zo zet je het aan in het Render-dashboard (op je bestaande service):

1. Ga naar je service op https://dashboard.render.com → open **agroria**.
2. Kies bij **Settings → Instance Type** een **betaald plan** (bijv. Starter).
3. Ga naar **Settings → Disks → Add Disk** en vul in:
   - Name: `agroria-data`
   - Mount Path: `/var/data`
   - Size: `1 GB`
4. Ga naar **Environment** en voeg deze variabele toe:
   - `DATA_DIR` = `/var/data`
   - (en, indien nog niet aanwezig: `NODE_ENV` = `production`,
     `SITE_URL` = `https://agroria.onrender.com`)
5. Klik **Save** — Render herstart de site. Vanaf nu blijven je foto's en
   trekkers bewaard, ook na updates.

> In het bestand `render.yaml` staat deze opzet ook kant-en-klaar beschreven,
> voor als je Render via een "Blueprint" wilt instellen.
