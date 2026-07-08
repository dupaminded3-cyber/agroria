/*
 * Opgemaakte bevestigingsmail voor de klant na een bestelling — high-end,
 * in de huisstijl van Agroria (donkergroen, goud, serif-typografie).
 *
 * E-mailprogramma's (Outlook, Gmail) zijn beperkt; daarom is de opmaak
 * bewust opgebouwd met tabellen en inline-stijlen, en met Georgia als
 * overal beschikbare, elegante serif-letter.
 */

function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function euro(n) {
  return '€ ' + Number(n || 0).toLocaleString('nl-NL');
}

// Bouwt onderwerp, HTML en platte tekst voor de bevestiging van een bestelling.
// logoUrl (optioneel): absolute URL van het e-mail-logo (PNG), ingesteld in het beheer.
function bestellingBevestiging(aanvraag, trekker, contact, siteUrl, logoUrl) {
  const naam = aanvraag.naam || '';
  const aanhef = naam ? `Beste ${esc(naam)},` : 'Beste klant,';
  const prijsType = trekker && trekker.prijsType;
  const prijsSub = prijsType === 'btw' ? 'excl. BTW' : (prijsType === 'marge' ? 'margeregeling — geen BTW' : '');
  const adres = [aanvraag.adres, [aanvraag.postcode, aanvraag.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const fotoUrl = (trekker && trekker.fotos && trekker.fotos[0])
    ? `${siteUrl}/uploads/${trekker.fotos[0]}`
    : '';
  const specs = trekker
    ? [trekker.bouwjaar ? `Bouwjaar ${trekker.bouwjaar}` : '', trekker.uren ? `${Number(trekker.uren).toLocaleString('nl-NL')} werkuren` : '', trekker.pk ? `${trekker.pk} pk` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')
    : '';

  const klantGegevens = [
    ['Naam', aanvraag.naam],
    aanvraag.bedrijf ? ['Bedrijf', aanvraag.bedrijf] : null,
    ['E-mail', aanvraag.email],
    aanvraag.telefoon ? ['Telefoon', aanvraag.telefoon] : null,
    adres ? ['Adres', adres] : null,
    aanvraag.bericht ? ['Uw opmerking', aanvraag.bericht] : null
  ].filter(Boolean);

  const gegevensRijen = klantGegevens.map(([label, waarde]) =>
    `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #E9E5DA;color:#8A9080;font-size:13px;font-family:Arial,Helvetica,sans-serif;vertical-align:top;width:120px;letter-spacing:.02em">${esc(label)}</td>
      <td style="padding:11px 0;border-bottom:1px solid #E9E5DA;color:#14180F;font-size:14px;font-family:Arial,Helvetica,sans-serif;line-height:1.5">${esc(waarde)}</td>
    </tr>`).join('');

  const stappen = [
    ['1', 'Persoonlijk contact', 'Een specialist van Agroria neemt op korte termijn contact met u op.'],
    ['2', 'Koopovereenkomst', 'Samen ronden we de koopovereenkomst af — tot die tijd zit u nergens aan vast.'],
    ['3', 'Levering', 'Uw trekker wordt kosteloos geleverd, tot op het erf.']
  ].map(([nr, kop, tekst]) =>
    `<tr>
      <td style="width:44px;vertical-align:top;padding:0 0 22px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:30px;height:30px;background:#25402A;color:#D8C49A;text-align:center;font-family:Georgia,serif;font-size:15px;line-height:30px;border-radius:15px">${nr}</td>
        </tr></table>
      </td>
      <td style="vertical-align:top;padding:2px 0 22px">
        <div style="font-family:Georgia,serif;font-size:16px;color:#14180F">${kop}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6C7363;line-height:1.6;margin-top:3px">${tekst}</div>
      </td>
    </tr>`).join('');

  const contactFooter = [
    contact && contact.telefoon ? esc(contact.telefoon) : '',
    contact && contact.email ? esc(contact.email) : ''
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const zakelijkFooter = [
    contact && contact.adres ? esc(contact.adres) : '',
    contact && contact.kvk ? 'KvK ' + esc(contact.kvk) : '',
    contact && contact.btw ? 'BTW ' + esc(contact.btw) : ''
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFEDE6">
  <!-- Voorbeeldtekst in de inbox (onzichtbaar in de mail zelf) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Uw bestelling is in goede orde ontvangen — een specialist van Agroria neemt persoonlijk contact met u op.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEDE6;padding:36px 14px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Gouden bovenrand -->
        <tr><td style="height:3px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td></tr>

        <!-- Kop -->
        <tr><td style="background:#1C3320;padding:40px 48px 34px;text-align:center">
          ${logoUrl ? `
          <img src="${esc(logoUrl)}" alt="Agroria Landbouwvoertuigen" width="190" style="width:190px;max-width:70%;height:auto;display:block;margin:0 auto">
          ` : `
          <div style="font-family:Georgia,'Times New Roman',serif;color:#D8C49A;font-size:30px;letter-spacing:10px;padding-left:10px">AGRORIA</div>
          <div style="font-family:Arial,Helvetica,sans-serif;color:#8FA383;font-size:10px;letter-spacing:5px;padding-left:5px;margin-top:8px">LANDBOUWVOERTUIGEN</div>
          `}
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:22px"><tr>
            <td style="width:46px;height:1px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td>
          </tr></table>
        </td></tr>

        ${fotoUrl ? `
        <!-- Foto van de bestelde trekker -->
        <tr><td style="background:#1C3320;padding:0 48px 0;font-size:0;line-height:0">
          <img src="${esc(fotoUrl)}" alt="${esc(aanvraag.trekker)}" width="504" style="width:100%;max-width:504px;height:auto;display:block;border:1px solid #33402B">
        </td></tr>
        <tr><td style="background:#1C3320;height:42px;font-size:0;line-height:0">&nbsp;</td></tr>` : ''}

        <!-- Inhoud -->
        <tr><td style="background:#FDFCF9;padding:48px 48px 8px">
          <div style="font-family:Arial,Helvetica,sans-serif;color:#56863F;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">Bevestiging van uw bestelling</div>
          <div style="font-family:Georgia,'Times New Roman',serif;color:#14180F;font-size:30px;line-height:1.25;margin-top:14px">Hartelijk dank<br>voor uw bestelling</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr>
            <td style="width:46px;height:1px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td>
          </tr></table>
        </td></tr>

        <tr><td style="background:#FDFCF9;padding:26px 48px 0">
          <p style="font-family:Arial,Helvetica,sans-serif;color:#3A4137;font-size:15px;line-height:1.75;margin:0">
            ${aanhef}<br><br>
            Wij hebben uw bestelling in goede orde ontvangen — dank voor het vertrouwen in Agroria Landbouwvoertuigen.
            Een <b>specialist van Agroria</b> neemt op korte termijn persoonlijk contact met u op over de koopovereenkomst.
            Tot die overeenkomst rond is, zit u nergens aan vast.
          </p>
        </td></tr>

        <!-- Besteloverzicht -->
        <tr><td style="background:#FDFCF9;padding:36px 48px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1E9;border:1px solid #E5E0D2">
            <tr><td style="padding:30px 34px 26px">
              <div style="font-family:Arial,Helvetica,sans-serif;color:#9A7B4F;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">Uw bestelling</div>
              <div style="font-family:Georgia,'Times New Roman',serif;color:#14180F;font-size:22px;margin-top:10px">${esc(aanvraag.trekker)}</div>
              ${specs ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#6C7363;font-size:13px;margin-top:6px">${specs}</div>` : ''}
              ${aanvraag.prijs ? `
              <div style="font-family:Georgia,'Times New Roman',serif;color:#1C3320;font-size:26px;margin-top:16px">${euro(aanvraag.prijs)}
                ${prijsSub ? `<span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8A9080">&nbsp;${prijsSub}</span>` : ''}
              </div>` : ''}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">${gegevensRijen}</table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Hoe gaat het verder -->
        <tr><td style="background:#FDFCF9;padding:40px 48px 0">
          <div style="font-family:Arial,Helvetica,sans-serif;color:#56863F;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;margin-bottom:20px">Hoe gaat het verder</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stappen}</table>
        </td></tr>

        <!-- Afsluiting -->
        <tr><td style="background:#FDFCF9;padding:18px 48px 48px">
          <p style="font-family:Arial,Helvetica,sans-serif;color:#3A4137;font-size:15px;line-height:1.75;margin:0">
            Heeft u in de tussentijd vragen? Beantwoord gerust deze e-mail${contact && contact.telefoon ? ` of bel ons op <b style="color:#1C3320">${esc(contact.telefoon)}</b>` : ''} — wij helpen u graag.<br><br>
            Met vriendelijke groet,<br>
            <span style="font-family:Georgia,'Times New Roman',serif;color:#1C3320;font-size:17px">Team Agroria Landbouwvoertuigen</span>
          </p>
        </td></tr>

        <!-- Voet — bewust compact: alleen het gouden woordmerk, geen logo -->
        <tr><td style="background:#14180F;padding:26px 48px;text-align:center">
          <div style="font-family:Georgia,'Times New Roman',serif;color:#D8C49A;font-size:15px;letter-spacing:5px;padding-left:5px">AGRORIA</div>
          ${contactFooter ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#DDE7D6;font-size:12px;margin-top:14px;line-height:1.7">${contactFooter}</div>` : ''}
          ${zakelijkFooter ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#B8C4AC;font-size:11px;margin-top:6px;line-height:1.7">${zakelijkFooter}</div>` : ''}
          <div style="margin-top:8px"><a href="${esc(siteUrl)}" style="font-family:Arial,Helvetica,sans-serif;color:#C0A063;font-size:12px;text-decoration:none">${esc(String(siteUrl).replace(/^https?:\/\//, ''))}</a></div>
        </td></tr>
        <tr><td style="height:3px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const tekst = [
    `${naam ? 'Beste ' + naam + ',' : 'Beste klant,'}`,
    ``,
    `Wij hebben uw bestelling in goede orde ontvangen — dank voor het`,
    `vertrouwen in Agroria Landbouwvoertuigen. Een specialist van Agroria`,
    `neemt op korte termijn persoonlijk contact met u op over de`,
    `koopovereenkomst. Tot die overeenkomst rond is, zit u nergens aan vast.`,
    ``,
    `UW BESTELLING`,
    `  Trekker: ${aanvraag.trekker}`,
    aanvraag.prijs ? `  Prijs: ${euro(aanvraag.prijs)}${prijsSub ? ' (' + prijsSub + ')' : ''}` : '',
    ...klantGegevens.map(([l, w]) => `  ${l}: ${w}`),
    ``,
    `HOE GAAT HET VERDER`,
    `  1. Persoonlijk contact — een specialist neemt contact met u op.`,
    `  2. Koopovereenkomst — samen ronden we de overeenkomst af.`,
    `  3. Levering — uw trekker wordt kosteloos geleverd, tot op het erf.`,
    ``,
    `Vragen? Beantwoord deze e-mail${contact && contact.telefoon ? ' of bel ons op ' + contact.telefoon : ''}.`,
    ``,
    `Met vriendelijke groet,`,
    `Team Agroria Landbouwvoertuigen`,
    String(siteUrl || ''),
    [
      contact && contact.adres ? contact.adres : '',
      contact && contact.kvk ? 'KvK ' + contact.kvk : '',
      contact && contact.btw ? 'BTW ' + contact.btw : ''
    ].filter(Boolean).join(' · ')
  ].filter(r => r !== null && r !== undefined && r !== '').join('\n');

  return {
    onderwerp: `Bevestiging van uw bestelling — ${aanvraag.trekker}`,
    html,
    tekst
  };
}

module.exports = { bestellingBevestiging };
