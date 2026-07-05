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

function standaardStats() {
  return [
    { id: 'stat1', waarde: '24u', label: 'Eerste terugkoppeling op uw aanvraag' },
    { id: 'stat2', waarde: '1', label: 'Vast aanspreekpunt gedurende het hele traject' },
    { id: 'stat3', waarde: '50+', label: "Foto's per offerteaanvraag voor maximale duidelijkheid" },
    { id: 'stat4', waarde: '100%', label: 'Focus op nette oplevering en tevredenheid' },
  ];
}

function standaardFaq() {
  return [
    {
      id: 'faq1',
      vraag: 'In welke regio zijn jullie actief?',
      antwoord:
        'Ons werkgebied vindt u onderaan de site en op de contactpagina. Twijfelt u of uw locatie binnen ons gebied valt? Neem gerust even contact op — vaak kunnen we meer dan u denkt.',
    },
    {
      id: 'faq2',
      vraag: 'Hoe snel kan ik een offerte verwachten?',
      antwoord:
        'Na uw aanvraag nemen we in de regel binnen één werkdag contact met u op. Voor een concrete offerte plannen we, indien nodig, eerst een korte (kosteloze) opname of beoordelen we de foto\'s die u heeft meegestuurd.',
    },
    {
      id: 'faq3',
      vraag: 'Werken jullie ook voor vastgoedbeheerders en VvE\'s?',
      antwoord:
        'Zeker. We werken zowel voor particuliere verhuurders en woningeigenaren als voor professionele vastgoedbeheerders en VvE\'s. Voor grotere portefeuilles maken we graag afspraken over vaste inspecties en rapportages.',
    },
    {
      id: 'faq4',
      vraag: 'Kan ik foto\'s van de klus meesturen?',
      antwoord:
        'Ja, en dat helpt ons enorm. Via het offerteformulier kunt u tot 50 foto\'s van de situatie toevoegen, zodat wij een scherpere en snellere offerte kunnen opstellen.',
    },
    {
      id: 'faq5',
      vraag: 'Wat als ik een spoedklus heb?',
      antwoord:
        'Geef dit duidelijk aan in uw aanvraag of bel ons direct. We kijken dan of we op korte termijn kunnen schakelen. Door onze korte lijnen kunnen we vaak snel handelen.',
    },
  ];
}

function standaardProjecten() {
  return [
    {
      id: 'demo-badkamer',
      titel: 'Complete badkamerrenovatie',
      categorie: 'Renovatie',
      omschrijving:
        'Een gedateerde badkamer volledig gestript en opnieuw opgebouwd: nieuwe leidingen, strakke tegels, inloopdouche en moderne afwerking.',
      voorFoto: '/img/project-badkamer-voor.jpg',
      naFoto: '/img/project-badkamer-na.jpg',
      voorbeeld: true,
    },
    {
      id: 'demo-gevel',
      titel: 'Schilderwerk & gevelherstel',
      categorie: 'Schilderwerk & gevel',
      omschrijving:
        'Houtrot hersteld, kozijnen geschuurd en de complete gevel opnieuw geschilderd voor een frisse, duurzame uitstraling.',
      voorFoto: '/img/project-gevel-voor.jpg',
      naFoto: '/img/project-gevel-na.jpg',
      voorbeeld: true,
    },
    {
      id: 'demo-woning',
      titel: 'Woning verhuurklaar opgeleverd',
      categorie: 'Mutatieonderhoud',
      omschrijving:
        'Tussen twee huurders in volledig opgeknapt: wanden hersteld en gesausd, nieuwe vloer en een nette, verhuurklare oplevering.',
      voorFoto: '/img/project-woning-voor.jpg',
      naFoto: '/img/project-woning-na.jpg',
      voorbeeld: true,
    },
  ];
}

function standaardReviews() {
  return [
    {
      id: 'demo-review1',
      naam: 'Vastgoedbeheerder',
      functie: 'Beheerder woningportefeuille',
      tekst:
        'Snelle reactie, heldere offerte en een nette uitvoering. Precies waar je bij onderhoud naar op zoek bent — één aanspreekpunt dat gewoon regelt.',
      sterren: 5,
      voorbeeld: true,
    },
    {
      id: 'demo-review2',
      naam: 'Particuliere verhuurder',
      functie: '',
      tekst:
        'Onze huurwoning tussen twee huurders in supersnel opgeknapt. Meegedacht, netjes gewerkt en op tijd opgeleverd. Absolute aanrader.',
      sterren: 5,
      voorbeeld: true,
    },
    {
      id: 'demo-review3',
      naam: 'Woningeigenaar',
      functie: '',
      tekst:
        'Vakmensen die weten waar ze mee bezig zijn. Duidelijke communicatie en het resultaat mag er zijn. Zeer tevreden over de samenwerking.',
      sterren: 5,
      voorbeeld: true,
    },
  ];
}

function defaultData() {
  return {
    instellingen: {
      gebruikersnaam: 'root',
      wachtwoordHash: null,
      sessionSecret: crypto.randomBytes(32).toString('hex'),
      site: {
        bedrijfsnaam: 'Roelfsema Totaalonderhoud',
        stijl: '3',
        strapline: 'Vastgoedonderhoud zoals het hoort',
        heroTitel: 'Vastgoedonderhoud, zoals het hoort.',
        heroSubtitel:
          'Van dagelijks onderhoud tot ingrijpende renovatie: Roelfsema Totaalonderhoud ontzorgt vastgoedeigenaren en -beheerders met vakmanschap, heldere afspraken en één vast aanspreekpunt — zodat u nooit meer hoeft te schakelen tussen vijf verschillende partijen.',
        overOns:
          'Roelfsema Totaalonderhoud is opgericht vanuit een simpel uitgangspunt: onderhoud aan uw pand moet zonder zorgen kunnen. Geen wisselende onderaannemers, geen vage toezeggingen — wel een vast team dat uw pand kent, meedenkt en doet wat er is afgesproken. Of het nu gaat om één huurwoning of een complete vastgoedportefeuille: wij plannen zorgvuldig, werken netjes en leveren op wat we beloven.',
        telefoon: '',
        email: '',
        adres: '',
        werkgebied: '',
        kvk: '',
        btw: '',
        logo: null,
        heroAfbeelding: null,
        stats: standaardStats(),
      },
    },
    projecten: standaardProjecten(),
    reviews: standaardReviews(),
    faq: standaardFaq(),
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
    if (!Array.isArray(merged.instellingen.site.stats) || !merged.instellingen.site.stats.length) {
      merged.instellingen.site.stats = standaardStats();
    }
    merged.projecten = Array.isArray(parsed.projecten) ? parsed.projecten : standaardProjecten();
    merged.reviews = Array.isArray(parsed.reviews) ? parsed.reviews : standaardReviews();
    merged.faq = Array.isArray(parsed.faq) ? parsed.faq : standaardFaq();
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

function nieuwId() {
  return crypto.randomBytes(6).toString('hex');
}

module.exports = {
  DATA_DIR,
  DB_FILE,
  UPLOADS_DIR,
  DIENSTEN,
  PERIODES,
  STIJLEN,
  standaardStats,
  standaardFaq,
  defaultData,
  ensureDirs,
  readDb,
  writeDb,
  nieuwId,
};
