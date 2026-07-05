/*
 * Vult de database met de beheerder, de trekkers en de standaardteksten.
 * Veilig om opnieuw te draaien: maakt alleen aan wat nog niet bestaat.
 *
 * Inloggen op het beheerpaneel (/uadmin):
 *   - gebruikersnaam: root
 *   - wachtwoord: wordt bij de allereerste keer bepaald. Zet dit vooraf zelf
 *     via de omgevingsvariabele ADMIN_PASSWORD, anders genereert de site een
 *     willekeurig wachtwoord en toont dit ééNmalig in het opdrachtvenster.
 *     Wijzig het daarna altijd via "Account" in het beheerpaneel.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { maakSlug, uniekeSlug } = require('./slug');
const data = db.read();

// Standaard startwachtwoord. Je kunt dit vooraf overschrijven met ADMIN_PASSWORD.
// Wijzig het na de eerste keer inloggen onder "Account" in het beheerpaneel.
const STANDAARD_WACHTWOORD = 'agroria';

if (!data.users || data.users.length === 0) {
  const wachtwoord = process.env.ADMIN_PASSWORD || STANDAARD_WACHTWOORD;
  data.users = [{
    id: db.id(), username: 'root', email: 'info@agroria.nl', name: 'Beheerder',
    passwordHash: bcrypt.hashSync(wachtwoord, 10), createdAt: new Date().toISOString()
  }];
  console.log('\n────────────────────────────────────────────────');
  console.log('• Beheerder aangemaakt');
  console.log('  Gebruikersnaam: root');
  console.log('  Wachtwoord:     ' + wachtwoord);
  console.log('  → Wijzig dit meteen via /uadmin → Account.');
  console.log('────────────────────────────────────────────────\n');
} else if (process.env.ADMIN_PASSWORD) {
  // Bestaat er al een beheerder én is ADMIN_PASSWORD gezet? Dan (her)stellen we
  // het wachtwoord van "root" hierop in. Handig als je je wachtwoord kwijt bent.
  const root = data.users.find(u => u.username === 'root') || data.users[0];
  if (root) {
    root.passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    console.log('\n────────────────────────────────────────────────');
    console.log('• Wachtwoord van "root" opnieuw ingesteld op ADMIN_PASSWORD.');
    console.log('────────────────────────────────────────────────\n');
  }
}

if (!data.tractors || data.tractors.length === 0) {
  const now = new Date().toISOString();
  data.tractors = [
    { id: db.id(), merk: 'Case IH', model: 'Puma 165 CVX', bouwjaar: 2011, uren: 7003, pk: 165,
      transmissie: 'CVX traploos', prijs: 27500, oudePrijs: 35000, voorlader: false, categorie: 'Trekker',
      status: 'beschikbaar', uitgelicht: true,
      omschrijving: 'Krachtige Case IH Puma 165 CVX met traploze transmissie. Afkomstig van eerste eigenaar, historie volledig gecontroleerd. Technisch gekeurd en klaar voor het werk.',
      fotos: [], createdAt: now },
    { id: db.id(), merk: 'Fendt', model: '711 Vario', bouwjaar: 2002, uren: 7537, pk: 125,
      transmissie: 'Vario traploos', prijs: 22500, oudePrijs: 27500, voorlader: false, categorie: 'Trekker',
      status: 'beschikbaar', uitgelicht: true,
      omschrijving: 'Betrouwbare Fendt 711 Vario, bekend om zijn legendarische traploze transmissie. Goed onderhouden en in nette staat.',
      fotos: [], createdAt: now },
    { id: db.id(), merk: 'John Deere', model: '6100', bouwjaar: 1995, uren: 9234, pk: 100,
      transmissie: 'PowrQuad', prijs: 9500, oudePrijs: 12000, voorlader: false, categorie: 'Trekker',
      status: 'verkocht', uitgelicht: true,
      omschrijving: 'Robuuste John Deere 6100 — een werkpaard dat zich keer op keer bewijst. Inmiddels verkocht; vraag naar vergelijkbare modellen.',
      fotos: [], createdAt: now },
    { id: db.id(), merk: 'New Holland', model: 'T5.110 met voorlader', bouwjaar: 2018, uren: 6322, pk: 110,
      transmissie: 'Electro Command', prijs: 22500, oudePrijs: 30000, voorlader: true, categorie: 'Trekker',
      status: 'beschikbaar', uitgelicht: true,
      omschrijving: 'Complete New Holland T5.110 inclusief voorlader. Veelzijdig inzetbaar op het erf en op het land. Eerste/tweede eigenaar, historie gecontroleerd.',
      fotos: [], createdAt: now }
  ];
  console.log('• 4 trekkers toegevoegd');
}

// Geeft elke trekker die nog geen nette URL (slug) heeft er automatisch één,
// op basis van merk + model (bijv. "Case IH Puma 165 CVX" -> "case-ih-puma-165-cvx").
// Bestaande slugs blijven altijd staan, zodat gedeelde links nooit veranderen.
(function zorgVoorSlugs() {
  const bezet = data.tractors.filter(t => t.slug).map(t => t.slug);
  let aangemaakt = 0;
  data.tractors.forEach(t => {
    if (t.slug) return;
    const basis = maakSlug(`${t.merk || ''} ${t.model || ''}`.trim());
    const slug = uniekeSlug(basis, bezet);
    bezet.push(slug);
    t.slug = slug;
    aangemaakt++;
  });
  if (aangemaakt) console.log(`• ${aangemaakt} trekker(s) een nette URL (slug) gegeven`);
})();

const standaardPaginas = {
  home: {
    heroTitel: 'Uw partner in landbouwsucces',
    heroTekst: 'Welkom bij Agroria Landbouwvoertuigen, dé specialist in betrouwbare, zorgvuldig geselecteerde trekkers en landbouwvoertuigen. Wij begrijpen dat kwaliteit en vertrouwen essentieel zijn voor uw bedrijf. Daarom bieden wij transparantie, controle en een ongeëvenaarde service.',
    heroFoto: '', introFoto: '', garantieFoto: '', nieuwFoto: '', closerFoto: ''
  },
  inruil: {
    titel: 'Garantie & inruil',
    tekst: 'Wilt u overstappen naar een andere trekker? Wij denken met u mee en zorgen voor een eerlijke, realistische inruilprijs. Stuur de gegevens van uw huidige machine en ontvang binnen 24 uur een vrijblijvende taxatie.',
    foto: '',
    foto2: '',
    waaromTitel: 'Waarom bij ons inruilen',
    waaromTekst: 'Geen eindeloos onderhandelen of vage taxaties. Wij kijken écht naar uw machine — de staat, de historie en het gebruik — en komen met een eerlijk, onderbouwd bod. Binnen 24 uur weet u waar u aan toe bent, zonder verplichtingen.',
    quote: 'Binnen een dag hadden we een eerlijk bod op onze oude trekker. Geen onderhandelspelletjes, gewoon een reële prijs — en de nieuwe stond een week later op het erf.',
    quoteWie: 'Klant van Agroria'
  },
  overons: {
    titel: 'Over Agroria',
    tekst: 'Agroria Landbouwvoertuigen is dé specialist in betrouwbare trekkers en landbouwvoertuigen. Het merendeel van onze machines is afkomstig van de eerste of tweede eigenaar, met een grondig gecontroleerde historie. Geen onduidelijkheden, geen verrassingen achteraf — wij investeren in de zekerheid van uw aankoop.',
    foto: '', foto2: ''
  },
  selectie: { foto1: '', foto2: '', foto3: '' },
  aanbod: { foto1: '', foto2: '' },
  contact: {
    adres: 'Vechtensteinlaan 12, Utrecht',
    plaatsnaam: 'Hoofdvestiging',
    telefoon: '',
    email: 'info@agroria.nl',
    kvk: '90610601',
    btw: 'NL004829455B96'
  }
};

// Vult per pagina alleen de ONTBREKENDE velden aan met een standaardwaarde.
// Bestaande, al ingevulde teksten/foto's van de beheerder blijven altijd staan —
// zo krijgen nieuwe onderdelen (bijv. een nieuwe tekst- of fotoplek) automatisch
// een nette standaardwaarde, zonder ooit iets bestaands te overschrijven.
const bestaandePaginas = data.pages || {};
data.pages = {};
Object.keys(standaardPaginas).forEach(key => {
  data.pages[key] = Object.assign({}, standaardPaginas[key], bestaandePaginas[key] || {});
});
Object.keys(bestaandePaginas).forEach(key => {
  if (!(key in data.pages)) data.pages[key] = bestaandePaginas[key];
});

if (!data.inquiries) data.inquiries = [];
if (!data.settings) data.settings = {};
if (!data.settings.merken) data.settings.merken = 'Fendt, John Deere, Case IH, New Holland, Claas, Deutz-Fahr, Massey Ferguson, Valtra';

db.write(data);
console.log('\nKlaar. De database staat in data/db.json');
