/**
 * SEO-hulpmiddelen: merksuggesties, XML-escape, adres parsing, landingscopy.
 */

const { maakSlug } = require('./slug');

const SEO_MERKEN = [
  'John Deere',
  'Fendt',
  'Case IH',
  'New Holland',
  'Claas',
  'Deutz-Fahr',
  'Massey Ferguson',
  'Valtra',
  'McCormick'
];

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function merkSlug(merk) {
  return maakSlug(merk);
}

function vindMerk(slug, merken) {
  const s = String(slug || '').toLowerCase();
  return (merken || []).find(m => merkSlug(m) === s) || null;
}

/** Probeer "Straat 12, 1234AB Plaats" te splitsen voor schema.org. */
function parseAdres(adres) {
  const raw = String(adres || '').trim();
  if (!raw) return undefined;
  const m = raw.match(/^(.+?),\s*(\d{4}\s?[A-Z]{2})\s+(.+)$/i);
  if (m) {
    return {
      '@type': 'PostalAddress',
      streetAddress: m[1].trim(),
      postalCode: m[2].replace(/\s+/g, '').toUpperCase(),
      addressLocality: m[3].trim(),
      addressCountry: 'NL'
    };
  }
  return {
    '@type': 'PostalAddress',
    streetAddress: raw,
    addressCountry: 'NL'
  };
}

function merkSeo(merk) {
  return {
    titel: `${merk} trekkers kopen — tweedehands met garantie`,
    beschrijving:
      `Tweedehands ${merk} trekkers kopen bij Agroria. Gecontroleerde historie, ` +
      `12 maanden garantie en gratis transport in Nederland, Duitsland en België. ` +
      `Bekijk het actuele ${merk}-aanbod.`,
    h1: `${merk} trekkers`,
    intro:
      `Op zoek naar een betrouwbare tweedehands ${merk} trekker? Bij Agroria ` +
      `selecteren wij elke machine zorgvuldig: technische staat, historie en ` +
      `onderhoud. Alle ${merk} trekkers worden geleverd met 12 maanden garantie ` +
      `en gratis transport in NL, DE & BE.`
  };
}

module.exports = {
  SEO_MERKEN,
  xmlEscape,
  merkSlug,
  vindMerk,
  parseAdres,
  merkSeo
};
