# Roelfsema Totaalonderhoud — website

Een high-end website met offerteaanvraag (incl. foto-upload) en een eigen
beheerpaneel. Je hoeft niets van techniek te weten.

## Dit is een eerste opzet — kies eerst een ontwerprichting

Er zijn nog geen eigen foto's en teksten van Roelfsema Totaalonderhoud
gebruikt. In plaats daarvan is de site opgezet met **drie mogelijke
ontwerprichtingen**, zodat we eerst kunnen afstemmen welke uitstraling het
beste past, voordat alles verder wordt ingevuld en afgewerkt.

Start de site (zie hieronder) en ga naar **`/ontwerpen`** om de drie
richtingen te bekijken en erdoorheen te klikken:

1. **Antraciet & Koper** — donker en statig, met koperkleurige accenten.
2. **Warm Natuurlijk** — zandtinten met dieprood/groen, warm en persoonlijk.
3. **Modern Minimal** — strak wit met marineblauw, dicht bij emmow.nl maar verfijnder.

Laat weten welke richting je aanspreekt (of welke onderdelen je wilt
combineren), dan werken we die verder uit met jouw eigen teksten, logo en
foto's.

Het **offerteformulier (met foto-upload tot 50 foto's)** en het
**beheerpaneel** werken in alle drie de richtingen al volledig.

## Starten (op je eigen computer)

1. Open de projectmap `roelfsema-totaalonderhoud` in de Verkenner.
   Tip: typ `cmd` in de adresbalk van de map en druk op Enter — je krijgt
   dan meteen een opdrachtvenster op de juiste plek.
2. Eerste keer: typ `npm install` en druk op Enter (even wachten).
3. Daarna, en elke volgende keer: typ `npm start` en druk op Enter.
4. Open je browser:
   - Website:       http://localhost:3000
   - Ontwerpen:     http://localhost:3000/ontwerpen
   - Beheerpaneel:  http://localhost:3000/uadmin

Het opdrachtvenster moet open blijven zolang je de site gebruikt — dat venster
is de server. Stoppen doe je met Ctrl + C in dat venster.

## Inloggen op het beheer (/uadmin)

- Gebruikersnaam: **root**
- Wachtwoord: **roelfsema**

**Belangrijk:** wijzig dit wachtwoord meteen na de eerste keer inloggen, onder
"Account" in het beheerpaneel.

### Wachtwoord kwijt? Zo zet je het terug

Open het opdrachtvenster in de projectmap en typ:

```
npm run wachtwoord
```

Daarna staat het wachtwoord weer op **roelfsema** (gebruikersnaam `root`).

Wil je meteen je eigen wachtwoord kiezen? Typ het erachter, bijvoorbeeld:

```
npm run wachtwoord -- MijnWachtwoord
```

## Wat kun je in het beheer?

- **Overzicht**: aantal nieuwe en lopende aanvragen in één oogopslag.
- **Aanvragen**: alle offerteaanvragen (met foto's) én contactberichten komen
  hier binnen. Je kunt de status wijzigen (nieuw / in behandeling /
  afgehandeld), een interne notitie toevoegen, foto's bekijken op groot
  formaat, en aanvragen verwijderen.
- **Pagina's & foto's**: pas de hero-tekst, "over ons"-tekst en
  contactgegevens aan, en upload hier je **logo** en een **hero-afbeelding**
  zodra je die hebt.
- **Account**: wachtwoord wijzigen.

## Offerteaanvraag met foto's

Bezoekers kunnen op `/offerte-aanvragen` een offerte aanvragen en daarbij tot
**50 foto's** van de klus toevoegen (slepen of klikken om te kiezen, met
live-voorbeeld en teller). De foto's worden automatisch verkleind en er wordt
een miniatuur gemaakt, zodat het beheerpaneel snel blijft laden. Aanvragen
komen — inclusief foto's — direct binnen in `/uadmin`, er is geen aparte
e-mailinbox nodig.

## Online zetten (later)

De site draait op Node.js, net als de andere Roelfsema-achtige projecten.
Geschikte hosts zijn bijvoorbeeld Render of Railway. Voor het online gaat,
zet deze omgevingsvariabelen (environment variables):
- `NODE_ENV=production` — schakelt veilige cookies in;
- `ADMIN_PASSWORD` — het beheerderswachtwoord bij de allereerste start;
- `DATA_DIR` — map voor een persistente schijf (zie hieronder), bijvoorbeeld `/var/data`.

### Foto's en aanvragen blijvend bewaren

Op de meeste **gratis** hostingplannen is de opslag tijdelijk: bij elke
herstart of nieuwe versie verdwijnen geüploade foto's en aanvragen. Zet een
**persistente schijf** aan (bij Render bijvoorbeeld onder Settings → Disks)
en wijs deze aan met de omgevingsvariabele `DATA_DIR`, zodat alles bewaard
blijft.

Verder:
- verander het wachtwoord van "root" na de eerste keer inloggen;
- vul je echte contactgegevens in onder "Pagina's & foto's";
- bewaar af en toe een kopie van de map `data` (daar staat alles in: je
  aanvragen, foto's en instellingen).
