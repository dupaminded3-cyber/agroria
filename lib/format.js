/*
 * Zet de omschrijving van een trekker om naar veilige, nette HTML.
 *
 * Twee manieren om te typen:
 *  1. Gewone tekst met Enter/witregels — die blijven gewoon behouden.
 *  2. HTML-tags zoals <h2>, <p>, <ul>, <li>, <strong>, <br> — die worden
 *     écht weergegeven (kopjes, lijstjes, vet), voor nette advertenties.
 *
 * Alles wat niet op de toegestane lijst staat (bijv. <script>) wordt
 * automatisch verwijderd, zodat het altijd veilig blijft.
 */
const sanitizeHtml = require('sanitize-html');

const OPTIES = {
  allowedTags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' })
  }
};

function escapeHtml(tekst) {
  return String(tekst)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function omschrijvingHtml(raw) {
  const tekst = (raw || '').trim();
  if (!tekst) return '';

  const bevatHtml = /<[a-z][\s\S]*>/i.test(tekst);
  const bron = bevatHtml
    ? tekst
    : escapeHtml(tekst).replace(/\r\n/g, '\n').split('\n').join('<br>\n');

  return sanitizeHtml(bron, OPTIES).trim();
}

// Platte-tekstversie (zonder HTML) — voor SEO-meta en zoekmachine-data (JSON-LD),
// die geen HTML-opmaak horen te bevatten.
function omschrijvingText(raw) {
  const tekst = (raw || '').trim();
  if (!tekst) return '';
  return sanitizeHtml(tekst, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { omschrijvingHtml, omschrijvingText };
