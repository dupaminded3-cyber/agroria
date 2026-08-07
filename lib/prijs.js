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

/**
 * Rekent excl. → BTW → incl. uit voor facturen/overeenkomsten.
 *
 * Het bedrag incl. BTW wordt op hele euro's afgerond (zelfde regel als de
 * website-prijs), waarna de BTW het restant is. Zo telt excl. + BTW altijd
 * exact op tot het incl.-bedrag — bijv. €12.396,69 + €2.603,31 = €15.000,00
 * in plaats van €14.999,99 door dubbele cent-afronding.
 */
function btwVanExcl(excl) {
  const subtotaal = Math.round(Number(excl || 0) * 100) / 100;
  const totaal = Math.round(subtotaal * (1 + BTW_PERCENTAGE / 100));
  const btw = Math.round((totaal - subtotaal) * 100) / 100;
  return { subtotaal, btw, totaal };
}

function prijsInfo(t) {
  const type = (t && (t.prijsType === 'btw' || t.prijsType === 'marge' || t.prijsType === 'netto'))
    ? t.prijsType
    : null;
  const bedrag = Number((t && t.prijs) || 0);
  const inclBtw = btwVanExcl(bedrag).totaal;
  return { type, bedrag, inclBtw, percentage: BTW_PERCENTAGE };
}

module.exports = { prijsInfo, BTW_PERCENTAGE, btwVanExcl };
