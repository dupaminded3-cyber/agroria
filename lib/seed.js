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
const data = db.read();

if (!data.users || data.users.length === 0) {
  const wachtwoord = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  data.users = [{
    id: db.id(), username: 'root', email: 'info@agroria.nl', name: 'Beheerder',
    passwordHash: bcrypt.hashSync(wachtwoord, 10), createdAt: new Date().toISOString()
  }];
  console.log('\n────────────────────────────────────────────────');
  console.log('• Beheerder aangemaakt (gebruikersnaam: root)');
  if (process.env.ADMIN_PASSWORD) {
    console.log('  Wachtwoord: het door jou ingestelde ADMIN_PASSWORD.');
  } else {
    console.log('  Tijdelijk wachtwoord: ' + wachtwoord);
    console.log('  Schrijf dit op en wijzig het meteen via /uadmin → Account.');
  }
  console.log('────────────────────────────────────────────────\n');
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

data.pages = Object.assign({
  home: {
    heroTitel: 'Uw partner in landbouwsucces',
    heroTekst: 'Welkom bij Agroria Landbouwvoertuigen, dé specialist in betrouwbare, zorgvuldig geselecteerde trekkers en landbouwvoertuigen. Wij begrijpen dat kwaliteit en vertrouwen essentieel zijn voor uw bedrijf. Daarom bieden wij transparantie, controle en een ongeëvenaarde service.',
    heroFoto: '', introFoto: '', garantieFoto: '', nieuwFoto: '', closerFoto: ''
  },
  inruil: {
    titel: 'Garantie & inruil',
    tekst: 'Wij bieden standaard 12 maanden volledige garantie op al onze trekkers. Geen halve dekking, maar échte zekerheid. Daarnaast profiteert u van een gunstig inruilvoordeel: wilt u overstappen naar een andere trekker, dan zorgen wij voor een eerlijke en realistische inruilprijs.',
    foto: ''
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
}, data.pages || {});

if (!data.inquiries) data.inquiries = [];
if (!data.settings) data.settings = {};
if (!data.settings.merken) data.settings.merken = 'Fendt, John Deere, Case IH, New Holland, Claas, Deutz-Fahr, Massey Ferguson, Valtra';

db.write(data);
console.log('\nKlaar. De database staat in data/db.json');
