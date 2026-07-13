/*
 * Automatische trekker-video's — gemaakt van de eigen, échte foto's.
 *
 * Dit bestand regelt de wachtrij en de administratie; het eigenlijke
 * renderwerk gebeurt in een APART proces (lib/video-render.js). Daardoor:
 *   - raakt de webserver nooit overbelast of instabiel door het renderen
 *     (gaat het renderproces onderuit, dan draait de site gewoon door);
 *   - blijft het geheugen van de server vrij voor bezoekers.
 *
 * Zelfherstel: er draait een bewaker die elk uur controleert of elke
 * trekker met foto's een actuele video heeft. Ontbreekt er één (bijv. na
 * een herstart of een eerdere mislukking), dan wordt hij automatisch
 * opnieuw gemaakt — met telkens hooguit één nieuwe poging per uur, zodat
 * een structureel probleem nooit tot een storing kan leiden.
 */
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const db = require('./db');

const MAX_RENDERTIJD = 20 * 60 * 1000; // vangnet: nooit langer dan 20 minuten
const MAX_POGINGEN = 3;                // per inhoud, plus 1 extra per uur via de bewaker

// Versienummer van de videostijl: gaat dit omhoog, dan worden bestaande
// video's na een deploy vanzelf opnieuw gemaakt.
const VIDEO_VERSIE = 3; // v3: sub-pixel-vloeiende zoom (geen schudden)

// Handtekening van alles wat in de video terechtkomt. Verandert die, dan
// wordt de video opnieuw gemaakt; zo niet, dan blijft de bestaande staan.
function bron(t) {
  return JSON.stringify([VIDEO_VERSIE, t.fotos || [], t.merk, t.model, t.bouwjaar, t.uren, t.pk]);
}

const uploadsMap = () => path.join(db.DATA_DIR, 'uploads');

function verwijderBestand(naam) {
  if (!naam) return;
  const p = path.join(uploadsMap(), naam);
  if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch (e) {}
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

// De bewaker: zorgt dat élke trekker met foto's een actuele video krijgt.
// Draait kort na het opstarten en daarna elk uur. Een eerder gestrande of
// mislukte video krijgt zo telkens één nieuwe kans per uur — vaak genoeg om
// vanzelf te herstellen, zelden genoeg om nooit een storing te veroorzaken.
function bewaker() {
  const data = db.read();
  let bijgewerkt = false;
  (data.tractors || [])
    .filter(t => t.status !== 'verwijderd' && t.fotos && t.fotos.length)
    .filter(t => !(t.video && t.videoStatus === 'klaar' && t.videoBron === bron(t)))
    .forEach(t => {
      if ((t.videoPogingen || 0) >= MAX_POGINGEN) {
        t.videoPogingen = MAX_POGINGEN - 1; // één verse poging deze ronde
        bijgewerkt = true;
      }
    });
  if (bijgewerkt) db.write(data);
  (data.tractors || [])
    .filter(t => t.status !== 'verwijderd' && t.fotos && t.fotos.length)
    .forEach(t => controleer(t.id));
}

function herstelBijOpstarten() {
  setTimeout(bewaker, 90 * 1000);              // eerste ronde: 1,5 min na de start
  setInterval(bewaker, 60 * 60 * 1000);        // daarna: elk uur
}

// --- Renderen ---
// Stap 1 (apart proces): al het beeldwerk — frames, achtergronden, tekst.
// Stap 2 (ffmpeg, één voor één): de shots coderen en samenvoegen.
// Zo draaien de beeldbewerking en de codering nooit tegelijk en blijft het
// piekgeheugen ver onder wat de server aankan.
function renderInEigenProces(opdrachtPad) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(__dirname, 'video-render.js'), opdrachtPad], {
      timeout: MAX_RENDERTIJD,
      maxBuffer: 8 * 1024 * 1024
    }, (err, stdout, stderr) => {
      if (err) {
        const melding = err.killed ? 'duurde te lang'
          : (String(stderr || '').trim().split('\n').pop() || err.message);
        return reject(new Error(melding));
      }
      resolve();
    });
  });
}

const ffmpegPad = require('ffmpeg-static');
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPad, args, { timeout: MAX_RENDERTIJD, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const staart = String(stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ');
        return reject(new Error('ffmpeg: ' + (err.killed ? 'duurde te lang' : staart || err.message)));
      }
      resolve();
    });
  });
}

// Zuinig coderen: één thread, weinig referentiekaders en korte lookahead.
const CODEC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-threads', '1', '-x264-params', 'ref=1:rc-lookahead=10', '-an'];

async function codeerVideo(plan, uitPad) {
  const { breed, hoog, fps, fotoDuur, overgang, outroDuur } = plan;
  const werkMap = path.dirname(plan.titelPng);
  const segmenten = [];
  for (let i = 0; i < plan.shots.length; i++) {
    const b = plan.shots[i];
    const seg = path.join(werkMap, `seg${i}.mp4`);
    const args = [
      '-loop', '1', '-t', fotoDuur.toFixed(2), '-i', b.achtergrond,
      '-framerate', String(fps), '-i', path.join(b.framesMap, 'f%03d.jpg')
    ];
    let filter =
      `[0:v]fps=${fps}[bg]` +
      `;[bg][1:v]overlay=${(breed - b.vw) / 2}:${(hoog - b.vh) / 2}:eof_action=endall[shot]`;
    if (i === 0) {
      // Titel zacht laten opkomen en verdwijnen over het eerste shot
      args.push('-loop', '1', '-t', fotoDuur.toFixed(2), '-i', plan.titelPng);
      filter += `;[2:v]fps=${fps},format=rgba,fade=t=in:st=0.5:d=0.5:alpha=1,fade=t=out:st=${(fotoDuur - 0.9).toFixed(2)}:d=0.5:alpha=1[titel]` +
        `;[shot][titel]overlay=0:0:eof_action=pass[met]` +
        `;[met]fade=t=in:st=0:d=0.5,fade=t=out:st=${(fotoDuur - overgang / 2).toFixed(2)}:d=${(overgang / 2).toFixed(2)},format=yuv420p[eind]`;
    } else {
      filter += `;[shot]fade=t=in:st=0:d=${(overgang / 2).toFixed(2)},fade=t=out:st=${(fotoDuur - overgang / 2).toFixed(2)}:d=${(overgang / 2).toFixed(2)},format=yuv420p[eind]`;
    }
    args.push('-filter_complex', filter, '-map', '[eind]', ...CODEC, '-y', seg);
    await ffmpeg(args);
    fs.rmSync(b.framesMap, { recursive: true, force: true }); // schijf meteen opruimen
    segmenten.push(seg);
  }

  // Afsluitend merk-kaartje
  const outroSeg = path.join(werkMap, 'outro.mp4');
  await ffmpeg([
    '-loop', '1', '-t', outroDuur.toFixed(2), '-i', plan.outroPng,
    '-filter_complex', `[0:v]fps=${fps},fade=t=in:st=0:d=${(overgang / 2).toFixed(2)},fade=t=out:st=${(outroDuur - 0.7).toFixed(2)}:d=0.7,format=yuv420p[eind]`,
    '-map', '[eind]', ...CODEC, '-y', outroSeg
  ]);
  segmenten.push(outroSeg);

  // Verliesvrij samenvoegen
  const lijst = path.join(werkMap, 'lijst.txt');
  fs.writeFileSync(lijst, segmenten.map(s => `file '${s}'`).join('\n'));
  const uit = path.join(werkMap, 'video.mp4');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', lijst, '-c', 'copy', '-movflags', '+faststart', '-y', uit]);
  fs.copyFileSync(uit, uitPad);
}

async function maakVideo(trekkerId) {
  const data = db.read();
  const t = data.tractors.find(x => x.id === trekkerId);
  if (!t || t.status === 'verwijderd' || !t.fotos || !t.fotos.length) return;
  const bronNu = bron(t);
  if (t.video && t.videoStatus === 'klaar' && t.videoBron === bronNu) return; // al actueel

  // Vangnet tegen eindeloos opnieuw proberen; de uurlijkse bewaker geeft
  // hierna telkens één nieuwe kans, en handmatig kan het altijd via
  // "Video (opnieuw) maken" in het beheer.
  if ((t.videoPogingen || 0) >= MAX_POGINGEN) {
    zetStatus(trekkerId, { videoStatus: 'fout', videoFout: 'meerdere pogingen mislukt — de bewaker probeert het over een uur opnieuw' });
    return;
  }
  zetStatus(trekkerId, { videoStatus: 'bezig', videoFout: '', videoPogingen: (t.videoPogingen || 0) + 1 });
  console.log(`[video] Start: ${t.merk} ${t.model} (${t.fotos.length} foto's)`);
  const start = Date.now();

  const naam = `video-${trekkerId}-${Date.now().toString(36)}.mp4`;
  const uitPad = path.join(uploadsMap(), naam);
  const os = require('os');
  const werkMap = fs.mkdtempSync(path.join(os.tmpdir(), 'agroria-video-'));
  const opdrachtPad = path.join(werkMap, 'opdracht.json');
  fs.writeFileSync(opdrachtPad, JSON.stringify({
    trekker: { merk: t.merk, model: t.model, bouwjaar: t.bouwjaar, uren: t.uren, pk: t.pk, fotos: t.fotos },
    uploadsMap: uploadsMap(),
    werkMap
  }));
  try {
    // Stap 1: beeldwerk in een apart proces (frames, achtergronden, tekst)
    await renderInEigenProces(opdrachtPad);
    // Stap 2: coderen en samenvoegen met ffmpeg (pas ná stap 1)
    const plan = JSON.parse(fs.readFileSync(path.join(werkMap, 'plan.json'), 'utf8'));
    await codeerVideo(plan, uitPad);

    const oud = (db.read().tractors.find(x => x.id === trekkerId) || {}).video;
    zetStatus(trekkerId, { video: naam, videoStatus: 'klaar', videoBron: bronNu, videoFout: '', videoPogingen: 0 });
    if (oud && oud !== naam) verwijderBestand(oud);
    const mb = (fs.statSync(uitPad).size / 1024 / 1024).toFixed(1);
    console.log(`[video] Klaar: ${t.merk} ${t.model} — ${mb} MB, in ${Math.round((Date.now() - start) / 1000)}s gemaakt`);
  } catch (e) {
    verwijderBestand(naam); // half bestand nooit laten staan
    throw e;
  } finally {
    try { fs.rmSync(werkMap, { recursive: true, force: true }); } catch (e) {}
  }
}

module.exports = { controleer, ruimOp, herstelBijOpstarten, bron };
