/*
 * Eenvoudige, privacyvriendelijke bezoekersstatistieken.
 *
 * - Telt paginaweergaven en (bij benadering) unieke bezoekers per dag.
 * - Telt weergaven per trekker per dag.
 * - Houdt bij wie er "nu live" op de site is (actief in de laatste 5 minuten).
 *
 * Privacy: er worden geen persoonsgegevens opgeslagen — alleen een niet
 * herleidbare, gehashte vingerafdruk (IP + browser) om dubbeltellingen te
 * voorkomen. Geen cookies, geen externe diensten.
 *
 * Techniek: tellingen worden in het geheugen gebufferd en elke minuut naar
 * data/db.json geschreven (nooit bij elk bezoek — dat zou te zwaar zijn).
 * Bots/crawlers worden genegeerd. Gegevens ouder dan 90 dagen worden opgeruimd.
 */
const crypto = require('crypto');
const db = require('./db');

const BOT_RE = /bot|crawl|spider|slurp|preview|monitor|facebookexternalhit|whatsapp|telegram|curl|wget|python|go-http|node-fetch|axios|headless|lighthouse|pingdom|uptime/i;
const BEWAAR_DAGEN = 90;
const LIVE_VENSTER_MS = 5 * 60 * 1000;

// dag -> { p: paginaweergaven, b: Set(bezoekershashes), t: { slug: weergaven } }
const buffer = {};
const live = new Map(); // hash -> laatst gezien (ms)
let dirty = false;

function vandaag() {
  return new Date().toISOString().slice(0, 10);
}

function bezoekerHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(ip + '|' + ua).digest('hex').slice(0, 16);
}

function isBot(req) {
  const ua = req.headers['user-agent'] || '';
  return !ua || BOT_RE.test(ua);
}

function dagEntry(dag) {
  if (!buffer[dag]) buffer[dag] = { p: 0, b: new Set(), t: {} };
  return buffer[dag];
}

// Telt een gewone paginaweergave (niet voor bots, niet voor ingelogde beheerders).
function telPagina(req) {
  if (isBot(req)) return;
  const e = dagEntry(vandaag());
  e.p++;
  const h = bezoekerHash(req);
  e.b.add(h);
  live.set(h, Date.now());
  dirty = true;
}

// Telt daarnaast een weergave van een specifieke trekker.
function telTrekker(req, slug) {
  if (isBot(req) || !slug) return;
  const e = dagEntry(vandaag());
  e.t[slug] = (e.t[slug] || 0) + 1;
  dirty = true;
}

function liveAantal() {
  const grens = Date.now() - LIVE_VENSTER_MS;
  let n = 0;
  for (const [h, ts] of live) {
    if (ts >= grens) n++;
    else live.delete(h);
  }
  return n;
}

// Schrijft de buffer weg naar db.json en ruimt oude data op.
function flush() {
  if (!dirty) return;
  dirty = false;
  try {
    const data = db.read();
    if (!data.stats) data.stats = {};
    const dag = vandaag();

    for (const d of Object.keys(buffer)) {
      const buf = buffer[d];
      const s = data.stats[d] || { p: 0, b: [], t: {} };
      s.p = (s.p || 0) + buf.p;
      // Unieke bezoekers: hashes van vandaag samenvoegen zodat we ook na een
      // herstart niet dubbel tellen. Oudere dagen zijn al gecomprimeerd tot een getal.
      if (Array.isArray(s.b)) {
        const set = new Set(s.b);
        buf.b.forEach(h => set.add(h));
        s.b = [...set];
      } else {
        s.b = (s.b || 0) + buf.b.size; // (komt in de praktijk niet voor op dezelfde dag)
      }
      for (const slug of Object.keys(buf.t)) {
        s.t[slug] = (s.t[slug] || 0) + buf.t[slug];
      }
      data.stats[d] = s;
      delete buffer[d];
    }

    // Oudere dagen: hash-lijst comprimeren tot alleen het aantal, en heel oude dagen weggooien.
    const grens = new Date(Date.now() - BEWAAR_DAGEN * 24 * 3600 * 1000).toISOString().slice(0, 10);
    for (const d of Object.keys(data.stats)) {
      if (d < grens) { delete data.stats[d]; continue; }
      if (d !== dag && Array.isArray(data.stats[d].b)) {
        data.stats[d].b = data.stats[d].b.length;
      }
    }

    db.write(data);
  } catch (e) {
    console.error('Statistieken konden niet worden opgeslagen:', e.message);
  }
}

// Levert een kant-en-klaar overzicht voor het dashboard.
function overzicht(tractors) {
  flush(); // eerst actuele buffer wegschrijven zodat het dashboard up-to-date is
  const data = db.read();
  const stats = data.stats || {};
  const dagen = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const s = stats[d];
    dagen.push({
      dag: d,
      paginas: s ? (s.p || 0) : 0,
      bezoekers: s ? (Array.isArray(s.b) ? s.b.length : (s.b || 0)) : 0
    });
  }

  // Trekker-weergaven: vandaag, laatste 7 en 30 dagen.
  const somPerTrekker = (aantalDagen) => {
    const som = {};
    for (let i = 0; i < aantalDagen; i++) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const t = (stats[d] || {}).t || {};
      for (const slug of Object.keys(t)) som[slug] = (som[slug] || 0) + t[slug];
    }
    return som;
  };
  const d7 = somPerTrekker(7);
  const d30 = somPerTrekker(30);
  const vandaagT = ((stats[vandaag()] || {}).t) || {};

  const trekkers = (tractors || [])
    .map(t => ({
      naam: `${t.merk} ${t.model}`.trim(),
      slug: t.slug || t.id,
      status: t.status,
      vandaag: vandaagT[t.slug] || 0,
      week: d7[t.slug] || 0,
      maand: d30[t.slug] || 0
    }))
    .sort((a, b) => b.maand - a.maand);

  return { dagen, trekkers, live: liveAantal() };
}

// Elke minuut wegschrijven; unref zodat losse scripts (bijv. seed) gewoon kunnen stoppen.
const timer = setInterval(flush, 60 * 1000);
if (timer.unref) timer.unref();

module.exports = { telPagina, telTrekker, liveAantal, overzicht };
