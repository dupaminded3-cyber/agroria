const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sanitizeHtml = require('sanitize-html');

const { readDb, writeDb, UPLOADS_DIR, DIENSTEN, PERIODES, STIJLEN } = require('./lib/db');
const { offerteUpload, enkeleAfbeeldingUpload, MAX_FOTOS } = require('./lib/upload');
const { slaOffertefotoOp, verwijderAanvraagFotos, slaSiteAfbeeldingOp } = require('./lib/imaging');

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
  res.render('home', { titel: null });
});

app.get('/diensten', (req, res) => {
  res.render('diensten', { titel: 'Diensten' });
});

app.get('/over-ons', (req, res) => {
  res.render('over-ons', { titel: 'Over ons' });
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
    email: schoon(req.body.email, 160),
    adres: schoon(req.body.adres, 200),
    kvk: schoon(req.body.kvk, 40),
    btw: schoon(req.body.btw, 40),
  };
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
