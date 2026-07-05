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
  const naam = `${type}-${crypto.randomBytes(6).toString('hex')}.jpg`;

  const breedte = type === 'logo' ? 600 : 2400;
  await sharp(buffer)
    .rotate()
    .resize({ width: breedte, withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(map, naam));

  return `site/${naam}`;
}

module.exports = { slaOffertefotoOp, verwijderAanvraagFotos, slaSiteAfbeeldingOp };
