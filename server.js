/*
 * Agroria Landbouwvoertuigen — webserver
 * Publieke site + beheerpaneel op /uadmin
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const db = require('./lib/db');
const { omschrijvingHtml, omschrijvingText } = require('./lib/format');
const { prijsInfo } = require('./lib/prijs');
const { maakSlug, uniekeSlug } = require('./lib/slug');
const mail = require('./lib/mail');
const { bestellingBevestiging, inruilBevestiging, vraagBevestiging } = require('./lib/klantmail');
const stats = require('./lib/stats');
const video = require('./lib/video');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// Een stabiel sessie-geheim: uit de omgeving, of anders eenmalig genereren en
// bewaren in data/db.json. Zo blijven ingelogde sessies geldig na herstart en
// staat er nooit een geheim in de broncode.
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const data = db.read();
  if (!data.settings) data.settings = {};
  if (!data.settings.sessionSecret) {
    data.settings.sessionSecret = require('crypto').randomBytes(32).toString('hex');
    db.write(data);
  }
  return data.settings.sessionSecret;
}

// --- Uploads (foto's) ---
// Foto's worden eerst tijdelijk op de schijf gezet (niet in het geheugen —
// dat zou bij grote batches, bijv. 30+ foto's tegelijk, teveel RAM kosten op
// een kleine server) en daarna één voor één met sharp geoptimaliseerd:
// verkleind naar max. 1600px breed en gecomprimeerd naar webp. Dat scheelt
// fors in laadtijd — belangrijk voor het high-end gevoel van de site.
const MAX_FOTOS_PER_KEER = 40; // ruim voldoende voor bijv. 30 foto's in één keer
const TIJDELIJKE_MAP = require('os').tmpdir();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TIJDELIJKE_MAP),
    filename: (req, file, cb) => cb(null, 'upload-' + db.id())
  }),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB per originele foto
  fileFilter: (req, file, cb) => {
    const ok = /jpe?g|png|webp|gif/i.test(file.mimetype);
    cb(ok ? null : new Error('Alleen afbeeldingen (JPG, PNG, WEBP of GIF) zijn toegestaan.'), ok);
  }
});

const UPLOAD_DIR = path.join(db.DATA_DIR, 'uploads');

async function bewaarFoto(file) {
  // Het logo voor e-mails wordt als PNG opgeslagen: e-mailprogramma's zoals
  // Outlook tonen webp niet altijd. Al het andere wordt compact webp.
  const isMailLogo = file.fieldname === 'mail_logo';
  const naam = db.id() + (isMailLogo ? '.png' : '.webp');
  const doel = path.join(UPLOAD_DIR, naam);
  try {
    const basis = sharp(file.path).rotate(); // corrigeert stand op basis van EXIF
    if (isMailLogo) {
      await basis
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .png()
        .toFile(doel);
    } else {
      await basis
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(doel);
    }
  } finally {
    fs.unlink(file.path, () => {}); // tijdelijk bestand altijd opruimen
  }
  return naam;
}

// Middleware: verwerkt alle geüploade foto's (zowel .array als .fields) en zet
// per bestand file.filename klaar, precies zoals de rest van de code verwacht.
// Bewust ÉÉN voor ÉÉN verwerkt (niet allemaal tegelijk), zodat ook een grote
// batch foto's geen geheugen- of CPU-piek veroorzaakt.
async function verwerkUploads(req, res, next) {
  let files = [];
  if (Array.isArray(req.files)) files = req.files;
  else if (req.files) Object.keys(req.files).forEach(k => { files = files.concat(req.files[k]); });
  else if (req.file) files = [req.file];
  if (!files.length) return next();
  try {
    for (const f of files) {
      f.filename = await bewaarFoto(f);
    }
    next();
  } catch (err) {
    next(err);
  }
}

// --- Basis-instellingen ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(db.DATA_DIR, 'uploads')));
if (IS_PROD) app.set('trust proxy', 1);
app.use(session({
  secret: sessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8, // 8 uur
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD
  }
}));

// --- Hulpfuncties beschikbaar in alle templates ---
app.locals.euro = (n) => '€ ' + Number(n || 0).toLocaleString('nl-NL');
app.locals.getal = (n) => Number(n || 0).toLocaleString('nl-NL');
// Bedrag met centen, zoals op een factuur hoort: € 29.500,00
app.locals.euroBedrag = (n) => '€ ' + Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Datum in Nederlandse notatie (17-07-2026) vanuit een yyyy-mm-dd invoerveld
app.locals.datumNL = (d) => {
  if (!d) return '';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(d);
};
app.locals.firstFoto = (t) => (t.fotos && t.fotos[0]) ? '/uploads/' + t.fotos[0] : null;
app.locals.omschrijvingHtml = omschrijvingHtml;
app.locals.omschrijvingText = omschrijvingText;
app.locals.prijsInfo = prijsInfo;
// Veilig JSON in een <script>-blok zetten: escape "<" zodat een waarde als
// "</script><script>...</script>" het blok niet kan doorbreken.
app.locals.safeJsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

// Maakt sessie-info, contactgegevens en het logo beschikbaar in elke view
app.use((req, res, next) => {
  const data = db.read();
  res.locals.user = req.session.user || null;
  // Bezoekersstatistieken: alleen publieke pagina-bezoeken tellen — geen
  // beheerpagina's, technische bestanden of de eigen bezoeken van de beheerder.
  if (req.method === 'GET' && !req.session.user &&
      !req.path.startsWith('/uadmin') &&
      !['/robots.txt', '/sitemap.xml', '/favicon.ico'].includes(req.path)) {
    stats.telPagina(req);
  }
  res.locals.contact = (data.pages || {}).contact || {};
  res.locals.logo = (data.settings || {}).logo || '';
  res.locals.favicon = (data.settings || {}).favicon || '';
  res.locals.paginaHeroFoto = (data.settings || {}).paginaHeroFoto || '';
  res.locals.persistent = db.persistent;
  res.locals.storageUsing = db.DATA_DIR;
  res.locals.storageConfigured = db.configuredDir;
  res.locals.storageError = db.storageError;
  res.locals.topmerken = ((data.settings || {}).merken) || 'Fendt, John Deere, Case IH, New Holland, Claas, Deutz-Fahr, Massey Ferguson, Valtra';
  res.locals.path = req.path;
  res.locals.SITE_URL = SITE_URL;
  res.locals.canonical = SITE_URL + req.path;
  // WhatsApp-nummer: apart veld, anders het telefoonnummer als terugval.
  const ruw = res.locals.contact.whatsapp || res.locals.contact.telefoon || '';
  res.locals.whatsapp = ruw.replace(/[^\d+]/g, '');
  next();
});

// =====================================================================
//  PUBLIEKE PAGINA'S
// =====================================================================
// Concept-trekkers zijn onzichtbaar voor bezoekers (wel voor de ingelogde beheerder).
const zichtbaar = (t) => t.status !== 'verwijderd' && t.status !== 'concept';

app.get('/', (req, res) => {
  const data = db.read();
  const uitgelicht = data.tractors
    .filter(t => t.uitgelicht && zichtbaar(t))
    .slice(0, 4);
  res.render('home', { page: data.pages.home, uitgelicht });
});

app.get('/aanbod', (req, res) => {
  const data = db.read();
  // Verkochte machines blijven zichtbaar (met "Verkocht"-markering), maar
  // komen achteraan — het beschikbare aanbod eerst.
  let lijst = data.tractors.filter(t => zichtbaar(t));
  const { merk, q, sort } = req.query;
  if (merk) lijst = lijst.filter(t => t.merk === merk);
  if (q) {
    const s = q.toLowerCase();
    lijst = lijst.filter(t =>
      (t.merk + ' ' + t.model).toLowerCase().includes(s));
  }
  if (sort === 'prijs-op') lijst.sort((a, b) => a.prijs - b.prijs);
  else if (sort === 'prijs-af') lijst.sort((a, b) => b.prijs - a.prijs);
  else if (sort === 'jaar') lijst.sort((a, b) => b.bouwjaar - a.bouwjaar);
  lijst.sort((a, b) => (a.status === 'verkocht' ? 1 : 0) - (b.status === 'verkocht' ? 1 : 0));
  const merken = [...new Set(data.tractors.filter(zichtbaar).map(t => t.merk))].sort();
  // Paginering: 9 trekkers per pagina (drie rijen van drie), verkochte
  // machines schuiven door de sortering hierboven vanzelf naar het einde.
  const PER_PAGINA = 9;
  const totaal = lijst.length;
  const paginas = Math.max(1, Math.ceil(totaal / PER_PAGINA));
  const pagina = Math.min(Math.max(parseInt(req.query.pagina) || 1, 1), paginas);
  const paginaLijst = lijst.slice((pagina - 1) * PER_PAGINA, pagina * PER_PAGINA);
  res.render('aanbod', {
    lijst: paginaLijst, totaal, pagina, paginas,
    merken, filter: { merk, q, sort }, page: (data.pages.aanbod || {})
  });
});

// De aparte verkocht-pagina is vervallen: verkochte machines staan gewoon
// (gemarkeerd) tussen het aanbod. Oude links verwijzen we netjes door.
app.get('/verkocht', (req, res) => res.redirect(301, '/aanbod'));

// Nette URL (bijv. /trekker/case-ih-puma-165-cvx). Oude links op basis van het
// kale ID blijven werken en verwijzen automatisch door naar de nette versie.
app.get('/trekker/:slug', (req, res) => {
  const data = db.read();
  let trekker = data.tractors.find(t => t.slug === req.params.slug);
  if (!trekker) {
    trekker = data.tractors.find(t => t.id === req.params.slug);
    if (trekker && trekker.slug) return res.redirect(301, '/trekker/' + trekker.slug);
  }
  // Concept: alleen zichtbaar voor de ingelogde beheerder (handig als voorbeeld/preview).
  if (!trekker || (trekker.status === 'concept' && !req.session.user)) {
    return res.status(404).render('404');
  }
  if (!req.session.user) stats.telTrekker(req, trekker.slug || trekker.id);
  const meer = data.tractors
    .filter(t => t.id !== trekker.id && zichtbaar(t) && t.status !== 'verkocht')
    .slice(0, 3);
  res.render('trekker', { trekker, meer });
});

app.get('/inruil', (req, res) => {
  res.render('inruil', { page: db.read().pages.inruil });
});

app.get('/over-ons', (req, res) => {
  res.render('over-ons', { page: db.read().pages.overons });
});

app.get('/selectie', (req, res) => {
  res.render('selectie', { page: (db.read().pages.selectie || {}) });
});

app.get('/garantie', (req, res) => {
  res.render('garantie', {});
});

app.get('/faq', (req, res) => {
  res.render('faq', {});
});

app.get('/contact', (req, res) => {
  res.render('contact', {});
});

// --- SEO: robots.txt & sitemap.xml ---
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nDisallow: /uadmin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req, res) => {
  const data = db.read();
  const statisch = ['/', '/aanbod', '/over-ons', '/selectie', '/garantie', '/inruil', '/faq', '/contact'];
  const urls = statisch.map(p => ({ loc: SITE_URL + p }));
  data.tractors
    .filter(t => t.status !== 'verwijderd' && t.status !== 'concept')
    .forEach(t => urls.push({ loc: SITE_URL + '/trekker/' + (t.slug || t.id) }));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${u.loc}</loc></url>`).join('\n') +
    `\n</urlset>\n`;
  res.type('application/xml').send(xml);
});

// Aanvraag / vraag versturen (komt binnen in uadmin)
// Hulpfunctie: stuurt (indien ingesteld) een e-mailmelding over een nieuwe aanvraag.
function mailNieuweAanvraag(kop, regels) {
  const tekst = regels.filter(Boolean).join('\n') +
    `\n\nBekijk en beantwoord in het beheer:\n${SITE_URL}/uadmin/aanvragen`;
  mail.stuurMelding(kop, tekst); // fire-and-forget: blokkeert de bezoeker nooit
}

// Hulpfunctie: stuurt de opgemaakte bevestigingsmail naar de klant zelf
// (fire-and-forget). bouw = een van de functies uit lib/klantmail.
function mailKlantBevestiging(aanvraag, bouw) {
  if (!aanvraag.email) return;
  const data = db.read();
  const mailLogo = (data.settings || {}).mailLogo ? SITE_URL + data.settings.mailLogo : '';
  const bev = bouw(aanvraag, (data.pages || {}).contact || {}, SITE_URL, mailLogo);
  mail.stuurNaarKlant(aanvraag.email, bev.onderwerp, bev.html, bev.tekst);
}

app.post('/aanvraag', (req, res) => {
  const data = db.read();
  const aanvraag = {
    id: db.id(),
    type: 'vraag',
    onderwerp: req.body.onderwerp || 'Algemene vraag',
    naam: (req.body.naam || '').trim(),
    email: (req.body.email || '').trim(),
    telefoon: (req.body.telefoon || '').trim(),
    bericht: (req.body.bericht || '').trim(),
    trekker: req.body.trekker || '',
    gelezen: false,
    createdAt: new Date().toISOString()
  };
  data.inquiries.unshift(aanvraag);
  db.write(data);
  mailNieuweAanvraag(`Nieuwe vraag via agroria.nl — ${aanvraag.naam || 'onbekend'}`, [
    `Er is een nieuwe vraag binnengekomen op de website.`,
    ``,
    `Onderwerp: ${aanvraag.onderwerp}`,
    aanvraag.trekker ? `Trekker: ${aanvraag.trekker}` : '',
    `Naam: ${aanvraag.naam || '—'}`,
    `E-mail: ${aanvraag.email || '—'}`,
    `Telefoon: ${aanvraag.telefoon || '—'}`,
    ``,
    `Bericht:`,
    aanvraag.bericht || '—'
  ]);
  // Opgemaakte bevestigingsmail naar de klant, namens Agroria.
  mailKlantBevestiging(aanvraag, vraagBevestiging);
  // Doorsturen i.p.v. direct tonen: zo kan het verversen of herstellen van de
  // bedanktpagina het formulier nooit opnieuw insturen (geen dubbele mails).
  res.redirect('/bedankt/aanvraag');
});

// Inruil-taxatie aanvragen (komt binnen in uadmin) — met optioneel foto's van de machine
const INRUIL_MAX_FOTOS = 20;
app.post('/inruil', upload.array('fotos', INRUIL_MAX_FOTOS), verwerkUploads, (req, res) => {
  const data = db.read();
  const aanvraag = {
    id: db.id(),
    type: 'inruil',
    onderwerp: 'Inruil-taxatie',
    naam: (req.body.naam || '').trim(),
    email: (req.body.email || '').trim(),
    telefoon: (req.body.telefoon || '').trim(),
    machine: `${req.body.merk || ''} ${req.body.model || ''}`.trim(),
    bouwjaar: req.body.bouwjaar || '',
    uren: req.body.uren || '',
    bericht: (req.body.bericht || '').trim(),
    fotos: (req.files || []).map(f => f.filename),
    gelezen: false,
    createdAt: new Date().toISOString()
  };
  data.inquiries.unshift(aanvraag);
  db.write(data);
  mailNieuweAanvraag(`Nieuwe inruil-aanvraag via agroria.nl — ${aanvraag.machine || aanvraag.naam || 'onbekend'}`, [
    `Er is een nieuwe inruil-taxatie aangevraagd op de website.`,
    ``,
    `Machine: ${aanvraag.machine || '—'}`,
    `Bouwjaar: ${aanvraag.bouwjaar || '—'} · Uren: ${aanvraag.uren || '—'}`,
    `Aantal foto's meegestuurd: ${aanvraag.fotos.length}`,
    `Naam: ${aanvraag.naam || '—'}`,
    `E-mail: ${aanvraag.email || '—'}`,
    `Telefoon: ${aanvraag.telefoon || '—'}`,
    ``,
    `Toelichting:`,
    aanvraag.bericht || '—'
  ]);
  // Opgemaakte bevestigingsmail naar de klant, namens Agroria.
  mailKlantBevestiging(aanvraag, inruilBevestiging);
  res.redirect('/bedankt/inruil');
});

// Bestelpagina voor een specifieke trekker
app.get('/bestellen/:slug', (req, res) => {
  const data = db.read();
  let trekker = data.tractors.find(t => t.slug === req.params.slug);
  if (!trekker) {
    trekker = data.tractors.find(t => t.id === req.params.slug);
    if (trekker && trekker.slug) return res.redirect(301, '/bestellen/' + trekker.slug);
  }
  if (!trekker || (trekker.status === 'concept' && !req.session.user)) {
    return res.status(404).render('404');
  }
  if (trekker.status === 'verkocht') return res.redirect('/trekker/' + (trekker.slug || trekker.id));
  res.render('bestellen', { trekker });
});

// Bestelling plaatsen (komt binnen in uadmin)
app.post('/bestelling', (req, res) => {
  const data = db.read();
  const t = data.tractors.find(x => x.id === req.body.trekkerId);
  const naamTrekker = t ? `${t.merk} ${t.model}` : (req.body.trekker || 'Trekker');
  const aanvraag = {
    id: db.id(),
    type: 'bestelling',
    onderwerp: 'Bestelling: ' + naamTrekker,
    naam: (req.body.naam || '').trim(),
    bedrijf: (req.body.bedrijf || '').trim(),
    email: (req.body.email || '').trim(),
    telefoon: (req.body.telefoon || '').trim(),
    adres: (req.body.adres || '').trim(),
    postcode: (req.body.postcode || '').trim(),
    plaats: (req.body.plaats || '').trim(),
    bericht: (req.body.bericht || '').trim(),
    trekker: naamTrekker,
    trekkerId: req.body.trekkerId || '',
    prijs: t ? t.prijs : (parseInt(req.body.prijs) || 0),
    gelezen: false,
    createdAt: new Date().toISOString()
  };
  data.inquiries.unshift(aanvraag);
  db.write(data);
  mailNieuweAanvraag(`🚜 Nieuwe BESTELLING via agroria.nl — ${naamTrekker}`, [
    `Er is een nieuwe bestelling geplaatst op de website!`,
    ``,
    `Trekker: ${naamTrekker}`,
    aanvraag.prijs ? `Prijs: € ${Number(aanvraag.prijs).toLocaleString('nl-NL')}` : '',
    `Naam: ${aanvraag.naam || '—'}`,
    aanvraag.bedrijf ? `Bedrijf: ${aanvraag.bedrijf}` : '',
    `E-mail: ${aanvraag.email || '—'}`,
    `Telefoon: ${aanvraag.telefoon || '—'}`,
    (aanvraag.adres || aanvraag.plaats) ? `Adres: ${[aanvraag.adres, [aanvraag.postcode, aanvraag.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ')}` : '',
    ``,
    `Opmerking:`,
    aanvraag.bericht || '—'
  ]);
  // Opgemaakte bevestigingsmail naar de klant, namens Agroria (fire-and-forget).
  if (aanvraag.email) {
    const mailLogo = (data.settings || {}).mailLogo ? SITE_URL + data.settings.mailLogo : '';
    const bev = bestellingBevestiging(aanvraag, t, (data.pages || {}).contact || {}, SITE_URL, mailLogo);
    mail.stuurNaarKlant(aanvraag.email, bev.onderwerp, bev.html, bev.tekst);
  }
  res.redirect('/besteld/' + aanvraag.id);
});

// Bedankt- en besteld-pagina's als aparte GET-pagina's (POST → redirect → GET).
// Zo stuurt het verversen of terugbladeren naar deze pagina het formulier nooit
// opnieuw in — dat gaf eerder dubbele bestellingen en dubbele mails.
app.get('/bedankt/:soort', (req, res) => {
  const soort = req.params.soort === 'inruil' ? 'inruil' : 'aanvraag';
  res.render('bedankt', { soort });
});

app.get('/besteld/:id', (req, res) => {
  const data = db.read();
  const aanvraag = data.inquiries.find(i => i.id === req.params.id && i.type === 'bestelling');
  if (!aanvraag) return res.redirect('/aanbod');
  res.render('besteld', { trekker: aanvraag.trekker, prijs: aanvraag.prijs || 0 });
});

// =====================================================================
//  BEHEERPANEEL  /uadmin
// =====================================================================
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/uadmin/login');
}

// Aantal nieuwe (ongelezen) aanvragen beschikbaar maken voor het menu
app.use('/uadmin', (req, res, next) => {
  if (req.session.user) {
    res.locals.newCount = db.read().inquiries.filter(i => !i.gelezen).length;
  }
  next();
});

app.get('/uadmin/login', (req, res) => {
  if (req.session.user) return res.redirect('/uadmin');
  res.render('admin/login', { error: null, layout: false });
});

app.post('/uadmin/login', (req, res) => {
  const data = db.read();
  const ident = (req.body.gebruiker || req.body.email || '').trim().toLowerCase();
  const user = data.users.find(u =>
    (u.username || '').toLowerCase() === ident ||
    (u.email || '').toLowerCase() === ident);
  if (user && bcrypt.compareSync(req.body.password || '', user.passwordHash)) {
    req.session.user = { id: user.id, email: user.email, name: user.name, username: user.username };
    return res.redirect('/uadmin');
  }
  res.render('admin/login', { error: 'Onjuiste gebruikersnaam of wachtwoord.', layout: false });
});

app.get('/uadmin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/uadmin/login'));
});

app.get('/uadmin', requireAuth, (req, res) => {
  const data = db.read();
  const kerncijfers = {
    trekkers: data.tractors.filter(t => t.status !== 'verwijderd').length,
    beschikbaar: data.tractors.filter(t => t.status === 'beschikbaar').length,
    nieuweAanvragen: data.inquiries.filter(i => !i.gelezen).length,
    totaalAanvragen: data.inquiries.length
  };
  const laatste = data.inquiries.slice(0, 5);
  const bezoek = stats.overzicht(data.tractors.filter(t => t.status !== 'verwijderd'));
  res.render('admin/dashboard', { stats: kerncijfers, laatste, bezoek, active: 'dashboard' });
});

// Live-teller voor het dashboard (wordt elke paar seconden opgehaald zodat
// het getal meebeweegt zonder de pagina te hoeven verversen).
app.get('/uadmin/live.json', requireAuth, (req, res) => {
  res.json({ live: stats.liveAantal() });
});

// ---- Trekkers beheren ----
app.get('/uadmin/trekkers', requireAuth, (req, res) => {
  const data = db.read();
  const lijst = data.tractors.filter(t => t.status !== 'verwijderd');
  res.render('admin/trekkers', { lijst, active: 'trekkers' });
});

app.get('/uadmin/trekkers/nieuw', requireAuth, (req, res) => {
  res.render('admin/trekker-form', { trekker: null, active: 'trekkers' });
});

app.get('/uadmin/trekkers/:id', requireAuth, (req, res) => {
  const data = db.read();
  const trekker = data.tractors.find(t => t.id === req.params.id);
  if (!trekker) return res.redirect('/uadmin/trekkers');
  res.render('admin/trekker-form', { trekker, active: 'trekkers' });
});

app.post('/uadmin/trekkers/:id?', requireAuth, upload.array('fotos', MAX_FOTOS_PER_KEER), verwerkUploads, (req, res) => {
  const data = db.read();
  const b = req.body;
  const velden = {
    merk: (b.merk || '').trim(),
    model: (b.model || '').trim(),
    bouwjaar: parseInt(b.bouwjaar) || null,
    uren: parseInt(b.uren) || 0,
    pk: parseInt(b.pk) || 0,
    transmissie: (b.transmissie || '').trim(),
    prijs: parseInt(b.prijs) || 0,
    oudePrijs: parseInt(b.oudePrijs) || 0,
    // '' = nog niet ingesteld -> prijs blijft getoond zoals voorheen (geen BTW/marge-label)
    prijsType: (b.prijsType === 'btw' || b.prijsType === 'marge') ? b.prijsType : '',
    voorlader: b.voorlader === 'on' || b.voorlader === 'true',
    categorie: b.categorie || 'Trekker',
    status: b.status || 'beschikbaar',
    uitgelicht: b.uitgelicht === 'on' || b.uitgelicht === 'true',
    omschrijving: (b.omschrijving || '').trim()
  };
  const nieuweFotos = (req.files || []).map(f => f.filename);
  let trekkerId = '';

  if (req.params.id) {
    const t = data.tractors.find(x => x.id === req.params.id);
    if (t) {
      Object.assign(t, velden);
      t.fotos = (t.fotos || []).concat(nieuweFotos);
      // Nette URL alleen aanmaken als deze trekker er nog geen heeft, zodat
      // eerder gedeelde links nooit veranderen door een latere bewerking.
      if (!t.slug) {
        const bezet = data.tractors.filter(x => x.id !== t.id && x.slug).map(x => x.slug);
        t.slug = uniekeSlug(maakSlug(`${t.merk} ${t.model}`.trim()), bezet);
      }
    }
    if (t) trekkerId = t.id;
  } else {
    const bezet = data.tractors.filter(x => x.slug).map(x => x.slug);
    const slug = uniekeSlug(maakSlug(`${velden.merk} ${velden.model}`.trim()), bezet);
    trekkerId = db.id();
    data.tractors.unshift(Object.assign({
      id: trekkerId, slug, fotos: nieuweFotos, createdAt: new Date().toISOString()
    }, velden));
  }
  db.write(data);
  if (trekkerId) video.controleer(trekkerId); // maak/ververs de presentatievideo op de achtergrond
  res.redirect('/uadmin/trekkers');
});

app.post('/uadmin/trekkers/:id/foto/delete', requireAuth, (req, res) => {
  const data = db.read();
  const t = data.tractors.find(x => x.id === req.params.id);
  if (t) {
    t.fotos = (t.fotos || []).filter(f => f !== req.body.foto);
    const p = path.join(db.DATA_DIR, 'uploads', req.body.foto);
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
    db.write(data);
    video.controleer(t.id);
  }
  res.redirect('/uadmin/trekkers/' + req.params.id);
});

// Volledige foto-volgorde opslaan (na slepen of pijltjes in het beheer).
app.post('/uadmin/trekkers/:id/fotos/volgorde', requireAuth, (req, res) => {
  const data = db.read();
  const t = data.tractors.find(x => x.id === req.params.id);
  const nieuw = Array.isArray(req.body.fotos) ? req.body.fotos : [];
  // Alleen accepteren als het exact dezelfde foto's zijn, alleen in andere volgorde.
  if (t && t.fotos && nieuw.length === t.fotos.length &&
      nieuw.every(f => t.fotos.includes(f)) && new Set(nieuw).size === nieuw.length) {
    t.fotos = nieuw;
    db.write(data);
    video.controleer(t.id);
    return res.json({ ok: true });
  }
  res.status(400).json({ ok: false });
});

// Maak een andere foto de hoofdfoto (eerste foto), zonder iets te verwijderen.
app.post('/uadmin/trekkers/:id/foto/hoofd', requireAuth, (req, res) => {
  const data = db.read();
  const t = data.tractors.find(x => x.id === req.params.id);
  if (t && t.fotos) {
    const i = t.fotos.indexOf(req.body.foto);
    if (i > 0) {
      t.fotos.splice(i, 1);
      t.fotos.unshift(req.body.foto);
      db.write(data);
      video.controleer(t.id);
    }
  }
  res.redirect('/uadmin/trekkers/' + req.params.id);
});

app.post('/uadmin/trekkers/:id/delete', requireAuth, (req, res) => {
  const data = db.read();
  video.ruimOp(data.tractors.find(t => t.id === req.params.id));
  data.tractors = data.tractors.filter(t => t.id !== req.params.id);
  db.write(data);
  res.redirect('/uadmin/trekkers');
});

// Presentatievideo handmatig opnieuw laten maken
app.post('/uadmin/trekkers/:id/video', requireAuth, (req, res) => {
  const data = db.read();
  const t = data.tractors.find(x => x.id === req.params.id);
  if (t) {
    t.videoBron = '';     // forceer een nieuwe render
    t.videoPogingen = 0;  // handmatig = altijd een verse kans
    db.write(data);
    video.controleer(t.id);
  }
  res.redirect('/uadmin/trekkers/' + req.params.id);
});

// ---- Pagina-afbeeldingen & teksten beheren ----
app.get('/uadmin/paginas', requireAuth, (req, res) => {
  const data = db.read();
  res.render('admin/paginas', { pages: data.pages, settings: data.settings || {}, active: 'paginas', opgeslagen: req.query.ok });
});

const paginaUpload = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
  { name: 'mail_logo', maxCount: 1 },
  { name: 'pagina_heroFoto', maxCount: 1 },
  { name: 'home_heroFoto', maxCount: 1 },
  { name: 'home_introFoto', maxCount: 1 },
  { name: 'home_garantieFoto', maxCount: 1 },
  { name: 'home_nieuwFoto', maxCount: 1 },
  { name: 'home_closerFoto', maxCount: 1 },
  { name: 'inruil_foto', maxCount: 1 },
  { name: 'inruil_foto2', maxCount: 1 },
  { name: 'overons_foto', maxCount: 1 },
  { name: 'overons_foto2', maxCount: 1 },
  { name: 'selectie_foto1', maxCount: 1 },
  { name: 'selectie_foto2', maxCount: 1 },
  { name: 'selectie_foto3', maxCount: 1 },
  { name: 'aanbod_foto1', maxCount: 1 },
  { name: 'aanbod_foto2', maxCount: 1 }
]);

app.post('/uadmin/paginas', requireAuth, paginaUpload, verwerkUploads, (req, res) => {
  const data = db.read();
  const b = req.body;
  const f = req.files || {};
  if (!data.settings) data.settings = {};
  const set = (obj, key, val) => { if (val !== undefined) obj[key] = val; };

  if (f.logo) data.settings.logo = '/uploads/' + f.logo[0].filename;
  if (f.favicon) data.settings.favicon = '/uploads/' + f.favicon[0].filename;
  if (f.mail_logo) data.settings.mailLogo = '/uploads/' + f.mail_logo[0].filename;
  if (f.pagina_heroFoto) data.settings.paginaHeroFoto = '/uploads/' + f.pagina_heroFoto[0].filename;
  set(data.settings, 'merken', b.settings_merken);
  set(data.pages.home, 'heroTitel', b.home_heroTitel);
  set(data.pages.home, 'heroTekst', b.home_heroTekst);
  if (f.home_heroFoto) data.pages.home.heroFoto = '/uploads/' + f.home_heroFoto[0].filename;
  if (f.home_introFoto) data.pages.home.introFoto = '/uploads/' + f.home_introFoto[0].filename;
  if (f.home_garantieFoto) data.pages.home.garantieFoto = '/uploads/' + f.home_garantieFoto[0].filename;
  if (f.home_nieuwFoto) data.pages.home.nieuwFoto = '/uploads/' + f.home_nieuwFoto[0].filename;
  if (f.home_closerFoto) data.pages.home.closerFoto = '/uploads/' + f.home_closerFoto[0].filename;
  data.pages.inruil = data.pages.inruil || {};
  set(data.pages.inruil, 'titel', b.inruil_titel);
  set(data.pages.inruil, 'tekst', b.inruil_tekst);
  set(data.pages.inruil, 'waaromTitel', b.inruil_waaromTitel);
  set(data.pages.inruil, 'waaromTekst', b.inruil_waaromTekst);
  set(data.pages.inruil, 'quote', b.inruil_quote);
  set(data.pages.inruil, 'quoteWie', b.inruil_quoteWie);
  if (f.inruil_foto) data.pages.inruil.foto = '/uploads/' + f.inruil_foto[0].filename;
  if (f.inruil_foto2) data.pages.inruil.foto2 = '/uploads/' + f.inruil_foto2[0].filename;
  set(data.pages.overons, 'titel', b.overons_titel);
  set(data.pages.overons, 'tekst', b.overons_tekst);
  data.pages.overons = data.pages.overons || {};
  if (f.overons_foto) data.pages.overons.foto = '/uploads/' + f.overons_foto[0].filename;
  if (f.overons_foto2) data.pages.overons.foto2 = '/uploads/' + f.overons_foto2[0].filename;
  data.pages.selectie = data.pages.selectie || {};
  if (f.selectie_foto1) data.pages.selectie.foto1 = '/uploads/' + f.selectie_foto1[0].filename;
  if (f.selectie_foto2) data.pages.selectie.foto2 = '/uploads/' + f.selectie_foto2[0].filename;
  if (f.selectie_foto3) data.pages.selectie.foto3 = '/uploads/' + f.selectie_foto3[0].filename;
  data.pages.aanbod = data.pages.aanbod || {};
  if (f.aanbod_foto1) data.pages.aanbod.foto1 = '/uploads/' + f.aanbod_foto1[0].filename;
  if (f.aanbod_foto2) data.pages.aanbod.foto2 = '/uploads/' + f.aanbod_foto2[0].filename;
  set(data.pages.contact, 'adres', b.contact_adres);
  set(data.pages.contact, 'telefoon', b.contact_telefoon);
  set(data.pages.contact, 'whatsapp', b.contact_whatsapp);
  set(data.pages.contact, 'email', b.contact_email);
  set(data.pages.contact, 'openingstijden', b.contact_openingstijden);
  set(data.pages.contact, 'kvk', b.contact_kvk);
  set(data.pages.contact, 'btw', b.contact_btw);
  set(data.pages.contact, 'plaatsnaam', b.contact_plaatsnaam);
  db.write(data);
  res.redirect('/uadmin/paginas?ok=1');
});

app.post('/uadmin/logo/delete', requireAuth, (req, res) => {
  const data = db.read();
  if (data.settings && data.settings.logo) {
    const fname = data.settings.logo.replace('/uploads/', '');
    const p = path.join(db.DATA_DIR, 'uploads', fname);
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
    data.settings.logo = '';
    db.write(data);
  }
  res.redirect('/uadmin/paginas?ok=1');
});

app.post('/uadmin/favicon/delete', requireAuth, (req, res) => {
  const data = db.read();
  if (data.settings && data.settings.favicon) {
    const fname = data.settings.favicon.replace('/uploads/', '');
    const p = path.join(db.DATA_DIR, 'uploads', fname);
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
    data.settings.favicon = '';
    db.write(data);
  }
  res.redirect('/uadmin/paginas?ok=1');
});

app.post('/uadmin/maillogo/delete', requireAuth, (req, res) => {
  const data = db.read();
  if (data.settings && data.settings.mailLogo) {
    const fname = data.settings.mailLogo.replace('/uploads/', '');
    const p = path.join(db.DATA_DIR, 'uploads', fname);
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
    data.settings.mailLogo = '';
    db.write(data);
  }
  res.redirect('/uadmin/paginas?ok=1');
});

app.post('/uadmin/pagina-hero/delete', requireAuth, (req, res) => {
  const data = db.read();
  if (data.settings && data.settings.paginaHeroFoto) {
    const fname = data.settings.paginaHeroFoto.replace('/uploads/', '');
    const p = path.join(db.DATA_DIR, 'uploads', fname);
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
    data.settings.paginaHeroFoto = '';
    db.write(data);
  }
  res.redirect('/uadmin/paginas?ok=1');
});

// Verwijder één losse pagina-foto (bv. home.introFoto) -> terug naar illustratie
app.post('/uadmin/paginas/foto/delete', requireAuth, (req, res) => {
  const toegestaan = ['home.heroFoto','home.introFoto','home.garantieFoto','home.nieuwFoto','home.closerFoto','inruil.foto','inruil.foto2','overons.foto','overons.foto2','selectie.foto1','selectie.foto2','selectie.foto3','aanbod.foto1','aanbod.foto2'];
  const veld = req.body.veld;
  if (toegestaan.includes(veld)) {
    const [pagina, key] = veld.split('.');
    const data = db.read();
    const obj = data.pages[pagina];
    if (obj && obj[key]) {
      const fname = obj[key].replace('/uploads/', '');
      const p = path.join(db.DATA_DIR, 'uploads', fname);
      if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
      obj[key] = '';
      db.write(data);
    }
  }
  res.redirect('/uadmin/paginas?ok=1');
});

// ---- Facturen ----
// Facturen worden bewaard in data.facturen (db.json). Vanuit het beheer maak
// je een factuur op, en via de printweergave sla je hem op als PDF (Ctrl+P).

// Bedragen mogen op z'n Nederlands ingevuld worden: "29.500", "29500,50" of
// "29500.50" — alles wordt netjes omgerekend naar een getal (negatief mag,
// bijv. voor een inruil die van de prijs af gaat).
function parseBedrag(s) {
  let t = String(s || '').trim().replace(/[€\s]/g, '');
  if (!t) return 0;
  if (t.includes(',')) {
    // Nederlandse notatie: punten zijn duizendtallen, komma is de decimaal.
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    // Alleen punten als duizendtallen (bijv. "29.500"): punten weghalen.
    t = t.replace(/\./g, '');
  }
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

// Volgend factuurnummer in de vorm AGR-2026-0001 (per jaar oplopend).
function volgendFactuurnummer(data) {
  const jaar = new Date().getFullYear();
  const prefix = 'AGR-' + jaar + '-';
  let hoogste = 0;
  (data.facturen || []).forEach(f => {
    const m = String(f.nummer || '').match(new RegExp('^' + prefix + '(\\d+)$'));
    if (m) hoogste = Math.max(hoogste, parseInt(m[1], 10));
  });
  return prefix + String(hoogste + 1).padStart(4, '0');
}

// Rekent de totalen van een factuur uit (subtotaal, evt. BTW, restant).
function factuurTotalen(f) {
  const regels = f.regels || [];
  const subtotaal = regels.reduce((som, r) => som + Number(r.bedrag || 0), 0);
  let btw = 0, totaal = subtotaal;
  if (f.prijsType === 'btw') {
    btw = Math.round(subtotaal * 0.21 * 100) / 100;
    totaal = Math.round((subtotaal + btw) * 100) / 100;
  }
  const aanbetaling = Number(f.aanbetaling || 0);
  const restant = Math.round((totaal - aanbetaling) * 100) / 100;
  return { subtotaal, btw, totaal, aanbetaling, restant };
}
app.locals.factuurTotalen = factuurTotalen;

app.get('/uadmin/facturen', requireAuth, (req, res) => {
  const data = db.read();
  res.render('admin/facturen', { lijst: data.facturen || [], active: 'facturen' });
});

app.get('/uadmin/facturen/nieuw', requireAuth, (req, res) => {
  const data = db.read();
  // Vanuit een trekker gestart? Dan alvast de machinegegevens invullen.
  const t = req.query.trekker ? data.tractors.find(x => x.id === req.query.trekker) : null;
  res.render('admin/factuur-form', {
    factuur: null,
    voorstelNummer: volgendFactuurnummer(data),
    trekker: t || null,
    trekkers: data.tractors.filter(x => x.status !== 'verwijderd'),
    bank: (data.settings || {}).bank || {},
    opgeslagen: false,
    active: 'facturen'
  });
});

app.get('/uadmin/facturen/:id', requireAuth, (req, res) => {
  const data = db.read();
  const factuur = (data.facturen || []).find(f => f.id === req.params.id);
  if (!factuur) return res.redirect('/uadmin/facturen');
  res.render('admin/factuur-form', {
    factuur,
    voorstelNummer: factuur.nummer,
    trekker: null,
    trekkers: data.tractors.filter(x => x.status !== 'verwijderd'),
    bank: (data.settings || {}).bank || {},
    opgeslagen: req.query.ok,
    active: 'facturen'
  });
});

app.post('/uadmin/facturen/:id?', requireAuth, (req, res) => {
  const data = db.read();
  if (!data.facturen) data.facturen = [];
  const b = req.body;

  // Factuurregels: omschrijving + bedrag per regel (lege regels overslaan).
  const omschrijvingen = [].concat(b.regel_omschrijving || []);
  const bedragen = [].concat(b.regel_bedrag || []);
  const regels = omschrijvingen
    .map((om, i) => ({ omschrijving: String(om || '').trim(), bedrag: parseBedrag(bedragen[i]) }))
    .filter(r => r.omschrijving);

  const velden = {
    nummer: (b.nummer || '').trim() || volgendFactuurnummer(data),
    datum: b.datum || new Date().toISOString().slice(0, 10),
    vervaldatum: b.vervaldatum || '',
    status: ['concept', 'verstuurd', 'betaald'].includes(b.status) ? b.status : 'concept',
    klant: {
      naam: (b.klant_naam || '').trim(),
      bedrijf: (b.klant_bedrijf || '').trim(),
      adres: (b.klant_adres || '').trim(),
      postcodePlaats: (b.klant_postcodeplaats || '').trim(),
      land: (b.klant_land || '').trim(),
      email: (b.klant_email || '').trim(),
      telefoon: (b.klant_telefoon || '').trim(),
      kvk: (b.klant_kvk || '').trim(),
      btw: (b.klant_btw || '').trim()
    },
    machine: {
      naam: (b.machine_naam || '').trim(),
      bouwjaar: (b.machine_bouwjaar || '').trim(),
      uren: (b.machine_uren || '').trim(),
      pk: (b.machine_pk || '').trim(),
      transmissie: (b.machine_transmissie || '').trim(),
      serienummer: (b.machine_serienummer || '').trim(),
      kenteken: (b.machine_kenteken || '').trim()
    },
    regels,
    prijsType: (b.prijsType === 'btw') ? 'btw' : 'marge',
    aanbetaling: parseBedrag(b.aanbetaling),
    aanbetalingVervalt: b.aanbetaling_vervalt || '',
    levering: (b.levering || '').trim(),
    opmerking: (b.opmerking || '').trim(),
    // Vaste Agroria-garantie standaard aan; per factuur uit te zetten
    // (bijv. voor een los werktuig zonder garantie).
    garantie: b.garantie !== 'uit'
  };

  // Bankgegevens: op de factuur bewaren én als standaard onthouden voor de volgende.
  const bank = {
    iban: (b.bank_iban || '').trim(),
    bic: (b.bank_bic || '').trim(),
    tnv: (b.bank_tnv || '').trim()
  };
  velden.bank = bank;
  if (!data.settings) data.settings = {};
  if (bank.iban || bank.bic || bank.tnv) data.settings.bank = bank;

  let id = req.params.id;
  if (id) {
    const f = data.facturen.find(x => x.id === id);
    if (!f) return res.redirect('/uadmin/facturen');
    Object.assign(f, velden);
  } else {
    id = db.id();
    data.facturen.unshift(Object.assign({ id, createdAt: new Date().toISOString() }, velden));
  }
  db.write(data);
  res.redirect('/uadmin/facturen/' + id + '?ok=1');
});

app.post('/uadmin/facturen/:id/delete', requireAuth, (req, res) => {
  const data = db.read();
  data.facturen = (data.facturen || []).filter(f => f.id !== req.params.id);
  db.write(data);
  res.redirect('/uadmin/facturen');
});

// Printweergave: de opgemaakte A4-factuur. Opslaan als PDF via afdrukken.
app.get('/uadmin/facturen/:id/print', requireAuth, (req, res) => {
  const data = db.read();
  const factuur = (data.facturen || []).find(f => f.id === req.params.id);
  if (!factuur) return res.redirect('/uadmin/facturen');
  res.render('admin/factuur-print', { factuur, totalen: factuurTotalen(factuur) });
});

// ---- Koopovereenkomsten ----
// Zelfde opzet als de facturen: opstellen in het beheer, daarna via de
// printweergave opslaan als PDF. De handtekening van de verkoper (instelbaar
// onder "Koopovereenkomsten") staat automatisch in het ondertekenvak.

// Volgend overeenkomstnummer in de vorm AGR-KO-2026-0001 (per jaar oplopend).
function volgendOvereenkomstnummer(data) {
  const jaar = new Date().getFullYear();
  const prefix = 'AGR-KO-' + jaar + '-';
  let hoogste = 0;
  (data.overeenkomsten || []).forEach(o => {
    const m = String(o.nummer || '').match(new RegExp('^' + prefix + '(\\d+)$'));
    if (m) hoogste = Math.max(hoogste, parseInt(m[1], 10));
  });
  return prefix + String(hoogste + 1).padStart(4, '0');
}

app.get('/uadmin/overeenkomsten', requireAuth, (req, res) => {
  const data = db.read();
  res.render('admin/overeenkomsten', {
    lijst: data.overeenkomsten || [],
    handtekening: (data.settings || {}).handtekening || '',
    ondertekenaar: (data.settings || {}).ondertekenaar || '',
    active: 'overeenkomsten',
    opgeslagen: req.query.ok
  });
});

app.get('/uadmin/overeenkomsten/nieuw', requireAuth, (req, res) => {
  const data = db.read();
  // Vanuit een trekker of een bestaande factuur gestart? Dan alvast invullen.
  const t = req.query.trekker ? data.tractors.find(x => x.id === req.query.trekker) : null;
  const fac = req.query.factuur ? (data.facturen || []).find(x => x.id === req.query.factuur) : null;
  res.render('admin/overeenkomst-form', {
    overeenkomst: null,
    voorstelNummer: volgendOvereenkomstnummer(data),
    trekker: t || null,
    vanFactuur: fac || null,
    trekkers: data.tractors.filter(x => x.status !== 'verwijderd'),
    bank: (data.settings || {}).bank || {},
    plaatsStandaard: ((data.pages || {}).contact || {}).plaatsnaam === 'Hoofdvestiging' ? 'Utrecht' : (((data.pages || {}).contact || {}).plaatsnaam || 'Utrecht'),
    opgeslagen: false,
    active: 'overeenkomsten'
  });
});

app.get('/uadmin/overeenkomsten/:id', requireAuth, (req, res) => {
  const data = db.read();
  const overeenkomst = (data.overeenkomsten || []).find(o => o.id === req.params.id);
  if (!overeenkomst) return res.redirect('/uadmin/overeenkomsten');
  res.render('admin/overeenkomst-form', {
    overeenkomst,
    voorstelNummer: overeenkomst.nummer,
    trekker: null,
    vanFactuur: null,
    trekkers: data.tractors.filter(x => x.status !== 'verwijderd'),
    bank: (data.settings || {}).bank || {},
    plaatsStandaard: '',
    opgeslagen: req.query.ok,
    active: 'overeenkomsten'
  });
});

// Handtekening van de verkoper instellen (LET OP: vóór de :id?-route,
// anders wordt "handtekening" als overeenkomst-id gelezen).
app.post('/uadmin/overeenkomsten/handtekening', requireAuth, upload.single('handtekening'), verwerkUploads, (req, res) => {
  const data = db.read();
  if (!data.settings) data.settings = {};
  if (req.file) data.settings.handtekening = '/uploads/' + req.file.filename;
  if (req.body.ondertekenaar !== undefined) data.settings.ondertekenaar = (req.body.ondertekenaar || '').trim();
  db.write(data);
  res.redirect('/uadmin/overeenkomsten?ok=1');
});

app.post('/uadmin/overeenkomsten/handtekening/delete', requireAuth, (req, res) => {
  const data = db.read();
  if (data.settings && data.settings.handtekening) {
    const fname = data.settings.handtekening.replace('/uploads/', '');
    const p = path.join(db.DATA_DIR, 'uploads', fname);
    if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
    data.settings.handtekening = '';
    db.write(data);
  }
  res.redirect('/uadmin/overeenkomsten?ok=1');
});

app.post('/uadmin/overeenkomsten/:id?', requireAuth, (req, res) => {
  const data = db.read();
  if (!data.overeenkomsten) data.overeenkomsten = [];
  const b = req.body;

  const omschrijvingen = [].concat(b.regel_omschrijving || []);
  const bedragen = [].concat(b.regel_bedrag || []);
  const regels = omschrijvingen
    .map((om, i) => ({ omschrijving: String(om || '').trim(), bedrag: parseBedrag(bedragen[i]) }))
    .filter(r => r.omschrijving);

  const velden = {
    nummer: (b.nummer || '').trim() || volgendOvereenkomstnummer(data),
    datum: b.datum || new Date().toISOString().slice(0, 10),
    plaats: (b.plaats || '').trim(),
    status: ['concept', 'getekend'].includes(b.status) ? b.status : 'concept',
    klant: {
      naam: (b.klant_naam || '').trim(),
      bedrijf: (b.klant_bedrijf || '').trim(),
      adres: (b.klant_adres || '').trim(),
      postcodePlaats: (b.klant_postcodeplaats || '').trim(),
      land: (b.klant_land || '').trim(),
      email: (b.klant_email || '').trim(),
      telefoon: (b.klant_telefoon || '').trim(),
      kvk: (b.klant_kvk || '').trim(),
      btw: (b.klant_btw || '').trim()
    },
    machine: {
      naam: (b.machine_naam || '').trim(),
      bouwjaar: (b.machine_bouwjaar || '').trim(),
      uren: (b.machine_uren || '').trim(),
      pk: (b.machine_pk || '').trim(),
      transmissie: (b.machine_transmissie || '').trim(),
      serienummer: (b.machine_serienummer || '').trim(),
      kenteken: (b.machine_kenteken || '').trim()
    },
    regels,
    prijsType: (b.prijsType === 'btw') ? 'btw' : 'marge',
    aanbetaling: parseBedrag(b.aanbetaling),
    aanbetalingVervalt: b.aanbetaling_vervalt || '',
    leverdatum: b.leverdatum || '',
    levering: (b.levering || '').trim(),
    // Import uit het buitenland (bijv. Duitsland): voegt het RDW-/kenteken-
    // artikel over het invoertraject toe aan de overeenkomst.
    importLand: (b.import_land || '').trim(),
    bijzonderheden: (b.bijzonderheden || '').trim()
  };

  const bank = {
    iban: (b.bank_iban || '').trim(),
    bic: (b.bank_bic || '').trim(),
    tnv: (b.bank_tnv || '').trim()
  };
  velden.bank = bank;
  if (!data.settings) data.settings = {};
  if (bank.iban || bank.bic || bank.tnv) data.settings.bank = bank;

  let id = req.params.id;
  if (id) {
    const o = data.overeenkomsten.find(x => x.id === id);
    if (!o) return res.redirect('/uadmin/overeenkomsten');
    Object.assign(o, velden);
  } else {
    id = db.id();
    data.overeenkomsten.unshift(Object.assign({ id, createdAt: new Date().toISOString() }, velden));
  }
  db.write(data);
  res.redirect('/uadmin/overeenkomsten/' + id + '?ok=1');
});

app.post('/uadmin/overeenkomsten/:id/delete', requireAuth, (req, res) => {
  const data = db.read();
  data.overeenkomsten = (data.overeenkomsten || []).filter(o => o.id !== req.params.id);
  db.write(data);
  res.redirect('/uadmin/overeenkomsten');
});

// Printweergave: de opgemaakte A4-koopovereenkomst (opslaan als PDF via afdrukken).
app.get('/uadmin/overeenkomsten/:id/print', requireAuth, (req, res) => {
  const data = db.read();
  const overeenkomst = (data.overeenkomsten || []).find(o => o.id === req.params.id);
  if (!overeenkomst) return res.redirect('/uadmin/overeenkomsten');
  res.render('admin/overeenkomst-print', {
    overeenkomst,
    totalen: factuurTotalen(overeenkomst),
    handtekening: (data.settings || {}).handtekening || '',
    ondertekenaar: (data.settings || {}).ondertekenaar || ''
  });
});

// ---- Aanvragen (inbox) ----
app.get('/uadmin/aanvragen', requireAuth, (req, res) => {
  const data = db.read();
  res.render('admin/aanvragen', { lijst: data.inquiries, active: 'aanvragen', mailActief: mail.isActief() });
});

app.post('/uadmin/aanvragen/:id/gelezen', requireAuth, (req, res) => {
  const data = db.read();
  const i = data.inquiries.find(x => x.id === req.params.id);
  if (i) { i.gelezen = true; db.write(data); }
  res.redirect('/uadmin/aanvragen');
});

// Status van een aanvraag bijwerken (nieuw / in behandeling / afgehandeld)
app.post('/uadmin/aanvragen/:id/status', requireAuth, (req, res) => {
  const data = db.read();
  const i = data.inquiries.find(x => x.id === req.params.id);
  const toegestaan = ['nieuw', 'bezig', 'afgehandeld'];
  if (i && toegestaan.includes(req.body.status)) {
    i.status = req.body.status;
    if (req.body.status !== 'nieuw') i.gelezen = true;
    db.write(data);
  }
  res.redirect('/uadmin/aanvragen');
});

// Eigen notitie bij een aanvraag opslaan (bijv. "teruggebeld, wil bedenktijd")
app.post('/uadmin/aanvragen/:id/notitie', requireAuth, (req, res) => {
  const data = db.read();
  const i = data.inquiries.find(x => x.id === req.params.id);
  if (i) {
    i.notitie = (req.body.notitie || '').trim();
    db.write(data);
  }
  res.redirect('/uadmin/aanvragen');
});

app.post('/uadmin/aanvragen/:id/delete', requireAuth, (req, res) => {
  const data = db.read();
  data.inquiries = data.inquiries.filter(x => x.id !== req.params.id);
  db.write(data);
  res.redirect('/uadmin/aanvragen');
});

// ---- Wachtwoord wijzigen ----
app.get('/uadmin/account', requireAuth, (req, res) => {
  const data = db.read();
  res.render('admin/account', {
    active: 'account',
    melding: req.query.m,
    mailFout: req.query.fout || '',
    smtp: (data.settings || {}).smtp || {},
    mailViaOmgeving: mail.viaOmgeving(),
    mailActief: mail.isActief()
  });
});

// E-mailmeldingen: SMTP-instellingen opslaan vanuit het beheer
app.post('/uadmin/instellingen/mail', requireAuth, (req, res) => {
  const data = db.read();
  if (!data.settings) data.settings = {};
  const oud = data.settings.smtp || {};
  data.settings.smtp = {
    host: (req.body.host || '').trim(),
    port: parseInt(req.body.port) || 465,
    user: (req.body.user || '').trim(),
    // Wachtwoordveld leeg gelaten? Dan het eerder opgeslagen wachtwoord behouden.
    pass: req.body.pass ? req.body.pass : (oud.pass || ''),
    naar: (req.body.naar || '').trim()
  };
  db.write(data);
  res.redirect('/uadmin/account?m=mailopgeslagen');
});

// E-mailmeldingen: testmail versturen en het resultaat tonen
app.post('/uadmin/instellingen/mail/test', requireAuth, async (req, res) => {
  const resultaat = await mail.stuurTest();
  if (resultaat.ok) return res.redirect('/uadmin/account?m=mailok');
  res.redirect('/uadmin/account?m=mailfout&fout=' + encodeURIComponent(resultaat.fout || 'Onbekende fout'));
});

app.post('/uadmin/account', requireAuth, (req, res) => {
  const data = db.read();
  const u = data.users.find(x => x.id === req.session.user.id);
  if (!u || !bcrypt.compareSync(req.body.huidig || '', u.passwordHash)) {
    return res.redirect('/uadmin/account?m=fout');
  }
  if ((req.body.nieuw || '').length < 5) {
    return res.redirect('/uadmin/account?m=kort');
  }
  u.passwordHash = bcrypt.hashSync(req.body.nieuw, 10);
  db.write(data);
  res.redirect('/uadmin/account?m=ok');
});

// 404
app.use((req, res) => res.status(404).render('404'));

// Centrale foutafhandeling — nette melding i.p.v. een ruwe crash.
app.use((err, req, res, next) => {
  const isUpload = err instanceof multer.MulterError || /afbeelding/i.test(err.message || '');
  let melding = 'Er ging iets mis. Probeer het later opnieuw.';
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    melding = 'De foto is te groot (maximaal 12 MB per foto). Kies een kleiner bestand.';
  } else if (err instanceof multer.MulterError && (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT')) {
    const max = req.path === '/inruil' ? INRUIL_MAX_FOTOS : MAX_FOTOS_PER_KEER;
    melding = `Je kunt maximaal ${max} foto's in één keer uploaden. Selecteer er iets minder en probeer het opnieuw.`;
  } else if (isUpload) {
    melding = err.message;
  } else {
    console.error(err);
  }
  const status = isUpload ? 400 : 500;
  // Ingelogde beheerders sturen we terug naar de vorige beheerpagina met de melding.
  if (isUpload && req.session && req.session.user) {
    return res.status(status).render('500', { melding, terug: req.get('Referer') || '/uadmin' });
  }
  res.status(status).render('500', { melding, terug: '/' });
});

app.listen(PORT, () => {
  console.log(`\n  Agroria draait op  http://localhost:${PORT}`);
  console.log(`  Beheerpaneel op    http://localhost:${PORT}/uadmin\n`);
  // Afgebroken of ontbrekende trekker-video's rustig op de achtergrond bijmaken.
  video.herstelBijOpstarten();
});
