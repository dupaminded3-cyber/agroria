/*
 * Hulpprogramma: bereidt al het beeldmateriaal voor één trekker-video voor.
 * Wordt door lib/video.js als apart proces gestart
 * (node lib/video-render.js <opdracht.json>), zodat al het zware
 * beeldbewerkingswerk buiten de webserver om gebeurt. Dit proces rendert de
 * losse beeldjes (frames), achtergronden en tekstkaarten, schrijft een
 * plan.json met wat er daarna gecodeerd moet worden, en sluit af — pas
 * daarná start de webserver ffmpeg. Zo draaien de beeldbewerking en de
 * videocodering nooit tegelijk en blijft het totale geheugengebruik laag.
 *
 * De opdracht (JSON-bestand) bevat: trekker (gegevens + fotobestandsnamen),
 * uploadsMap (waar de foto's staan) en werkMap (waar frames + plan komen).
 * Dit script schrijft NIET in de database — dat doet de webserver zelf.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Eigen huisstijl-fonts beschikbaar maken voor de tekst-rendering (vóór
// sharp laadt), zodat de video er op elke server hetzelfde uitziet.
const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const fcDir = path.join(os.tmpdir(), 'agroria-fontconfig');
fs.mkdirSync(path.join(fcDir, 'cache'), { recursive: true });
fs.writeFileSync(path.join(fcDir, 'fonts.conf'), `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONTS_DIR}</dir>
  <cachedir>${path.join(fcDir, 'cache')}</cachedir>
</fontconfig>`);
process.env.FONTCONFIG_PATH = fcDir;
const sharp = require('sharp');

// Zuinig met geheugen: geen beeld-cache en één bewerking tegelijk.
sharp.cache(false);
sharp.concurrency(1);

// --- Instellingen van de video ---
const BREED = 1280, HOOG = 720, FPS = 25;
const FOTO_DUUR = 4;      // seconden per foto
const OVERGANG = 0.8;     // seconden fade tussen de shots
const MAX_FOTOS = 6;      // maximaal aantal foto's in de video
const OUTRO_DUUR = 3.6;   // seconden voor het afsluitende merk-kaartje
const ZOOM = 1.06;        // maximale zoom: rustig en nauwelijks opdringerig

function getal(n) {
  return Number(n || 0).toLocaleString('nl-NL');
}

function escXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

// De zoombeweging wordt frame voor frame gerenderd met een echte sub-pixel-
// transformatie (affine + bicubisch): wiskundig vloeiend, dus geen schudden.
// Even shot = rustig inzoomen, oneven = uitzoomen, met zachte ease-in/out.
function zoomOpFrame(i, n, frames) {
  const p = frames <= 1 ? 0 : n / (frames - 1);
  const vloeiend = p * p * (3 - 2 * p); // smoothstep
  return i % 2 === 0
    ? 1 + (ZOOM - 1) * vloeiend
    : ZOOM - (ZOOM - 1) * vloeiend;
}

async function renderShotFrames(bronBuf, srcW, srcH, vw, vh, i, frames, map) {
  for (let n = 0; n < frames; n++) {
    const z = zoomOpFrame(i, n, frames);
    // De schaal krijgt een paar pixels marge: het getransformeerde beeld
    // wordt gegarandeerd iets groter dan het uitsnijvenster. Zonder die
    // marge kon het door afronding nét één pixel te klein uitvallen — dan
    // faalt het uitsnijden ("bad extract area"), en dat gebeurde precies
    // bij foto's met bepaalde afmetingen. De basis-schaal staat vast per
    // shot, zodat de beweging strak gelijkmatig blijft.
    const s = Math.max((vw + 2) / srcW, (vh + 2) / srcH) * z;
    const dx = (srcW * s - vw) / 2; // fractioneel: gecentreerd uitsnijden
    const dy = (srcH * s - vh) / 2;
    // In twee stappen (via raw pixels): sharp voert bewerkingen in een eigen
    // vaste volgorde uit, waardoor extract anders vóór affine zou lopen.
    const raw = await sharp(bronBuf)
      .affine([[s, 0], [0, s]], { odx: -dx, ody: -dy, interpolator: 'bicubic', background: '#000' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    await sharp(raw.data, { raw: { width: raw.info.width, height: raw.info.height, channels: raw.info.channels } })
      .extract({ left: 0, top: 0, width: Math.min(vw, raw.info.width), height: Math.min(vh, raw.info.height) })
      .jpeg({ quality: 92 })
      .toFile(path.join(map, `f${String(n).padStart(3, '0')}.jpg`));
  }
}

async function main() {
  const opdracht = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const t = opdracht.trekker;
  const werkMap = opdracht.werkMap;
  fs.mkdirSync(werkMap, { recursive: true });

  // 1. Foto's voorbereiden. De volledige foto komt in beeld, met een
  //    zachte donker-vervaagde versie van dezelfde foto als achtergrond.
  const fotos = (t.fotos || []).slice(0, MAX_FOTOS);
  const frames = Math.round(FOTO_DUUR * FPS);
  const plan = { breed: BREED, hoog: HOOG, fps: FPS, fotoDuur: FOTO_DUUR, overgang: OVERGANG, outroDuur: OUTRO_DUUR, shots: [] };

  for (let i = 0; i < fotos.length; i++) {
    const bronPad = path.join(opdracht.uploadsMap, fotos[i]);
    if (!fs.existsSync(bronPad)) continue;
    const buf = await sharp(bronPad).rotate().toBuffer();
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) continue;
    const schaal = Math.min(BREED / meta.width, HOOG / meta.height);
    const vw = Math.max(2, Math.floor((meta.width * schaal) / 2) * 2);
    const vh = Math.max(2, Math.floor((meta.height * schaal) / 2) * 2);
    // Bron voor de zoom: precies groot genoeg voor de maximale zoomstand.
    const srcW = Math.ceil((vw * ZOOM) / 2) * 2;
    const srcH = Math.ceil((vh * ZOOM) / 2) * 2;
    const voorgrond = await sharp(buf).resize(srcW, srcH, { fit: 'fill' }).png().toBuffer();
    const achtergrond = path.join(werkMap, `bg${i}.jpg`);
    await sharp(buf)
      .resize(BREED, HOOG, { fit: 'cover' })
      .blur(16)
      .modulate({ brightness: 0.6 })
      .jpeg({ quality: 80 })
      .toFile(achtergrond);
    const framesMap = path.join(werkMap, `frames${i}`);
    fs.mkdirSync(framesMap, { recursive: true });
    await renderShotFrames(voorgrond, srcW, srcH, vw, vh, plan.shots.length, frames, framesMap);
    plan.shots.push({ framesMap, achtergrond, vw, vh });
  }
  if (!plan.shots.length) throw new Error('geen bruikbare foto\u2019s gevonden');

  // 2. Tekstbeelden renderen (titel-overlay + afsluitend merk-kaartje)
  plan.titelPng = path.join(werkMap, 'titel.png');
  await sharp(Buffer.from(titelOverlaySvg(t))).png().toFile(plan.titelPng);
  plan.outroPng = path.join(werkMap, 'outro.png');
  await sharp(Buffer.from(outroSvg())).png().toFile(plan.outroPng);

  // 3. Plan wegschrijven; de webserver draait hierna pas ffmpeg — zo lopen
  //    beeldbewerking en videocodering nooit tegelijk.
  fs.writeFileSync(path.join(werkMap, 'plan.json'), JSON.stringify(plan));
}

main().then(
  () => process.exit(0),
  (e) => { console.error(e.message); process.exit(1); }
);
