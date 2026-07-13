/*
 * Automatische trekker-video's — gemaakt van de eigen, échte foto's.
 *
 * Bij het plaatsen of bewerken van een trekker wordt op de achtergrond een
 * korte presentatievideo gegenereerd: vloeiende camerabewegingen over de
 * foto's (inzoomen, pannen, met een subtiel handheld-gevoel), de merknaam en
 * specificaties in beeld, nette overgangen en een afsluitend AGRORIA-kaartje
 * in de huisstijl. Alles draait lokaal met ffmpeg — geen externe diensten,
 * geen kosten, en de video toont altijd exact de echte machine.
 *
 * Teksten (titel, specificaties, het merk-kaartje) worden met sharp als
 * afbeelding gerenderd — met de meegeleverde huisstijl-fonts — en daarna
 * door ffmpeg over de beelden gelegd. Zo zijn we niet afhankelijk van
 * fonts of tekstfilters op de server.
 *
 * De generator draait één video tegelijk (wachtrij), zodat ook een kleine
 * server er nooit door overbelast raakt. De status per trekker staat in de
 * database: wachtrij → bezig → klaar (of fout).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const ffmpegPad = require('ffmpeg-static');
const db = require('./db');

// Eigen fonts beschikbaar maken voor de tekst-rendering (vóór sharp laadt),
// zodat de video er op elke server hetzelfde uitziet.
const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');
try {
  const fcDir = path.join(os.tmpdir(), 'agroria-fontconfig');
  fs.mkdirSync(path.join(fcDir, 'cache'), { recursive: true });
  fs.writeFileSync(path.join(fcDir, 'fonts.conf'), `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONTS_DIR}</dir>
  <cachedir>${path.join(fcDir, 'cache')}</cachedir>
</fontconfig>`);
  process.env.FONTCONFIG_PATH = fcDir;
} catch (e) {
  console.error('Kon fontconfig voor video-teksten niet voorbereiden:', e.message);
}
const sharp = require('sharp');

// --- Instellingen van de video ---
const BREED = 1280, HOOG = 720, FPS = 25; // 720p: scherp genoeg, snel te maken
const FOTO_DUUR = 4;        // seconden per foto (zonder overgang)
const OVERGANG = 0.8;       // seconden crossfade tussen foto's
const MAX_FOTOS = 6;        // maximaal aantal foto's in de video
const OUTRO_DUUR = 3.6;     // seconden voor het afsluitende merk-kaartje
const MAX_RENDERTIJD = 12 * 60 * 1000; // vangnet: nooit langer dan 12 minuten

// --- Hulpjes ---
const uploadsMap = () => path.join(db.DATA_DIR, 'uploads');

function verwijderBestand(naam) {
  if (!naam) return;
  const p = path.join(uploadsMap(), naam);
  if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
}

// Handtekening van alles wat in de video terechtkomt. Verandert die, dan
// wordt de video opnieuw gemaakt; zo niet, dan blijft de bestaande staan.
function bron(t) {
  return JSON.stringify([t.fotos || [], t.merk, t.model, t.bouwjaar, t.uren, t.pk]);
}

function getal(n) {
  return Number(n || 0).toLocaleString('nl-NL');
}

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Wachtrij: één video tegelijk ---
const wachtrij = [];
let bezig = false;

function zetStatus(trekkerId, velden) {
  const data = db.read();
  const t = data.tractors.find(x => x.id === trekkerId);
  if (!t) return null;
  Object.assign(t, velden);
  db.write(data);
  return t;
}

function planVideo(trekkerId) {
  if (!wachtrij.includes(trekkerId)) wachtrij.push(trekkerId);
  verwerkWachtrij();
}

async function verwerkWachtrij() {
  if (bezig) return;
  bezig = true;
  while (wachtrij.length) {
    const id = wachtrij.shift();
    try {
      await maakVideo(id);
    } catch (e) {
      console.error('Trekker-video mislukt (' + id + '):', e.message);
      zetStatus(id, { videoStatus: 'fout', videoFout: e.message });
    }
  }
  bezig = false;
}

// Controleer (na elke wijziging van een trekker) of de video nog klopt.
// Zo niet: in de wachtrij zetten. Geen foto's meer? Video opruimen.
function controleer(trekkerId) {
  const data = db.read();
  const t = data.tractors.find(x => x.id === trekkerId);
  if (!t || t.status === 'verwijderd') return;
  if (!t.fotos || !t.fotos.length) {
    if (t.video) {
      verwijderBestand(t.video);
      t.video = ''; t.videoStatus = ''; t.videoBron = ''; t.videoFout = '';
      db.write(data);
    }
    return;
  }
  if (t.video && t.videoStatus === 'klaar' && t.videoBron === bron(t)) return;
  t.videoStatus = 'wachtrij';
  t.videoFout = '';
  db.write(data);
  planVideo(trekkerId);
}

// Video (en status) opruimen, bijv. als de trekker wordt verwijderd.
function ruimOp(t) {
  if (t && t.video) verwijderBestand(t.video);
}

// Bij het opstarten: afgebroken of ontbrekende video's opnieuw inplannen.
// Met een kleine vertraging zodat de site eerst rustig kan opstarten.
function herstelBijOpstarten() {
  setTimeout(() => {
    const data = db.read();
    (data.tractors || [])
      .filter(t => t.status !== 'verwijderd' && t.fotos && t.fotos.length)
      .filter(t => !(t.video && t.videoStatus === 'klaar' && t.videoBron === bron(t)))
      .forEach(t => controleer(t.id));
  }, 15 * 1000);
}

// --- De eigenlijke generator ---
function ffmpeg(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPad, args, { timeout: timeoutMs || MAX_RENDERTIJD, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const staart = String(stderr || '').split('\n').slice(-8).join('\n');
        return reject(new Error('ffmpeg: ' + (err.killed ? 'duurde te lang' : staart || err.message)));
      }
      resolve();
    });
  });
}

// Titel-overlay: merk/model + specificaties onderin beeld, op een zachte
// donkere verloop-band zodat de tekst op elke foto leesbaar is.
function titelOverlaySvg(t) {
  const titel = escXml(`${t.merk || ''} ${t.model || ''}`.trim());
  const specs = escXml([
    t.bouwjaar ? `Bouwjaar ${t.bouwjaar}` : '',
    t.uren ? `${getal(t.uren)} uur` : '',
    t.pk ? `${t.pk} pk` : ''
  ].filter(Boolean).join('   ·   '));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BREED}" height="${HOOG}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.62"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${HOOG - 250}" width="${BREED}" height="250" fill="url(#g)"/>
  <rect x="64" y="${HOOG - 172}" width="46" height="2" fill="#C0A063"/>
  <text x="64" y="${HOOG - 108}" font-family="Fraunces" font-weight="600" font-size="54" fill="#FFFFFF">${titel}</text>
  ${specs ? `<text x="66" y="${HOOG - 58}" font-family="Hanken Grotesk" font-weight="500" font-size="26" letter-spacing="1" fill="#D8C49A">${specs}</text>` : ''}
</svg>`;
}

// Afsluitend merk-kaartje in de huisstijl: donkergroen met goud.
function outroSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BREED}" height="${HOOG}">
  <rect width="${BREED}" height="${HOOG}" fill="#1C3320"/>
  <rect x="${BREED / 2 - 30}" y="${HOOG / 2 - 108}" width="60" height="2" fill="#C0A063"/>
  <text x="${BREED / 2}" y="${HOOG / 2}" text-anchor="middle" font-family="Fraunces" font-weight="600" font-size="66" fill="#C0A063" letter-spacing="18">AGRORIA</text>
  <text x="${BREED / 2}" y="${HOOG / 2 + 60}" text-anchor="middle" font-family="Hanken Grotesk" font-size="17" fill="#8FA383" letter-spacing="8">LANDBOUWVOERTUIGEN</text>
  <text x="${BREED / 2}" y="${HOOG / 2 + 130}" text-anchor="middle" font-family="Hanken Grotesk" font-size="26" fill="#D8C49A">www.agroria.nl</text>
</svg>`;
}

// Camerabeweging per foto: afwisselend inzoomen, pannen en uitzoomen,
// met een heel subtiele zwaai zodat het als uit de hand gefilmd voelt.
function beweging(i, frames) {
  const zwaaiX = `+4*sin(on/13)`;
  const zwaaiY = `+3*sin(on/17)`;
  const midX = `(iw-iw/zoom)/2`;
  const midY = `(ih-ih/zoom)/2`;
  switch (i % 4) {
    case 0: // rustig inzoomen
      return { z: `1.03+0.12*on/${frames}`, x: midX + zwaaiX, y: midY + zwaaiY };
    case 1: // panorama naar rechts
      return { z: `1.15`, x: `(iw-iw/zoom)*on/${frames}` + zwaaiX, y: midY + zwaaiY };
    case 2: // rustig uitzoomen
      return { z: `1.15-0.12*on/${frames}`, x: midX + zwaaiX, y: midY + zwaaiY };
    default: // panorama naar links
      return { z: `1.15`, x: `(iw-iw/zoom)*(1-on/${frames})` + zwaaiX, y: midY + zwaaiY };
  }
}

async function maakVideo(trekkerId) {
  const data = db.read();
  const t = data.tractors.find(x => x.id === trekkerId);
  if (!t || t.status === 'verwijderd' || !t.fotos || !t.fotos.length) return;
  const bronNu = bron(t);
  if (t.video && t.videoStatus === 'klaar' && t.videoBron === bronNu) return; // al actueel

  zetStatus(trekkerId, { videoStatus: 'bezig', videoFout: '' });
  console.log(`[video] Start: ${t.merk} ${t.model} (${t.fotos.length} foto's)`);
  const start = Date.now();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agroria-video-'));
  try {
    // 1. Foto's voorbereiden: naar vaste 16:9-beelden op dubbele grootte,
    //    zodat de camerabeweging strak blijft (geen trillende randjes).
    const fotos = t.fotos.slice(0, MAX_FOTOS);
    const beelden = [];
    for (let i = 0; i < fotos.length; i++) {
      const bronPad = path.join(uploadsMap(), fotos[i]);
      if (!fs.existsSync(bronPad)) continue;
      const doel = path.join(tmp, `f${i}.jpg`);
      await sharp(bronPad).rotate()
        .resize(BREED * 2, HOOG * 2, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 90 })
        .toFile(doel);
      beelden.push(doel);
    }
    if (!beelden.length) throw new Error('geen bruikbare foto\u2019s gevonden');

    // 2. Tekstbeelden renderen (titel-overlay + afsluitend merk-kaartje)
    const titelPng = path.join(tmp, 'titel.png');
    await sharp(Buffer.from(titelOverlaySvg(t))).png().toFile(titelPng);
    const outroPng = path.join(tmp, 'outro.png');
    await sharp(Buffer.from(outroSvg())).png().toFile(outroPng);

    // 3. Het ffmpeg-filter opbouwen: per foto een bewegend shot, de titel
    //    over het eerste shot, alles aan elkaar met crossfades, en tot slot
    //    het merk-kaartje.
    const frames = Math.round((FOTO_DUUR + OVERGANG) * FPS);
    const segDuur = FOTO_DUUR + OVERGANG;
    const outroDuur = OUTRO_DUUR + OVERGANG;

    const args = [];
    beelden.forEach(b => { args.push('-i', b); });
    const titelIndex = beelden.length;
    args.push('-loop', '1', '-t', segDuur.toFixed(2), '-i', titelPng);
    const outroIndex = beelden.length + 1;
    args.push('-loop', '1', '-t', outroDuur.toFixed(2), '-i', outroPng);

    const filters = [];
    beelden.forEach((b, i) => {
      const m = beweging(i, frames);
      const uitlabel = i === 0 ? 'v0kaal' : `v${i}`;
      filters.push(`[${i}:v]zoompan=z='${m.z}':x='${m.x}':y='${m.y}':d=${frames}:s=${BREED}x${HOOG}:fps=${FPS}[${uitlabel}]`);
    });
    // Titel zacht laten opkomen en weer verdwijnen over het eerste shot
    filters.push(
      `[${titelIndex}:v]fps=${FPS},format=rgba,` +
      `fade=t=in:st=0.6:d=0.5:alpha=1,fade=t=out:st=${(FOTO_DUUR - 0.4).toFixed(2)}:d=0.5:alpha=1[titel]`
    );
    filters.push(`[v0kaal][titel]overlay=0:0:eof_action=pass[v0]`);
    filters.push(`[${outroIndex}:v]fps=${FPS},format=yuv420p[vout]`);

    // Crossfades aan elkaar rijgen (elke overgang start FOTO_DUUR later)
    const delen = beelden.map((b, i) => `v${i}`).concat('vout');
    let vorige = delen[0];
    for (let k = 1; k < delen.length; k++) {
      const naam = k === delen.length - 1 ? 'samen' : `x${k}`;
      filters.push(`[${vorige}][${delen[k]}]xfade=transition=fade:duration=${OVERGANG}:offset=${(k * FOTO_DUUR).toFixed(2)}[${naam}]`);
      vorige = naam;
    }
    const totaal = beelden.length * FOTO_DUUR + OUTRO_DUUR + OVERGANG;
    filters.push(`[samen]fade=t=in:st=0:d=0.5,fade=t=out:st=${(totaal - 0.7).toFixed(2)}:d=0.7,format=yuv420p[eind]`);

    const uit = path.join(tmp, 'video.mp4');
    args.push(
      '-filter_complex', filters.join(';'),
      '-map', '[eind]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
      '-movflags', '+faststart', '-an', '-y', uit
    );
    await ffmpeg(args);

    // 4. Klaar: naar de uploads-map en de trekker bijwerken
    const naam = `video-${trekkerId}-${Date.now().toString(36)}.mp4`;
    fs.copyFileSync(uit, path.join(uploadsMap(), naam));
    const oud = (db.read().tractors.find(x => x.id === trekkerId) || {}).video;
    zetStatus(trekkerId, { video: naam, videoStatus: 'klaar', videoBron: bronNu, videoFout: '' });
    if (oud && oud !== naam) verwijderBestand(oud);
    const mb = (fs.statSync(path.join(uploadsMap(), naam)).size / 1024 / 1024).toFixed(1);
    console.log(`[video] Klaar: ${t.merk} ${t.model} — ${Math.round(totaal)}s, ${mb} MB, in ${Math.round((Date.now() - start) / 1000)}s gemaakt`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
}

module.exports = { controleer, ruimOp, herstelBijOpstarten, bron };
