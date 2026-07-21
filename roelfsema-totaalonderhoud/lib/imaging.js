const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { UPLOADS_DIR } = require('./db');

function veiligeMap(submap) {
  const doel = path.join(UPLOADS_DIR, submap);
  if (!fs.existsSync(doel)) fs.mkdirSync(doel, { recursive: true });
  return doel;
}

async function slaOffertefotoOp(buffer, aanvraagId) {
  const map = veiligeMap(path.join('aanvragen', aanvraagId));
  const naam = crypto.randomBytes(8).toString('hex');

  const bestand = `${naam}.jpg`;
  const thumb = `${naam}-thumb.jpg`;

  await sharp(buffer)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(map, bestand));

  await sharp(buffer)
    .rotate()
    .resize({ width: 480, height: 480, fit: 'cover' })
    .jpeg({ quality: 75, mozjpeg: true })
    .toFile(path.join(map, thumb));

  return {
    bestand: `aanvragen/${aanvraagId}/${bestand}`,
    thumb: `aanvragen/${aanvraagId}/${thumb}`,
  };
}

async function verwijderAanvraagFotos(aanvraagId) {
  const map = path.join(UPLOADS_DIR, 'aanvragen', aanvraagId);
  if (fs.existsSync(map)) {
    fs.rmSync(map, { recursive: true, force: true });
  }
}

async function slaSiteAfbeeldingOp(buffer, type) {
  const map = veiligeMap('site');
  const extensie = type === 'logo' ? 'png' : 'jpg';
  const naam = `${type}-${crypto.randomBytes(6).toString('hex')}.${extensie}`;

  const pipeline = sharp(buffer).rotate();

  if (type === 'logo') {
    // Logo's: transparantie behouden + transparante randen wegsnijden
    // zodat ze in de header niet \"mini\" ogen door veel lege marge.
    await pipeline
      .ensureAlpha()
      .trim({ threshold: 1 })
      .resize({
        width: 880,
        height: 260,
        fit: 'inside',
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(path.join(map, naam));
  } else {
    await pipeline
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(path.join(map, naam));
  }

  return `site/${naam}`;
}

async function slaProjectAfbeeldingOp(buffer) {
  const map = veiligeMap('projecten');
  const naam = `project-${crypto.randomBytes(7).toString('hex')}.jpg`;

  await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1200, fit: 'cover' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(path.join(map, naam));

  return `projecten/${naam}`;
}

function verwijderUpload(relatievePad) {
  if (!relatievePad) return;
  // Bescherm tegen path traversal: alleen binnen UPLOADS_DIR verwijderen.
  const doel = path.join(UPLOADS_DIR, relatievePad);
  const genormaliseerd = path.normalize(doel);
  if (!genormaliseerd.startsWith(UPLOADS_DIR)) return;
  if (fs.existsSync(genormaliseerd) && fs.statSync(genormaliseerd).isFile()) {
    fs.rmSync(genormaliseerd, { force: true });
  }
}

module.exports = {
  slaOffertefotoOp,
  verwijderAanvraagFotos,
  slaSiteAfbeeldingOp,
  slaProjectAfbeeldingOp,
  verwijderUpload,
};
