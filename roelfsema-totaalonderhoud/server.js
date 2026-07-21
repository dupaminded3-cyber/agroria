const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sanitizeHtml = require('sanitize-html');

const { readDb, writeDb, UPLOADS_DIR, DIENSTEN, PERIODES, STIJLEN, standaardStats, nieuwId } = require('./lib/db');
const { offerteUpload, enkeleAfbeeldingUpload, MAX_FOTOS } = require('./lib/upload');
const {
  slaOffertefotoOp,
  verwijderAanvraagFotos,
  slaSiteAfbeeldingOp,
  slaProjectAfbeeldingOp,
  verwijderUpload,
} = require('./lib/imaging');

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTIE = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db0 = readDb();
app.use(
  session({
    name: 'roelfsema.sid',
    secret: db0.instellingen.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: PRODUCTIE,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

const STIJL_IDS = STIJLEN.map((s) => s.id);
const STANDAARD_STIJL = '3';

function parseCookieStijl(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)stijl_voorbeeld=([^;]+)/);
  if (match && STIJL_IDS.includes(match[1])) return match[1];
  return null;
}

// De echte, definitieve stijl van de site staat in de database en wordt
// ingesteld via /uadmin/ontwerp. Met ?stijl=1/2/3 kan die tijdelijk (per
// browser, een paar uur) worden overschreven om te kunnen voorproeven zonder
// meteen de site voor iedereen te wijzigen — zie /ontwerpen.
app.use((req, res, next) => {
  const db = readDb();
  res.locals.site = db.instellingen.site;
  res.locals.diensten = DIENSTEN;
  res.locals.huidigPad = req.path;
  res.locals.ingelogd = !!(req.session && req.session.ingelogd);
  res.locals.extraJs = [];
  res.locals.stijlen = STIJLEN;

  const queryStijl = String(req.query.stijl || '');
  if (queryStijl === 'standaard') {
    res.clearCookie('stijl_voorbeeld');
    res.locals.stijl = db.instellingen.site.stijl || STANDAARD_STIJL;
    res.locals.stijlVoorbeeld = false;
  } else if (STIJL_IDS.includes(queryStijl)) {
    res.cookie('stijl_voorbeeld', queryStijl, { maxAge: 1000 * 60 * 60 * 6 });
    res.locals.stijl = queryStijl;
    res.locals.stijlVoorbeeld = true;
  } else {
    const voorbeeldStijl = parseCookieStijl(req);
    res.locals.stijl = voorbeeldStijl || db.instellingen.site.stijl || STANDAARD_STIJL;
    res.locals.stijlVoorbeeld = !!voorbeeldStijl;
  }
  next();
});

function vereistLogin(req, res, next) {
  if (req.session && req.session.ingelogd) return next();
  return res.redirect('/uadmin/login');
}

function schoon(tekst, maxLengte = 5000) {
  if (!tekst) return '';
  return sanitizeHtml(String(tekst).slice(0, maxLengte), { allowedTags: [], allowedAttributes: {} }).trim();
}

// ---------- Openbare pagina's ----------

app.get('/', (req, res) => {
  const db = readDb();
  res.render('home', {
    titel: null,
    projecten: db.projecten.slice(0, 3),
    heeftProjecten: db.projecten.length > 0,
    reviews: db.reviews.slice(0, 6),
    faq: db.faq.slice(0, 5),
    stats: db.instellingen.site.stats || standaardStats(),
  });
});

app.get('/diensten', (req, res) => {
  res.render('diensten', { titel: 'Diensten' });
});

app.get('/projecten', (req, res) => {
  const db = readDb();
  res.render('projecten', { titel: 'Projecten', projecten: db.projecten });
});

app.get('/over-ons', (req, res) => {
  const db = readDb();
  res.render('over-ons', { titel: 'Over ons', reviews: db.reviews.slice(0, 6), faq: db.faq });
});

app.get('/ontwerpen', (req, res) => {
  res.render('ontwerpen', { titel: 'Ontwerprichtingen', layoutMinimal: true });
});

app.get('/contact', (req, res) => {
  res.render('contact', { titel: 'Contact', verzonden: false });
});

app.post('/contact', (req, res) => {
  const db = readDb();
  const bericht = {
    id: crypto.randomBytes(6).toString('hex'),
    type: 'contact',
    status: 'nieuw',
    createdAt: new Date().toISOString(),
    naam: schoon(req.body.naam, 120),
    email: schoon(req.body.email, 160),
    telefoon: schoon(req.body.telefoon, 60),
    omschrijving: schoon(req.body.bericht, 4000),
    fotos: [],
    notitie: '',
  };
  if (!bericht.naam || !bericht.email || !bericht.omschrijving) {
    return res.render('contact', { titel: 'Contact', verzonden: false, fout: 'Vul in ieder geval uw naam, e-mailadres en bericht in.' });
  }
  db.aanvragen.unshift(bericht);
  writeDb(db);
  res.render('contact', { titel: 'Contact', verzonden: true });
});

app.get('/offerte-aanvragen', (req, res) => {
  res.render('offerte', { titel: 'Offerte aanvragen', fout: null, ingevuld: {}, maxFotos: MAX_FOTOS, periodes: PERIODES });
});

app.post('/offerte-aanvragen', (req, res) => {
  offerteUpload.array('fotos', MAX_FOTOS)(req, res, async (err) => {
    if (err) {
      let fout = 'Er ging iets mis bij het uploaden van uw foto\'s.';
      if (err.code === 'LIMIT_FILE_COUNT') fout = `U kunt maximaal ${MAX_FOTOS} foto's toevoegen.`;
      if (err.code === 'LIMIT_FILE_SIZE') fout = 'Eén van de foto\'s is te groot (max. 12 MB per foto).';
      if (err.message && err.message.includes('Alleen foto')) fout = err.message;
      return res.render('offerte', {
        titel: 'Offerte aanvragen',
        fout,
        ingevuld: req.body,
        maxFotos: MAX_FOTOS,
        periodes: PERIODES,
      });
    }

    const verplicht = ['voornaam', 'achternaam', 'email', 'telefoon', 'omschrijving'];
    const ontbreekt = verplicht.some((veld) => !req.body[veld] || !String(req.body[veld]).trim());
    if (ontbreekt || !req.body.akkoord) {
      return res.render('offerte', {
        titel: 'Offerte aanvragen',
        fout: 'Vul de verplichte velden in en ga akkoord met de privacyverklaring.',
        ingevuld: req.body,
        maxFotos: MAX_FOTOS,
        periodes: PERIODES,
      });
    }

    const id = crypto.randomBytes(6).toString('hex');
    let fotos = [];
    try {
      if (req.files && req.files.length) {
        fotos = await Promise.all(req.files.map((f) => slaOffertefotoOp(f.buffer, id)));
      }
    } catch (fotoErr) {
      console.error('Fout bij verwerken foto\'s:', fotoErr);
    }

    const db = readDb();
    const aanvraag = {
      id,
      type: 'offerte',
      status: 'nieuw',
      createdAt: new Date().toISOString(),
      voornaam: schoon(req.body.voornaam, 80),
      achternaam: schoon(req.body.achternaam, 80),
      email: schoon(req.body.email, 160),
      telefoon: schoon(req.body.telefoon, 60),
      bedrijfsnaam: schoon(req.body.bedrijfsnaam, 160),
      adres: schoon(req.body.adres, 200),
      postcode: schoon(req.body.postcode, 20),
      plaats: schoon(req.body.plaats, 120),
      dienst: schoon(req.body.dienst, 80),
      periode: schoon(req.body.periode, 80),
      omschrijving: schoon(req.body.omschrijving, 4000),
      fotos,
      notitie: '',
    };
    db.aanvragen.unshift(aanvraag);
    writeDb(db);

    res.redirect('/bedankt');
  });
});

app.get('/bedankt', (req, res) => {
  res.render('bedankt', { titel: 'Bedankt' });
});

// ---------- SEO ----------

function basisUrl(req) {
  if (SITE_URL) return SITE_URL;
  return `${req.protocol}://${req.get('host')}`;
}

app.get('/sitemap.xml', (req, res) => {
  const basis = basisUrl(req);
  const paden = ['/', '/diensten', '/projecten', '/over-ons', '/contact', '/offerte-aanvragen'];
  const items = paden
    .map((p) => `  <url>\n    <loc>${basis}${p}</loc>\n    <changefreq>monthly</changefreq>\n  </url>`)
    .join('\n');
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`
  );
});

app.get('/robots.txt', (req, res) => {
  const basis = basisUrl(req);
  res.type('text/plain').send(
    `User-agent: *\nDisallow: /uadmin\n\nSitemap: ${basis}/sitemap.xml\n`
  );
});

// ---------- Beheerpaneel (uadmin) ----------

app.get('/uadmin/login', (req, res) => {
  if (req.session && req.session.ingelogd) return res.redirect('/uadmin');
  res.render('admin/login', { titel: 'Inloggen', fout: null, layoutAdmin: true });
});

app.post('/uadmin/login', (req, res) => {
  const db = readDb();
  const { gebruikersnaam, wachtwoord } = req.body;
  const klopt =
    gebruikersnaam === db.instellingen.gebruikersnaam &&
    db.instellingen.wachtwoordHash &&
    bcrypt.compareSync(wachtwoord || '', db.instellingen.wachtwoordHash);

  if (!klopt) {
    return res.render('admin/login', { titel: 'Inloggen', fout: 'Onjuiste gebruikersnaam of wachtwoord.', layoutAdmin: true });
  }
  req.session.ingelogd = true;
  res.redirect('/uadmin');
});

app.post('/uadmin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/uadmin/login'));
});

app.get('/uadmin', vereistLogin, (req, res) => {
  const db = readDb();
  const aanvragen = db.aanvragen;
  res.render('admin/dashboard', {
    titel: 'Overzicht',
    layoutAdmin: true,
    totaal: aanvragen.length,
    nieuw: aanvragen.filter((a) => a.status === 'nieuw').length,
    inBehandeling: aanvragen.filter((a) => a.status === 'in behandeling').length,
    laatste: aanvragen.slice(0, 6),
  });
});

app.get('/uadmin/aanvragen', vereistLogin, (req, res) => {
  const db = readDb();
  let aanvragen = db.aanvragen;
  const filter = req.query.status;
  if (filter && filter !== 'alle') {
    aanvragen = aanvragen.filter((a) => a.status === filter);
  }
  res.render('admin/aanvragen', {
    titel: 'Aanvragen',
    layoutAdmin: true,
    aanvragen,
    filter: filter || 'alle',
  });
});

app.get('/uadmin/aanvragen/:id', vereistLogin, (req, res) => {
  const db = readDb();
  const aanvraag = db.aanvragen.find((a) => a.id === req.params.id);
  if (!aanvraag) return res.status(404).send('Niet gevonden');
  res.render('admin/aanvraag-detail', { titel: 'Aanvraag', layoutAdmin: true, aanvraag });
});

app.post('/uadmin/aanvragen/:id/status', vereistLogin, (req, res) => {
  const db = readDb();
  const aanvraag = db.aanvragen.find((a) => a.id === req.params.id);
  if (aanvraag) {
    aanvraag.status = schoon(req.body.status, 40) || aanvraag.status;
    writeDb(db);
  }
  res.redirect(`/uadmin/aanvragen/${req.params.id}`);
});

app.post('/uadmin/aanvragen/:id/notitie', vereistLogin, (req, res) => {
  const db = readDb();
  const aanvraag = db.aanvragen.find((a) => a.id === req.params.id);
  if (aanvraag) {
    aanvraag.notitie = schoon(req.body.notitie, 4000);
    writeDb(db);
  }
  res.redirect(`/uadmin/aanvragen/${req.params.id}`);
});

app.post('/uadmin/aanvragen/:id/verwijderen', vereistLogin, async (req, res) => {
  const db = readDb();
  const index = db.aanvragen.findIndex((a) => a.id === req.params.id);
  if (index !== -1) {
    await verwijderAanvraagFotos(req.params.id);
    db.aanvragen.splice(index, 1);
    writeDb(db);
  }
  res.redirect('/uadmin/aanvragen');
});

app.get('/uadmin/ontwerp', vereistLogin, (req, res) => {
  const db = readDb();
  res.render('admin/ontwerp', {
    titel: 'Ontwerp / stijl',
    layoutAdmin: true,
    stijlen: STIJLEN,
    actieveStijl: db.instellingen.site.stijl || STANDAARD_STIJL,
    opgeslagen: false,
  });
});

app.post('/uadmin/ontwerp', vereistLogin, (req, res) => {
  const db = readDb();
  if (STIJL_IDS.includes(String(req.body.stijl))) {
    db.instellingen.site.stijl = String(req.body.stijl);
    writeDb(db);
  }
  res.render('admin/ontwerp', {
    titel: 'Ontwerp / stijl',
    layoutAdmin: true,
    stijlen: STIJLEN,
    actieveStijl: db.instellingen.site.stijl || STANDAARD_STIJL,
    opgeslagen: true,
  });
});

app.get('/uadmin/paginas', vereistLogin, (req, res) => {
  res.render('admin/paginas', { titel: "Pagina's & foto's", layoutAdmin: true, opgeslagen: false });
});

app.post('/uadmin/paginas', vereistLogin, (req, res) => {
  const db = readDb();
  db.instellingen.site = {
    ...db.instellingen.site,
    heroTitel: schoon(req.body.heroTitel, 160) || db.instellingen.site.heroTitel,
    heroSubtitel: schoon(req.body.heroSubtitel, 600) || db.instellingen.site.heroSubtitel,
    overOns: schoon(req.body.overOns, 4000) || db.instellingen.site.overOns,
    telefoon: schoon(req.body.telefoon, 60),
    whatsapp: schoon(req.body.whatsapp, 60),
    email: schoon(req.body.email, 160),
    adres: schoon(req.body.adres, 200),
    werkgebied: schoon(req.body.werkgebied, 200),
    kvk: schoon(req.body.kvk, 40),
    btw: schoon(req.body.btw, 40),
  };

  // Cijfers/statistieken (max 4)
  const waarden = [].concat(req.body.statWaarde || []);
  const labels = [].concat(req.body.statLabel || []);
  const stats = [];
  for (let i = 0; i < Math.min(waarden.length, 4); i++) {
    const waarde = schoon(waarden[i], 20);
    const label = schoon(labels[i], 120);
    if (waarde || label) stats.push({ id: `stat${i + 1}`, waarde, label });
  }
  if (stats.length) db.instellingen.site.stats = stats;

  writeDb(db);
  res.render('admin/paginas', { titel: "Pagina's & foto's", layoutAdmin: true, opgeslagen: true });
});

app.post('/uadmin/paginas/logo', vereistLogin, (req, res) => {
  enkeleAfbeeldingUpload.single('logo')(req, res, async (err) => {
    if (!err && req.file) {
      const db = readDb();
      db.instellingen.site.logo = await slaSiteAfbeeldingOp(req.file.buffer, 'logo');
      writeDb(db);
    }
    res.redirect('/uadmin/paginas');
  });
});

app.post('/uadmin/paginas/hero', vereistLogin, (req, res) => {
  enkeleAfbeeldingUpload.single('hero')(req, res, async (err) => {
    if (!err && req.file) {
      const db = readDb();
      db.instellingen.site.heroAfbeelding = await slaSiteAfbeeldingOp(req.file.buffer, 'hero');
      writeDb(db);
    }
    res.redirect('/uadmin/paginas');
  });
});

// ---------- Beheer: Projecten ----------

app.get('/uadmin/projecten', vereistLogin, (req, res) => {
  const db = readDb();
  res.render('admin/projecten', { titel: 'Projecten', layoutAdmin: true, projecten: db.projecten });
});

app.get('/uadmin/projecten/nieuw', vereistLogin, (req, res) => {
  res.render('admin/project-form', { titel: 'Nieuw project', layoutAdmin: true, project: null });
});

app.post('/uadmin/projecten/nieuw', vereistLogin, (req, res) => {
  offerteUpload.fields([
    { name: 'voorFoto', maxCount: 1 },
    { name: 'naFoto', maxCount: 1 },
  ])(req, res, async (err) => {
    const db = readDb();
    const project = {
      id: nieuwId(),
      titel: schoon(req.body.titel, 140) || 'Naamloos project',
      categorie: schoon(req.body.categorie, 80),
      omschrijving: schoon(req.body.omschrijving, 2000),
      voorFoto: null,
      naFoto: null,
      createdAt: new Date().toISOString(),
    };
    try {
      if (req.files && req.files.voorFoto) project.voorFoto = await slaProjectAfbeeldingOp(req.files.voorFoto[0].buffer);
      if (req.files && req.files.naFoto) project.naFoto = await slaProjectAfbeeldingOp(req.files.naFoto[0].buffer);
    } catch (e) {
      console.error('Projectfoto fout:', e);
    }
    db.projecten.unshift(project);
    writeDb(db);
    res.redirect('/uadmin/projecten');
  });
});

app.get('/uadmin/projecten/:id', vereistLogin, (req, res) => {
  const db = readDb();
  const project = db.projecten.find((p) => p.id === req.params.id);
  if (!project) return res.redirect('/uadmin/projecten');
  res.render('admin/project-form', { titel: 'Project bewerken', layoutAdmin: true, project });
});

app.post('/uadmin/projecten/:id', vereistLogin, (req, res) => {
  offerteUpload.fields([
    { name: 'voorFoto', maxCount: 1 },
    { name: 'naFoto', maxCount: 1 },
  ])(req, res, async (err) => {
    const db = readDb();
    const project = db.projecten.find((p) => p.id === req.params.id);
    if (!project) return res.redirect('/uadmin/projecten');
    project.titel = schoon(req.body.titel, 140) || project.titel;
    project.categorie = schoon(req.body.categorie, 80);
    project.omschrijving = schoon(req.body.omschrijving, 2000);
    try {
      if (req.files && req.files.voorFoto) {
        verwijderUpload(project.voorFoto);
        project.voorFoto = await slaProjectAfbeeldingOp(req.files.voorFoto[0].buffer);
      }
      if (req.files && req.files.naFoto) {
        verwijderUpload(project.naFoto);
        project.naFoto = await slaProjectAfbeeldingOp(req.files.naFoto[0].buffer);
      }
    } catch (e) {
      console.error('Projectfoto fout:', e);
    }
    writeDb(db);
    res.redirect('/uadmin/projecten');
  });
});

app.post('/uadmin/projecten/:id/verwijderen', vereistLogin, (req, res) => {
  const db = readDb();
  const index = db.projecten.findIndex((p) => p.id === req.params.id);
  if (index !== -1) {
    verwijderUpload(db.projecten[index].voorFoto);
    verwijderUpload(db.projecten[index].naFoto);
    db.projecten.splice(index, 1);
    writeDb(db);
  }
  res.redirect('/uadmin/projecten');
});

// ---------- Beheer: Reviews ----------

app.get('/uadmin/reviews', vereistLogin, (req, res) => {
  const db = readDb();
  res.render('admin/reviews', { titel: 'Reviews', layoutAdmin: true, reviews: db.reviews });
});

app.post('/uadmin/reviews', vereistLogin, (req, res) => {
  const db = readDb();
  const review = {
    id: nieuwId(),
    naam: schoon(req.body.naam, 120) || 'Anoniem',
    functie: schoon(req.body.functie, 140),
    tekst: schoon(req.body.tekst, 1200),
    sterren: Math.min(5, Math.max(1, parseInt(req.body.sterren, 10) || 5)),
  };
  if (review.tekst) {
    db.reviews.unshift(review);
    writeDb(db);
  }
  res.redirect('/uadmin/reviews');
});

app.post('/uadmin/reviews/:id/verwijderen', vereistLogin, (req, res) => {
  const db = readDb();
  const index = db.reviews.findIndex((r) => r.id === req.params.id);
  if (index !== -1) {
    db.reviews.splice(index, 1);
    writeDb(db);
  }
  res.redirect('/uadmin/reviews');
});

// ---------- Beheer: FAQ ----------

app.get('/uadmin/faq', vereistLogin, (req, res) => {
  const db = readDb();
  res.render('admin/faq', { titel: 'Veelgestelde vragen', layoutAdmin: true, faq: db.faq });
});

app.post('/uadmin/faq', vereistLogin, (req, res) => {
  const db = readDb();
  const item = {
    id: nieuwId(),
    vraag: schoon(req.body.vraag, 240),
    antwoord: schoon(req.body.antwoord, 2000),
  };
  if (item.vraag && item.antwoord) {
    db.faq.push(item);
    writeDb(db);
  }
  res.redirect('/uadmin/faq');
});

app.post('/uadmin/faq/:id/verwijderen', vereistLogin, (req, res) => {
  const db = readDb();
  const index = db.faq.findIndex((f) => f.id === req.params.id);
  if (index !== -1) {
    db.faq.splice(index, 1);
    writeDb(db);
  }
  res.redirect('/uadmin/faq');
});

app.get('/uadmin/account', vereistLogin, (req, res) => {
  res.render('admin/account', { titel: 'Account', layoutAdmin: true, fout: null, gelukt: false });
});

app.post('/uadmin/account', vereistLogin, (req, res) => {
  const db = readDb();
  const { huidig, nieuw, nieuwHerhaal } = req.body;
  const klopt = bcrypt.compareSync(huidig || '', db.instellingen.wachtwoordHash);
  if (!klopt) {
    return res.render('admin/account', { titel: 'Account', layoutAdmin: true, fout: 'Huidig wachtwoord klopt niet.', gelukt: false });
  }
  if (!nieuw || nieuw.length < 6) {
    return res.render('admin/account', { titel: 'Account', layoutAdmin: true, fout: 'Nieuw wachtwoord moet minimaal 6 tekens zijn.', gelukt: false });
  }
  if (nieuw !== nieuwHerhaal) {
    return res.render('admin/account', { titel: 'Account', layoutAdmin: true, fout: 'De wachtwoorden komen niet overeen.', gelukt: false });
  }
  db.instellingen.wachtwoordHash = bcrypt.hashSync(nieuw, 10);
  writeDb(db);
  res.render('admin/account', { titel: 'Account', layoutAdmin: true, fout: null, gelukt: true });
});

// ---------- Foutafhandeling ----------

app.use((req, res) => {
  res.status(404).render('404', { titel: 'Pagina niet gevonden' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('500', { titel: 'Er ging iets mis' });
});

app.listen(PORT, () => {
  console.log(`Roelfsema Totaalonderhoud draait op http://localhost:${PORT}`);
  console.log(`Beheerpaneel: http://localhost:${PORT}/uadmin`);
});
