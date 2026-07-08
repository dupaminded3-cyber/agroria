/*
 * Opgemaakte bevestigingsmail voor de klant na een bestelling — in de
 * huisstijl van Agroria (donkergroen/goud). E-mailprogramma's zijn beperkt,
 * daarom is de opmaak bewust met tabellen en inline-stijlen opgebouwd.
 */

function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function euro(n) {
  return '€ ' + Number(n || 0).toLocaleString('nl-NL');
}

// Bouwt onderwerp, HTML en platte tekst voor de bevestiging van een bestelling.
function bestellingBevestiging(aanvraag, trekker, contact, siteUrl) {
  const naam = aanvraag.naam || '';
  const voornaamwoord = naam ? `Beste ${esc(naam)},` : 'Beste klant,';
  const prijsType = trekker && trekker.prijsType;
  const prijsRegel = aanvraag.prijs
    ? euro(aanvraag.prijs) + (prijsType === 'btw' ? ' excl. BTW' : (prijsType === 'marge' ? ' (margeregeling)' : ''))
    : '';
  const adres = [aanvraag.adres, [aanvraag.postcode, aanvraag.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const gegevens = [
    ['Trekker', aanvraag.trekker],
    prijsRegel ? ['Prijs', prijsRegel] : null,
    ['Naam', aanvraag.naam],
    aanvraag.bedrijf ? ['Bedrijf', aanvraag.bedrijf] : null,
    ['E-mail', aanvraag.email],
    aanvraag.telefoon ? ['Telefoon', aanvraag.telefoon] : null,
    adres ? ['Adres', adres] : null,
    aanvraag.bericht ? ['Uw opmerking', aanvraag.bericht] : null
  ].filter(Boolean);

  const rijen = gegevens.map(([label, waarde]) =>
    `<tr>
      <td style="padding:9px 0;border-bottom:1px solid #E1DDD1;color:#6C7363;font-size:14px;vertical-align:top;width:130px">${esc(label)}</td>
      <td style="padding:9px 0;border-bottom:1px solid #E1DDD1;color:#14180F;font-size:14px;font-weight:600">${esc(waarde)}</td>
    </tr>`).join('');

  const contactRegels = [
    contact && contact.telefoon ? `Telefoon: ${esc(contact.telefoon)}` : '',
    contact && contact.email ? `E-mail: ${esc(contact.email)}` : ''
  ].filter(Boolean).join('<br>');

  const html = `<!DOCTYPE html>
<html lang="nl">
<body style="margin:0;padding:0;background:#F7F6F1;font-family:Georgia,'Times New Roman',serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F1;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #E1DDD1">

        <tr><td style="background:#25402A;padding:30px 40px;text-align:center">
          <div style="color:#C0A063;font-size:24px;letter-spacing:6px;font-weight:bold">AGRORIA</div>
          <div style="color:#D8C49A;font-size:11px;letter-spacing:4px;margin-top:6px">LANDBOUWVOERTUIGEN</div>
        </td></tr>

        <tr><td style="padding:38px 40px 10px">
          <div style="color:#56863F;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;font-family:Arial,sans-serif">Bevestiging van uw bestelling</div>
          <h1 style="color:#14180F;font-size:26px;font-weight:normal;margin:12px 0 0;line-height:1.2">Bedankt voor uw bestelling</h1>
        </td></tr>

        <tr><td style="padding:18px 40px 0;font-family:Arial,sans-serif">
          <p style="color:#3A4137;font-size:15px;line-height:1.65;margin:0">
            ${voornaamwoord}<br><br>
            Hartelijk dank voor uw bestelling bij Agroria Landbouwvoertuigen. Wij hebben uw gegevens in goede orde ontvangen.
            <b>Een specialist van Agroria neemt op korte termijn persoonlijk contact met u op over de koopovereenkomst.</b>
            Tot die overeenkomst rond is, zit u nergens aan vast.
          </p>
        </td></tr>

        <tr><td style="padding:28px 40px 0;font-family:Arial,sans-serif">
          <div style="background:#F1EEE5;border:1px solid #E1DDD1;padding:22px 26px">
            <div style="color:#25402A;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:bold;margin-bottom:10px">Uw gegevens</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rijen}</table>
          </div>
        </td></tr>

        <tr><td style="padding:28px 40px 0;font-family:Arial,sans-serif">
          <p style="color:#3A4137;font-size:15px;line-height:1.65;margin:0">
            Heeft u in de tussentijd vragen? Beantwoord gerust deze e-mail${contact && contact.telefoon ? ` of bel ons op <b>${esc(contact.telefoon)}</b>` : ''} — wij helpen u graag.
          </p>
        </td></tr>

        <tr><td style="padding:30px 40px 38px;font-family:Arial,sans-serif">
          <p style="color:#3A4137;font-size:15px;line-height:1.6;margin:0">
            Met vriendelijke groet,<br>
            <b style="color:#25402A">Team Agroria Landbouwvoertuigen</b>
          </p>
        </td></tr>

        <tr><td style="background:#14180F;padding:22px 40px;text-align:center;font-family:Arial,sans-serif">
          <div style="color:#C7C8B8;font-size:12px;line-height:1.8">
            ${contactRegels ? contactRegels + '<br>' : ''}
            <a href="${esc(siteUrl)}" style="color:#D8C49A;text-decoration:none">${esc(String(siteUrl).replace(/^https?:\/\//, ''))}</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const tekst = [
    `${naam ? 'Beste ' + naam + ',' : 'Beste klant,'}`,
    ``,
    `Hartelijk dank voor uw bestelling bij Agroria Landbouwvoertuigen.`,
    `Wij hebben uw gegevens in goede orde ontvangen. Een specialist van Agroria`,
    `neemt op korte termijn persoonlijk contact met u op over de koopovereenkomst.`,
    `Tot die overeenkomst rond is, zit u nergens aan vast.`,
    ``,
    `Uw gegevens:`,
    ...gegevens.map(([l, w]) => `  ${l}: ${w}`),
    ``,
    `Vragen? Beantwoord deze e-mail${contact && contact.telefoon ? ' of bel ons op ' + contact.telefoon : ''}.`,
    ``,
    `Met vriendelijke groet,`,
    `Team Agroria Landbouwvoertuigen`,
    String(siteUrl || '')
  ].join('\n');

  return {
    onderwerp: `Bevestiging van uw bestelling — ${aanvraag.trekker}`,
    html,
    tekst
  };
}

module.exports = { bestellingBevestiging };
