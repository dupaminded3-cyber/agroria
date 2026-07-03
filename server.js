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
// We houden de foto eerst in het geheugen en optimaliseren hem daarna met sharp:
// verkleinen naar max. 1600px breed en comprimeren naar webp. Dat scheelt fors
// in laadtijd — belangrijk voor het high-end gevoel van de site.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB per originele foto
  fileFilter: (req, file, cb) => {
    const ok = /jpe?g|png|webp|gif/i.test(file.mimetype);
    cb(ok ? null : new Error('Alleen afbeeldingen (JPG, PNG, WEBP of GIF) zijn toegestaan.'), ok);
  }
});

const UPLOAD_DIR = path.join(db.DATA_DIR, 'uploads');

async function bewaarFoto(file) {
  const naam = db.id() + '.webp';
  const doel = path.join(UPLOAD_DIR, naam);
  await sharp(file.buffer)
    .rotate() // corrigeert stand op basis van EXIF
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(doel);
  return naam;
}

// Middleware: verwerkt alle geüploade foto's (zowel .array als .fields) en zet
// per bestand file.filename klaar, precies zoals de rest van de code verwacht.
function verwerkUploads(req, res, next) {
  let files = [];
  if (Array.isArray(req.files)) files = req.files;
  else if (req.files) Object.keys(req.files).forEach(k => { files = files.concat(req.files[k]); });
  else if (req.file) files = [req.file];
  if (!files.length) return next();
  Promise.all(files.map(async f => { f.filename = await bewaarFoto(f); }))
    .then(() => next())
    .catch(next);
}

// --- Basis-instellingen ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
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
app.locals.firstFoto = (t) => (t.fotos && t.fotos[0]) ? '/uploads/' + t.fotos[0] : null;

// Maakt sessie-info, contactgegevens en het logo beschikbaar in elke view
app.use((req, res, next) => {
  const data = db.read();
  res.locals.user = req.session.user || null;
  res.locals.contact = (data.pages || {}).contact || {};
  res.locals.logo = (data.settings || {}).logo || '';
  res.locals.favicon = (data.settings || {}).favicon || '';
  res.locals.persistent = db.persistent;
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
app.get('/', (req, res) => {
  const data = db.read();
  const uitgelicht = data.tractors
    .filter(t => t.uitgelicht)
    .slice(0, 4);
  res.render('home', { page: data.pages.home, uitgelicht });
});

app.get('/aanbod', (req, res) => {
  const data = db.read();
  let lijst = data.tractors.filter(t => t.status !== 'verwijderd');
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
  const merken = [...new Set(data.tractors.map(t => t.merk))].sort();
  res.render('aanbod', { lijst, merken, filter: { merk, q, sort }, page: (data.pages.aanbod || {}) });
});

app.get('/trekker/:id', (req, res) => {
  const data = db.read();
  const trekker = data.tractors.find(t => t.id === req.params.id);
  if (!trekker) return res.status(404).render('404');
  const meer = data.tractors
    .filter(t => t.id !== trekker.id && t.status !== 'verkocht' && t.status !== 'verwijderd')
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
    .filter(t => t.status !== 'verwijderd')
    .forEach(t => urls.push({ loc: SITE_URL + '/trekker/' + t.id }));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${u.loc}</loc></url>`).join('\n') +
    `\n</urlset>\n`;
  res.type('application/xml').send(xml);
});

// Aanvraag / vraag versturen (komt binnen in uadmin)
app.post('/aanvraag', (req, res) => {
  const data = db.read();
  data.inquiries.unshift({
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
  });
  db.write(data);
  res.render('bedankt', { soort: 'aanvraag' });
});

// Inruil-taxatie aanvragen (komt binnen in uadmin)
app.post('/inruil', (req, res) => {
  const data = db.read();
  data.inquiries.unshift({
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
    gelezen: false,
    createdAt: new Date().toISOString()
  });
  db.write(data);
  res.render('bedankt', { soort: 'inruil' });
});

// Bestelpagina voor een specifieke trekker
app.get('/bestellen/:id', (req, res) => {
  const data = db.read();
  const trekker = data.tractors.find(t => t.id === req.params.id);
  if (!trekker) return res.status(404).render('404');
  if (trekker.status === 'verkocht') return res.redirect('/trekker/' + trekker.id);
  res.render('bestellen', { trekker });
});

// Bestelling plaatsen (komt binnen in uadmin)
app.post('/bestelling', (req, res) => {
  const data = db.read();
  const t = data.tractors.find(x => x.id === req.body.trekkerId);
  const naamTrekker = t ? `${t.merk} ${t.model}` : (req.body.trekker || 'Trekker');
  data.inquiries.unshift({
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
  });
  db.write(data);
  res.render('besteld', { trekker: naamTrekker, prijs: t ? t.prijs : (parseInt(req.body.prijs) || 0) });
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
  const stats = {
    trekkers: data.tractors.filter(t => t.status !== 'verwijderd').length,
    beschikbaar: data.tractors.filter(t => t.status === 'beschikbaar').length,
    nieuweAanvragen: data.inquiries.filter(i => !i.gelezen).length,
    totaalAanvragen: data.inquiries.length
  };
  const laatste = data.inquiries.slice(0, 5);
  res.render('admin/dashboard', { stats, laatste, active: 'dashboard' });
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

app.post('/uadmin/trekkers/:id?', requireAuth, upload.array('fotos', 12), verwerkUploads, (req, res) => {
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
    voorlader: b.voorlader === 'on' || b.voorlader === 'true',
    categorie: b.categorie || 'Trekker',
    status: b.status || 'beschikbaar',
    uitgelicht: b.uitgelicht === 'on' || b.uitgelicht === 'true',
    omschrijving: (b.omschrijving || '').trim()
  };
  const nieuweFotos = (req.files || []).map(f => f.filename);

  if (req.params.id) {
    const t = data.tractors.find(x => x.id === req.params.id);
    if (t) {
      Object.assign(t, velden);
      t.fotos = (t.fotos || []).concat(nieuweFotos);
    }
  } else {
    data.tractors.unshift(Object.assign({
      id: db.id(), fotos: nieuweFotos, createdAt: new Date().toISOString()
    }, velden));
  }
  db.write(data);
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
  }
  res.redirect('/uadmin/trekkers/' + req.params.id);
});

app.post('/uadmin/trekkers/:id/delete', requireAuth, (req, res) => {
  const data = db.read();
  data.tractors = data.tractors.filter(t => t.id !== req.params.id);
  db.write(data);
  res.redirect('/uadmin/trekkers');
});

// ---- Pagina-afbeeldingen & teksten beheren ----
app.get('/uadmin/paginas', requireAuth, (req, res) => {
  const data = db.read();
  res.render('admin/paginas', { pages: data.pages, settings: data.settings || {}, active: 'paginas', opgeslagen: req.query.ok });
});

const paginaUpload = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
  { name: 'home_heroFoto', maxCount: 1 },
  { name: 'home_introFoto', maxCount: 1 },
  { name: 'home_garantieFoto', maxCount: 1 },
  { name: 'home_nieuwFoto', maxCount: 1 },
  { name: 'home_closerFoto', maxCount: 1 },
  { name: 'inruil_foto', maxCount: 1 },
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
  set(data.settings, 'merken', b.settings_merken);
  set(data.pages.home, 'heroTitel', b.home_heroTitel);
  set(data.pages.home, 'heroTekst', b.home_heroTekst);
  if (f.home_heroFoto) data.pages.home.heroFoto = '/uploads/' + f.home_heroFoto[0].filename;
  if (f.home_introFoto) data.pages.home.introFoto = '/uploads/' + f.home_introFoto[0].filename;
  if (f.home_garantieFoto) data.pages.home.garantieFoto = '/uploads/' + f.home_garantieFoto[0].filename;
  if (f.home_nieuwFoto) data.pages.home.nieuwFoto = '/uploads/' + f.home_nieuwFoto[0].filename;
  if (f.home_closerFoto) data.pages.home.closerFoto = '/uploads/' + f.home_closerFoto[0].filename;
  set(data.pages.inruil, 'titel', b.inruil_titel);
  set(data.pages.inruil, 'tekst', b.inruil_tekst);
  if (f.inruil_foto) data.pages.inruil.foto = '/uploads/' + f.inruil_foto[0].filename;
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

// Verwijder één losse pagina-foto (bv. home.introFoto) -> terug naar illustratie
app.post('/uadmin/paginas/foto/delete', requireAuth, (req, res) => {
  const toegestaan = ['home.heroFoto','home.introFoto','home.garantieFoto','home.nieuwFoto','home.closerFoto','inruil.foto','overons.foto','overons.foto2','selectie.foto1','selectie.foto2','selectie.foto3','aanbod.foto1','aanbod.foto2'];
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

// ---- Aanvragen (inbox) ----
app.get('/uadmin/aanvragen', requireAuth, (req, res) => {
  const data = db.read();
  res.render('admin/aanvragen', { lijst: data.inquiries, active: 'aanvragen' });
});

app.post('/uadmin/aanvragen/:id/gelezen', requireAuth, (req, res) => {
  const data = db.read();
  const i = data.inquiries.find(x => x.id === req.params.id);
  if (i) { i.gelezen = true; db.write(data); }
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
  res.render('admin/account', { active: 'account', melding: req.query.m });
});

app.post('/uadmin/account', requireAuth, (req, res) => {
  const data = db.read();
  const u = data.users.find(x => x.id === req.session.user.id);
  if (!u || !bcrypt.compareSync(req.body.huidig || '', u.passwordHash)) {
    return res.render('admin/account', { active: 'account', melding: 'fout' });
  }
  if ((req.body.nieuw || '').length < 5) {
    return res.render('admin/account', { active: 'account', melding: 'kort' });
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
});
