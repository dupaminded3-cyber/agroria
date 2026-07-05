const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const DIENSTEN = [
  { slug: 'vastgoedonderhoud', naam: 'Vastgoedonderhoud' },
  { slug: 'mutatieonderhoud', naam: 'Mutatieonderhoud (tussen huurders)' },
  { slug: 'renovatie-verbouw', naam: 'Renovatie & verbouw' },
  { slug: 'schilderwerk', naam: 'Schilderwerk & afwerking' },
  { slug: 'dak-gevel', naam: 'Dak- en gevelonderhoud' },
  { slug: 'klein-onderhoud', naam: 'Klein onderhoud & reparaties' },
  { slug: 'anders', naam: 'Anders / weet ik nog niet' },
];

const PERIODES = [
  'Zo snel mogelijk',
  'Binnen 1 maand',
  'Binnen 3 maanden',
  'Nog geen haast, oriënterend',
];

const STIJLEN = [
  {
    id: '1',
    naam: 'Antraciet & Koper',
    omschrijving: 'Donker, statig en premium. Diepe antracietgrijze vlakken met warme koperkleurige accenten.',
  },
  {
    id: '2',
    naam: 'Warm Natuurlijk',
    omschrijving: 'Zachte zandtinten met diepgroen. Warm, benaderbaar en toch verzorgd.',
  },
  {
    id: '3',
    naam: 'Modern Minimal',
    omschrijving: "Strak wit met een diepe marineblauwe accentkleur. Dicht bij de stijl van emmow.nl, maar verfijnder.",
  },
];

function defaultData() {
  return {
    instellingen: {
      gebruikersnaam: 'root',
      wachtwoordHash: null,
      sessionSecret: crypto.randomBytes(32).toString('hex'),
      site: {
        bedrijfsnaam: 'Roelfsema Totaalonderhoud',
        stijl: '3',
        strapline: 'Vastgoedonderhoud waar u op kan bouwen',
        heroTitel: 'Vastgoedonderhoud waar u op kan bouwen',
        heroSubtitel:
          'Van dagelijks onderhoud tot complete renovatie: Roelfsema Totaalonderhoud ontzorgt vastgoedeigenaren, beheerders en particulieren met vakwerk, heldere afspraken en een vast aanspreekpunt.',
        overOns:
          'Roelfsema Totaalonderhoud is opgericht vanuit een simpel uitgangspunt: onderhoud aan uw pand moet zonder zorgen kunnen. Wij combineren de deskundigheid van een echte vakman met de betrouwbaarheid van een vast team, zodat u altijd weet waar u aan toe bent. Of het nu gaat om het onderhouden van een enkele huurwoning of het beheren van een grotere vastgoedportefeuille, wij denken mee, plannen zorgvuldig en leveren werk waar u op kunt bouwen.',
        telefoon: '',
        email: '',
        adres: '',
        kvk: '',
        btw: '',
        logo: null,
        heroAfbeelding: null,
      },
    },
    aanvragen: [],
  };
}

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readDb() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const fresh = defaultData();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    const merged = defaultData();
    merged.instellingen = { ...merged.instellingen, ...parsed.instellingen };
    merged.instellingen.site = { ...merged.instellingen.site, ...(parsed.instellingen && parsed.instellingen.site) };
    merged.aanvragen = Array.isArray(parsed.aanvragen) ? parsed.aanvragen : [];
    return merged;
  } catch (err) {
    console.error('Kon db.json niet lezen, begin opnieuw:', err.message);
    const fresh = defaultData();
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

function writeDb(db) {
  ensureDirs();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = {
  DATA_DIR,
  DB_FILE,
  UPLOADS_DIR,
  DIENSTEN,
  PERIODES,
  STIJLEN,
  defaultData,
  ensureDirs,
  readDb,
  writeDb,
};
