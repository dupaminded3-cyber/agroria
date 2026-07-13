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
// Zuinig met geheugen: geen beeld-cache en één bewerking tegelijk. De video
// wordt op de achtergrond gemaakt — een paar seconden langzamer is prima,
// maar de server (512 MB op Render) mag nooit vollopen.
sharp.cache(false);
sharp.concurrency(1);

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
// Het versienummer hoort daar ook bij: gaat de stijl van de video's omhoog,
// dan worden bestaande video's na een deploy vanzelf opnieuw gemaakt.
const VIDEO_VERSIE = 2; // v2: volledige foto met vervaagde achtergrond, rustige zoom
function bron(t) {
  return JSON.stringify([VIDEO_VERSIE, t.fotos || [], t.merk, t.model, t.bouwjaar, t.uren, t.pk]);
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
  // Nieuwe inhoud (andere foto's/gegevens)? Dan telt het aantal pogingen opnieuw.
  if (t.videoPogingBron !== bron(t)) {
    t.videoPogingen = 0;
    t.videoPogingBron = bron(t);
  }
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
// Met een ruime vertraging, zodat de site eerst stabiel draait en een
// eventueel probleem met de videogeneratie nooit het opstarten kan raken.
function herstelBijOpstarten() {
  setTimeout(() => {
    const data = db.read();
    (data.tractors || [])
      .filter(t => t.status !== 'verwijderd' && t.fotos && t.fotos.length)
      .filter(t => !(t.video && t.videoStatus === 'klaar' && t.videoBron === bron(t)))
      .forEach(t => controleer(t.id));
  }, 90 * 1000);
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

// Camerabeweging per foto: afwisselend héél rustig in- en uitzoomen, altijd
// netjes gecentreerd. Bewust geen zwaai of panorama meer — dat oogde als
// trillen. De foto wordt bovendien op 3x formaat aangeleverd, zodat de
// beweging in sub-pixelstapjes verloopt en boterzacht blijft.
function beweging(i, frames) {
  const mid = { x: `(iw-iw/zoom)/2`, y: `(ih-ih/zoom)/2` };
  return i % 2 === 0
    ? { z: `1+0.06*on/${frames}`, ...mid }        // rustig inzoomen (6%)
    : { z: `1.06-0.06*on/${frames}`, ...mid };    // rustig uitzoomen
}

async function maakVideo(trekkerId) {
  const data = db.read();
  const t = data.tractors.find(x => x.id === trekkerId);
  if (!t || t.status === 'verwijderd' || !t.fotos || !t.fotos.length) return;
  const bronNu = bron(t);
  if (t.video && t.videoStatus === 'klaar' && t.videoBron === bronNu) return; // al actueel

  // Vangnet tegen eindeloos opnieuw proberen (bijv. als de server tijdens het
  // renderen herstart door geheugengebrek): maximaal 3 pogingen per inhoud.
  // Via "Video (opnieuw) maken" in het beheer kan het altijd nog handmatig.
  if ((t.videoPogingen || 0) >= 3) {
    zetStatus(trekkerId, { videoStatus: 'fout', videoFout: 'na 3 pogingen gestopt' });
    return;
  }
  zetStatus(trekkerId, { videoStatus: 'bezig', videoFout: '', videoPogingen: (t.videoPogingen || 0) + 1 });
  console.log(`[video] Start: ${t.merk} ${t.model} (${t.fotos.length} foto's)`);
  const start = Date.now();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agroria-video-'));
  try {
    // 1. Foto's voorbereiden. De foto wordt NIET meer bijgesneden naar
    //    breedbeeld (dat maakte het beeld "ingezoomd"): hij komt volledig
    //    in beeld, met links/rechts of boven/onder een zachte, donkere
    //    vervaagde versie van dezelfde foto als achtergrond — zoals bij
    //    professionele dealervideo's.
    //    De voorgrondfoto wordt op 3x formaat aangeleverd, zodat de
    //    zoombeweging vloeiend blijft (sub-pixelstapjes, geen trillen).
    const fotos = t.fotos.slice(0, MAX_FOTOS);
    const beelden = [];
    for (let i = 0; i < fotos.length; i++) {
      const bronPad = path.join(uploadsMap(), fotos[i]);
      if (!fs.existsSync(bronPad)) continue;
      const buf = await sharp(bronPad).rotate().toBuffer();
      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height) continue;
      // Passend binnen het beeld, met even afmetingen (nodig voor de encoder)
      const schaal = Math.min(BREED / meta.width, HOOG / meta.height);
      const vw = Math.max(2, Math.floor((meta.width * schaal) / 2) * 2);
      const vh = Math.max(2, Math.floor((meta.height * schaal) / 2) * 2);
      // 3x voor een vloeiende zoom, maar begrensd zodat het geheugen van een
      // kleine server ruim toereikend blijft.
      const factor = Math.min(3, 2560 / vw, 1920 / vh);
      const voorgrond = path.join(tmp, `fg${i}.jpg`);
      await sharp(buf)
        .resize(Math.round((vw * factor) / 2) * 2, Math.round((vh * factor) / 2) * 2, { fit: 'fill' })
        .jpeg({ quality: 90 })
        .toFile(voorgrond);
      const achtergrond = path.join(tmp, `bg${i}.jpg`);
      await sharp(buf)
        .resize(BREED, HOOG, { fit: 'cover' })
        .blur(16)
        .modulate({ brightness: 0.6 })
        .jpeg({ quality: 80 })
        .toFile(achtergrond);
      beelden.push({ voorgrond, achtergrond, vw, vh });
    }
    if (!beelden.length) throw new Error('geen bruikbare foto\u2019s gevonden');

    // 2. Tekstbeelden renderen (titel-overlay + afsluitend merk-kaartje)
    const titelPng = path.join(tmp, 'titel.png');
    await sharp(Buffer.from(titelOverlaySvg(t))).png().toFile(titelPng);
    const outroPng = path.join(tmp, 'outro.png');
    await sharp(Buffer.from(outroSvg())).png().toFile(outroPng);

    // 3. Elk shot apart renderen en daarna verliesvrij aan elkaar plakken.
    //    Bewust NIET alles in één grote ffmpeg-bewerking: dat kost meer
    //    geheugen dan een kleine server (512 MB op Render) aankan. Maar
    //    shot voor shot blijft het verbruik laag en constant. De overgangen
    //    zijn korte fades door zwart — rustig en filmisch.
    const frames = Math.round(FOTO_DUUR * FPS);
    const codec = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-threads', '1', '-an'];
    const segmenten = [];

    for (let i = 0; i < beelden.length; i++) {
      const b = beelden[i];
      const m = beweging(i, frames);
      const seg = path.join(tmp, `seg${i}.mp4`);
      // Achtergrond: stilstaande vervaagde foto. Voorgrond: de volledige
      // foto, gecentreerd, met een heel rustige zoombeweging.
      const args = [
        '-loop', '1', '-t', FOTO_DUUR.toFixed(2), '-i', b.achtergrond,
        '-i', b.voorgrond
      ];
      let filter =
        `[0:v]fps=${FPS}[bg]` +
        `;[1:v]zoompan=z='${m.z}':x='${m.x}':y='${m.y}':d=${frames}:s=${b.vw}x${b.vh}:fps=${FPS}[fg]` +
        `;[bg][fg]overlay=${(BREED - b.vw) / 2}:${(HOOG - b.vh) / 2}:eof_action=endall[shot]`;
      if (i === 0) {
        // Titel zacht laten opkomen en verdwijnen over het eerste shot
        args.push('-loop', '1', '-t', FOTO_DUUR.toFixed(2), '-i', titelPng);
        filter += `;[2:v]fps=${FPS},format=rgba,fade=t=in:st=0.5:d=0.5:alpha=1,fade=t=out:st=${(FOTO_DUUR - 0.9).toFixed(2)}:d=0.5:alpha=1[titel]` +
          `;[shot][titel]overlay=0:0:eof_action=pass[met]` +
          `;[met]fade=t=in:st=0:d=0.5,fade=t=out:st=${(FOTO_DUUR - OVERGANG / 2).toFixed(2)}:d=${(OVERGANG / 2).toFixed(2)},format=yuv420p[eind]`;
      } else {
        filter += `;[shot]fade=t=in:st=0:d=${(OVERGANG / 2).toFixed(2)},fade=t=out:st=${(FOTO_DUUR - OVERGANG / 2).toFixed(2)}:d=${(OVERGANG / 2).toFixed(2)},format=yuv420p[eind]`;
      }
      args.push('-filter_complex', filter, '-map', '[eind]', ...codec, '-y', seg);
      await ffmpeg(args);
      segmenten.push(seg);
    }

    // Afsluitend merk-kaartje
    const outroSeg = path.join(tmp, 'outro.mp4');
    await ffmpeg([
      '-loop', '1', '-t', OUTRO_DUUR.toFixed(2), '-i', outroPng,
      '-filter_complex', `[0:v]fps=${FPS},fade=t=in:st=0:d=${(OVERGANG / 2).toFixed(2)},fade=t=out:st=${(OUTRO_DUUR - 0.7).toFixed(2)}:d=0.7,format=yuv420p[eind]`,
      '-map', '[eind]', ...codec, '-y', outroSeg
    ]);
    segmenten.push(outroSeg);

    // Verliesvrij samenvoegen (geen her-codering, dus snel en zuinig)
    const lijst = path.join(tmp, 'lijst.txt');
    fs.writeFileSync(lijst, segmenten.map(s => `file '${s}'`).join('\n'));
    const uit = path.join(tmp, 'video.mp4');
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', lijst, '-c', 'copy', '-movflags', '+faststart', '-y', uit]);
    const totaal = beelden.length * FOTO_DUUR + OUTRO_DUUR;

    // 4. Klaar: naar de uploads-map en de trekker bijwerken
    const naam = `video-${trekkerId}-${Date.now().toString(36)}.mp4`;
    fs.copyFileSync(uit, path.join(uploadsMap(), naam));
    const oud = (db.read().tractors.find(x => x.id === trekkerId) || {}).video;
    zetStatus(trekkerId, { video: naam, videoStatus: 'klaar', videoBron: bronNu, videoFout: '', videoPogingen: 0 });
    if (oud && oud !== naam) verwijderBestand(oud);
    const mb = (fs.statSync(path.join(uploadsMap(), naam)).size / 1024 / 1024).toFixed(1);
    console.log(`[video] Klaar: ${t.merk} ${t.model} — ${Math.round(totaal)}s, ${mb} MB, in ${Math.round((Date.now() - start) / 1000)}s gemaakt`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
}

module.exports = { controleer, ruimOp, herstelBijOpstarten, bron };
