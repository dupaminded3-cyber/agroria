/*
 * E-mailmeldingen bij nieuwe aanvragen (vraag, inruil, bestelling).
 *
 * De verzendgegevens (SMTP — van je eigen mailbox, bijv. bij Strato) stel je
 * gewoon in via het beheer: /uadmin → Account → E-mailmeldingen. Daar zit ook
 * een testknop. Gevorderden kunnen ze ook via omgevingsvariabelen zetten
 * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_NAAR) — die hebben dan
 * voorrang op de beheer-instellingen.
 *
 * Zijn er geen gegevens ingesteld, dan doet de site het gewoon — er worden
 * dan simpelweg geen mails gestuurd (en het beheer toont een hint).
 */
const nodemailer = require('nodemailer');
const db = require('./db');

function viaOmgeving() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function config() {
  const s = (db.read().settings || {}).smtp || {};
  const host = (process.env.SMTP_HOST || s.host || '').trim();
  const port = parseInt(process.env.SMTP_PORT || s.port) || 465;
  const user = (process.env.SMTP_USER || s.user || '').trim();
  const pass = process.env.SMTP_PASS || s.pass || '';
  const naar = (process.env.MAIL_NAAR || s.naar || '').trim() || user;
  return { host, port, user, pass, naar };
}

function isActief() {
  const c = config();
  return !!(c.host && c.user && c.pass && c.naar);
}

function maakTransporter(c) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    auth: { user: c.user, pass: c.pass }
  });
}

// Verstuurt een melding; blokkeert nooit de website (fouten worden alleen gelogd).
function stuurMelding(onderwerp, tekst) {
  const c = config();
  if (!(c.host && c.user && c.pass && c.naar)) return Promise.resolve(false);
  return maakTransporter(c).sendMail({
    from: `"Agroria website" <${c.user}>`,
    to: c.naar,
    subject: onderwerp,
    text: tekst
  }).then(() => true).catch(err => {
    console.error('E-mailmelding kon niet worden verstuurd:', err.message);
    return false;
  });
}

// Verstuurt een (opgemaakte) mail naar een klant, namens het bedrijf.
// Antwoorden van de klant komen binnen op de eigen mailbox (reply-to).
function stuurNaarKlant(naar, onderwerp, html, tekst) {
  const c = config();
  if (!(c.host && c.user && c.pass) || !naar || !naar.includes('@')) {
    return Promise.resolve(false);
  }
  return maakTransporter(c).sendMail({
    from: `"Agroria Landbouwvoertuigen" <${c.user}>`,
    to: naar,
    replyTo: c.naar || c.user,
    subject: onderwerp,
    html,
    text: tekst
  }).then(() => true).catch(err => {
    console.error('Bevestigingsmail aan klant kon niet worden verstuurd:', err.message);
    return false;
  });
}

// Voor de testknop in het beheer: geeft succes óf de exacte foutmelding terug.
function stuurTest() {
  const c = config();
  if (!(c.host && c.user && c.pass && c.naar)) {
    return Promise.resolve({ ok: false, fout: 'Nog niet alle velden zijn ingevuld.' });
  }
  return maakTransporter(c).sendMail({
    from: `"Agroria website" <${c.user}>`,
    to: c.naar,
    subject: 'Testmail van je Agroria-website',
    text: 'Gefeliciteerd — de e-mailmeldingen werken!\n\nJe ontvangt voortaan automatisch een mail op dit adres bij elke nieuwe vraag, inruil-aanvraag of bestelling via de website.'
  }).then(() => ({ ok: true })).catch(err => ({ ok: false, fout: err.message }));
}

module.exports = { stuurMelding, stuurNaarKlant, stuurTest, isActief, config, viaOmgeving };
