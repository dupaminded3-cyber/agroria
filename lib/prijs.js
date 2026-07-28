/*
 * Helpt met de prijsregeling per trekker.
 *
 * - "btw": de opgeslagen prijs is EXCL. BTW. Het bedrag incl. BTW wordt
 *   automatisch berekend met het Nederlandse standaard BTW-tarief (21%),
 *   van toepassing op trekkers en machines.
 * - "marge": de opgeslagen prijs is de enige, totale prijs. Er mag geen BTW
 *   apart vermeld worden (margeregeling voor gebruikte goederen).
 * - "netto": de opgeslagen prijs is netto zonder Nederlandse BTW — voor
 *   afnemers buiten Nederland (bijv. België/EU) waar geen NL-omzetbelasting
 *   in rekening wordt gebracht.
 * - Niets ingesteld (lege/onbekende waarde): toon de prijs zoals voorheen,
 *   zonder BTW-, marge- of netto-vermelding. Zo blijven bestaande trekkers
 *   die nog niet zijn bijgewerkt er precies hetzelfde uitzien als voorheen.
 */
const BTW_PERCENTAGE = 21;

function prijsInfo(t) {
  const type = (t && (t.prijsType === 'btw' || t.prijsType === 'marge' || t.prijsType === 'netto'))
    ? t.prijsType
    : null;
  const bedrag = Number((t && t.prijs) || 0);
  const inclBtw = Math.round(bedrag * (1 + BTW_PERCENTAGE / 100));
  return { type, bedrag, inclBtw, percentage: BTW_PERCENTAGE };
}

module.exports = { prijsInfo, BTW_PERCENTAGE };
