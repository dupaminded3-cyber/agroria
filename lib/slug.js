/*
 * Maakt nette, leesbare URL's voor trekkers, bijvoorbeeld:
 *   "Case IH Puma 165 CVX"  ->  "case-ih-puma-165-cvx"
 * in plaats van de kale, willekeurige ID.
 */
function maakSlug(tekst) {
  return String(tekst || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // é -> e, ë -> e, enz.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'trekker';
}

// Zorgt dat de slug uniek is binnen de gegeven lijst van al bestaande slugs
// (bijv. "case-ih-puma-165-cvx", "case-ih-puma-165-cvx-2", enz.)
function uniekeSlug(basis, bestaandeSlugs) {
  let slug = basis;
  let teller = 2;
  while (bestaandeSlugs.includes(slug)) {
    slug = basis + '-' + teller;
    teller++;
  }
  return slug;
}

module.exports = { maakSlug, uniekeSlug };
