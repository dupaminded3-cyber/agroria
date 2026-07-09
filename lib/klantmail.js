/*
 * Opgemaakte bevestigingsmails voor de klant — high-end, in de stijl van
 * chic briefpapier: licht ivoorwit met gouden accenten en serif-typografie.
 * Er zijn drie varianten:
 *
 *   - bestellingBevestiging : na een bestelling van een trekker
 *   - inruilBevestiging     : na een inruil/taxatie-aanvraag
 *   - vraagBevestiging      : na een gewone vraag via het contactformulier
 *
 * Alle drie gebruiken dezelfde opgemaakte "brief". E-mailprogramma's
 * (Outlook, Gmail) zijn beperkt; daarom is de opmaak bewust opgebouwd met
 * tabellen en inline-stijlen, en met Georgia als overal beschikbare,
 * elegante serif-letter.
 */

function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function euro(n) {
  return '€ ' + Number(n || 0).toLocaleString('nl-NL');
}

// Bouwt de volledige HTML-mail op basis van de inhoud per variant.
function bouwHtml(o) {
  const gegevensRijen = o.rijen.map(([label, waarde]) =>
    `<tr>
      <td style="padding:11px 0;border-bottom:1px solid #E9E5DA;color:#8A9080;font-size:13px;font-family:Arial,Helvetica,sans-serif;vertical-align:top;width:120px;letter-spacing:.02em">${esc(label)}</td>
      <td style="padding:11px 0;border-bottom:1px solid #E9E5DA;color:#14180F;font-size:14px;font-family:Arial,Helvetica,sans-serif;line-height:1.5">${esc(waarde)}</td>
    </tr>`).join('');

  const stappenRijen = (o.stappen || []).map(([nr, kop, tekst]) =>
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

  const contact = o.contact || {};
  const contactFooter = [
    contact.telefoon ? esc(contact.telefoon) : '',
    contact.email ? esc(contact.email) : ''
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const zakelijkFooter = [
    contact.adres ? esc(contact.adres) : '',
    contact.kvk ? 'KvK ' + esc(contact.kvk) : '',
    contact.btw ? 'BTW ' + esc(contact.btw) : ''
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFEDE6">
  <!-- Voorbeeldtekst in de inbox (onzichtbaar in de mail zelf) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(o.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEDE6;padding:36px 14px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Gouden bovenrand -->
        <tr><td style="height:3px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td></tr>

        <!-- Kop: licht, als chic briefpapier — geen donker vlak meer -->
        <tr><td style="background:#FDFCF9;padding:44px 48px 32px;text-align:center;border-bottom:1px solid #EEEADD">
          ${o.logoUrl ? `
          <img src="${esc(o.logoUrl)}" alt="Agroria Landbouwvoertuigen" width="190" style="width:190px;max-width:70%;height:auto;display:block;margin:0 auto">
          ` : `
          <div style="font-family:Georgia,'Times New Roman',serif;color:#1C3320;font-size:30px;letter-spacing:10px;padding-left:10px">AGRORIA</div>
          <div style="font-family:Arial,Helvetica,sans-serif;color:#8A9080;font-size:10px;letter-spacing:5px;padding-left:5px;margin-top:8px">LANDBOUWVOERTUIGEN</div>
          `}
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:24px"><tr>
            <td style="width:46px;height:1px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td>
          </tr></table>
        </td></tr>

        ${o.fotoUrl ? `
        <!-- Foto van de trekker: groot en vrijstaand, van rand tot rand -->
        <tr><td style="background:#FDFCF9;padding:0;font-size:0;line-height:0">
          <img src="${esc(o.fotoUrl)}" alt="${esc(o.fotoAlt || '')}" width="600" style="width:100%;max-width:600px;height:auto;display:block">
        </td></tr>
        <tr><td style="height:2px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td></tr>` : ''}

        <!-- Inhoud -->
        <tr><td style="background:#FDFCF9;padding:48px 48px 8px">
          <div style="font-family:Arial,Helvetica,sans-serif;color:#56863F;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">${o.eyebrow}</div>
          <div style="font-family:Georgia,'Times New Roman',serif;color:#14180F;font-size:30px;line-height:1.25;margin-top:14px">${o.titelHtml}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr>
            <td style="width:46px;height:1px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td>
          </tr></table>
        </td></tr>

        <tr><td style="background:#FDFCF9;padding:26px 48px 0">
          <p style="font-family:Arial,Helvetica,sans-serif;color:#3A4137;font-size:15px;line-height:1.75;margin:0">
            ${o.aanhef}<br><br>
            ${o.introHtml}
          </p>
        </td></tr>

        <!-- Overzicht van de gegevens -->
        <tr><td style="background:#FDFCF9;padding:36px 48px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1E9;border:1px solid #E5E0D2">
            <tr><td style="padding:30px 34px 26px">
              <div style="font-family:Arial,Helvetica,sans-serif;color:#9A7B4F;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">${o.overzichtKop}</div>
              ${o.overzichtTitel ? `<div style="font-family:Georgia,'Times New Roman',serif;color:#14180F;font-size:22px;margin-top:10px">${esc(o.overzichtTitel)}</div>` : ''}
              ${o.overzichtSub ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#6C7363;font-size:13px;margin-top:6px">${o.overzichtSub}</div>` : ''}
              ${o.prijsHtml || ''}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">${gegevensRijen}</table>
            </td></tr>
          </table>
        </td></tr>

        ${stappenRijen ? `
        <!-- Hoe gaat het verder -->
        <tr><td style="background:#FDFCF9;padding:40px 48px 0">
          <div style="font-family:Arial,Helvetica,sans-serif;color:#56863F;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;margin-bottom:20px">Hoe gaat het verder</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stappenRijen}</table>
        </td></tr>` : ''}

        <!-- Afsluiting -->
        <tr><td style="background:#FDFCF9;padding:18px 48px 48px">
          <p style="font-family:Arial,Helvetica,sans-serif;color:#3A4137;font-size:15px;line-height:1.75;margin:0">
            Heeft u in de tussentijd vragen? Beantwoord gerust deze e-mail${contact.telefoon ? ` of bel ons op <b style="color:#1C3320">${esc(contact.telefoon)}</b>` : ''} — wij helpen u graag.<br><br>
            Met vriendelijke groet,<br>
            <span style="font-family:Georgia,'Times New Roman',serif;color:#1C3320;font-size:17px">Team Agroria Landbouwvoertuigen</span>
          </p>
        </td></tr>

        <!-- Voet — licht en compact, in dezelfde briefpapier-stijl als de kop -->
        <tr><td style="background:#F4F1E9;border-top:1px solid #E5E0D2;padding:28px 48px;text-align:center">
          <div style="font-family:Georgia,'Times New Roman',serif;color:#1C3320;font-size:15px;letter-spacing:5px;padding-left:5px">AGRORIA</div>
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:12px"><tr>
            <td style="width:34px;height:1px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td>
          </tr></table>
          ${contactFooter ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#5B6353;font-size:12px;margin-top:14px;line-height:1.7">${contactFooter}</div>` : ''}
          ${zakelijkFooter ? `<div style="font-family:Arial,Helvetica,sans-serif;color:#8A9080;font-size:11px;margin-top:6px;line-height:1.7">${zakelijkFooter}</div>` : ''}
          <div style="margin-top:8px"><a href="${esc(o.siteUrl)}" style="font-family:Arial,Helvetica,sans-serif;color:#9A7B4F;font-size:12px;text-decoration:none">${esc(String(o.siteUrl).replace(/^https?:\/\//, ''))}</a></div>
        </td></tr>
        <tr><td style="height:3px;background:#C0A063;font-size:0;line-height:0">&nbsp;</td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Bouwt de platte-tekstversie (voor mailprogramma's zonder HTML).
function bouwTekst(o) {
  const contact = o.contact || {};
  return [
    o.aanhefTekst,
    ``,
    ...o.introTekst,
    ``,
    o.overzichtKop.toUpperCase(),
    ...o.tekstRegels.map(r => `  ${r}`),
    ...o.rijen.map(([l, w]) => `  ${l}: ${w}`),
    ``,
    ...((o.stappen || []).length ? [
      `HOE GAAT HET VERDER`,
      ...o.stappen.map(([nr, kop, tekst]) => `  ${nr}. ${kop} — ${tekst.replace(/<[^>]+>/g, '')}`),
      ``
    ] : []),
    `Vragen? Beantwoord deze e-mail${contact.telefoon ? ' of bel ons op ' + contact.telefoon : ''}.`,
    ``,
    `Met vriendelijke groet,`,
    `Team Agroria Landbouwvoertuigen`,
    String(o.siteUrl || ''),
    [
      contact.adres ? contact.adres : '',
      contact.kvk ? 'KvK ' + contact.kvk : '',
      contact.btw ? 'BTW ' + contact.btw : ''
    ].filter(Boolean).join(' · ')
  ].filter(r => r !== null && r !== undefined && r !== '').join('\n');
}

// --- Bevestiging van een bestelling ---
// logoUrl (optioneel): absolute URL van het e-mail-logo (PNG), ingesteld in het beheer.
function bestellingBevestiging(aanvraag, trekker, contact, siteUrl, logoUrl) {
  const naam = aanvraag.naam || '';
  const prijsType = trekker && trekker.prijsType;
  const prijsSub = prijsType === 'btw' ? 'excl. BTW' : (prijsType === 'marge' ? 'margeregeling — geen BTW' : '');
  const adres = [aanvraag.adres, [aanvraag.postcode, aanvraag.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const fotoUrl = (trekker && trekker.fotos && trekker.fotos[0])
    ? `${siteUrl}/uploads/${trekker.fotos[0]}`
    : '';
  const specs = trekker
    ? [trekker.bouwjaar ? `Bouwjaar ${trekker.bouwjaar}` : '', trekker.uren ? `${Number(trekker.uren).toLocaleString('nl-NL')} werkuren` : '', trekker.pk ? `${trekker.pk} pk` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')
    : '';

  const rijen = [
    ['Naam', aanvraag.naam],
    aanvraag.bedrijf ? ['Bedrijf', aanvraag.bedrijf] : null,
    ['E-mail', aanvraag.email],
    aanvraag.telefoon ? ['Telefoon', aanvraag.telefoon] : null,
    adres ? ['Adres', adres] : null,
    aanvraag.bericht ? ['Uw opmerking', aanvraag.bericht] : null
  ].filter(Boolean);

  const stappen = [
    ['1', 'Persoonlijk contact', 'Een specialist van Agroria neemt op korte termijn contact met u op.'],
    ['2', 'Koopovereenkomst', 'Samen ronden we de koopovereenkomst af — tot die tijd zit u nergens aan vast.'],
    ['3', 'Levering', 'Uw trekker wordt kosteloos geleverd, tot op het erf.']
  ];

  const html = bouwHtml({
    preheader: 'Uw bestelling is in goede orde ontvangen — een specialist van Agroria neemt persoonlijk contact met u op.',
    logoUrl, fotoUrl, fotoAlt: aanvraag.trekker,
    eyebrow: 'Bevestiging van uw bestelling',
    titelHtml: 'Hartelijk dank<br>voor uw bestelling',
    aanhef: naam ? `Beste ${esc(naam)},` : 'Beste klant,',
    introHtml: `Wij hebben uw bestelling in goede orde ontvangen — dank voor het vertrouwen in Agroria Landbouwvoertuigen.
            Een <b>specialist van Agroria</b> neemt op korte termijn persoonlijk contact met u op over de koopovereenkomst.
            Tot die overeenkomst rond is, zit u nergens aan vast.`,
    overzichtKop: 'Uw bestelling',
    overzichtTitel: aanvraag.trekker,
    overzichtSub: specs,
    prijsHtml: aanvraag.prijs ? `
              <div style="font-family:Georgia,'Times New Roman',serif;color:#1C3320;font-size:26px;margin-top:16px">${euro(aanvraag.prijs)}
                ${prijsSub ? `<span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8A9080">&nbsp;${prijsSub}</span>` : ''}
              </div>` : '',
    rijen, stappen, contact, siteUrl
  });

  const tekst = bouwTekst({
    aanhefTekst: naam ? 'Beste ' + naam + ',' : 'Beste klant,',
    introTekst: [
      `Wij hebben uw bestelling in goede orde ontvangen — dank voor het`,
      `vertrouwen in Agroria Landbouwvoertuigen. Een specialist van Agroria`,
      `neemt op korte termijn persoonlijk contact met u op over de`,
      `koopovereenkomst. Tot die overeenkomst rond is, zit u nergens aan vast.`
    ],
    overzichtKop: 'Uw bestelling',
    tekstRegels: [
      `Trekker: ${aanvraag.trekker}`,
      aanvraag.prijs ? `Prijs: ${euro(aanvraag.prijs)}${prijsSub ? ' (' + prijsSub + ')' : ''}` : ''
    ].filter(Boolean),
    rijen, stappen, contact, siteUrl
  });

  return {
    onderwerp: `Bevestiging van uw bestelling — ${aanvraag.trekker}`,
    html,
    tekst
  };
}

// --- Bevestiging van een inruil/taxatie-aanvraag ---
function inruilBevestiging(aanvraag, contact, siteUrl, logoUrl) {
  const naam = aanvraag.naam || '';
  const machine = aanvraag.machine || 'uw machine';
  const specs = [
    aanvraag.bouwjaar ? `Bouwjaar ${esc(aanvraag.bouwjaar)}` : '',
    aanvraag.uren ? `${esc(aanvraag.uren)} werkuren` : '',
    (aanvraag.fotos && aanvraag.fotos.length) ? `${aanvraag.fotos.length} foto${aanvraag.fotos.length === 1 ? '' : "'s"} meegestuurd` : ''
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const rijen = [
    ['Naam', aanvraag.naam],
    ['E-mail', aanvraag.email],
    aanvraag.telefoon ? ['Telefoon', aanvraag.telefoon] : null,
    aanvraag.bericht ? ['Uw toelichting', aanvraag.bericht] : null
  ].filter(Boolean);

  const stappen = [
    ['1', 'Beoordeling', 'Een specialist van Agroria bekijkt de gegevens en foto\u2019s van uw machine.'],
    ['2', 'Taxatie binnen 24 uur', 'U ontvangt een eerlijk, onderbouwd bod — geheel vrijblijvend.'],
    ['3', 'Afronding', 'Bent u akkoord? Dan regelen wij de verdere afwikkeling, van papierwerk tot ophalen.']
  ];

  const html = bouwHtml({
    preheader: 'Uw inruil-aanvraag is ontvangen — binnen 24 uur ontvangt u een vrijblijvende taxatie van Agroria.',
    logoUrl, fotoUrl: '',
    eyebrow: 'Bevestiging van uw inruil-aanvraag',
    titelHtml: 'Hartelijk dank<br>voor uw aanvraag',
    aanhef: naam ? `Beste ${esc(naam)},` : 'Beste klant,',
    introHtml: `Wij hebben uw inruil-aanvraag in goede orde ontvangen — dank voor het vertrouwen in Agroria Landbouwvoertuigen.
            Een <b>specialist van Agroria</b> beoordeelt uw machine en u ontvangt <b>binnen 24 uur</b> een vrijblijvende taxatie.
            U zit nergens aan vast.`,
    overzichtKop: 'Uw machine',
    overzichtTitel: machine,
    overzichtSub: specs,
    rijen, stappen, contact, siteUrl
  });

  const tekst = bouwTekst({
    aanhefTekst: naam ? 'Beste ' + naam + ',' : 'Beste klant,',
    introTekst: [
      `Wij hebben uw inruil-aanvraag in goede orde ontvangen — dank voor het`,
      `vertrouwen in Agroria Landbouwvoertuigen. Een specialist van Agroria`,
      `beoordeelt uw machine en u ontvangt binnen 24 uur een vrijblijvende`,
      `taxatie. U zit nergens aan vast.`
    ],
    overzichtKop: 'Uw machine',
    tekstRegels: [
      `Machine: ${machine}`,
      aanvraag.bouwjaar ? `Bouwjaar: ${aanvraag.bouwjaar}` : '',
      aanvraag.uren ? `Uren: ${aanvraag.uren}` : '',
      (aanvraag.fotos && aanvraag.fotos.length) ? `Foto's meegestuurd: ${aanvraag.fotos.length}` : ''
    ].filter(Boolean),
    rijen, stappen, contact, siteUrl
  });

  return {
    onderwerp: `Bevestiging van uw inruil-aanvraag — ${machine}`,
    html,
    tekst
  };
}

// --- Bevestiging van een gewone vraag (contactformulier) ---
function vraagBevestiging(aanvraag, contact, siteUrl, logoUrl) {
  const naam = aanvraag.naam || '';

  const rijen = [
    aanvraag.trekker ? ['Trekker', aanvraag.trekker] : null,
    ['Naam', aanvraag.naam],
    ['E-mail', aanvraag.email],
    aanvraag.telefoon ? ['Telefoon', aanvraag.telefoon] : null,
    aanvraag.bericht ? ['Uw bericht', aanvraag.bericht] : null
  ].filter(Boolean);

  const stappen = [
    ['1', 'Persoonlijk antwoord', 'Een specialist van Agroria leest uw bericht en neemt persoonlijk contact met u op.'],
    ['2', 'Samen verder', 'Wij denken met u mee en helpen u graag verder — vrijblijvend en zonder verplichtingen.']
  ];

  const html = bouwHtml({
    preheader: 'Uw bericht is in goede orde ontvangen — een specialist van Agroria neemt persoonlijk contact met u op.',
    logoUrl, fotoUrl: '',
    eyebrow: 'Bevestiging van uw bericht',
    titelHtml: 'Bedankt<br>voor uw bericht',
    aanhef: naam ? `Beste ${esc(naam)},` : 'Beste klant,',
    introHtml: `Wij hebben uw bericht in goede orde ontvangen — dank voor uw interesse in Agroria Landbouwvoertuigen.
            Een <b>specialist van Agroria</b> neemt zo spoedig mogelijk, doorgaans binnen één werkdag, persoonlijk contact met u op.`,
    overzichtKop: 'Uw bericht',
    overzichtTitel: aanvraag.onderwerp || 'Algemene vraag',
    overzichtSub: '',
    rijen, stappen, contact, siteUrl
  });

  const tekst = bouwTekst({
    aanhefTekst: naam ? 'Beste ' + naam + ',' : 'Beste klant,',
    introTekst: [
      `Wij hebben uw bericht in goede orde ontvangen — dank voor uw`,
      `interesse in Agroria Landbouwvoertuigen. Een specialist van Agroria`,
      `neemt zo spoedig mogelijk, doorgaans binnen één werkdag, persoonlijk`,
      `contact met u op.`
    ],
    overzichtKop: 'Uw bericht',
    tekstRegels: [
      `Onderwerp: ${aanvraag.onderwerp || 'Algemene vraag'}`,
      aanvraag.trekker ? `Trekker: ${aanvraag.trekker}` : ''
    ].filter(Boolean),
    rijen, stappen, contact, siteUrl
  });

  return {
    onderwerp: `Wij hebben uw bericht ontvangen — Agroria Landbouwvoertuigen`,
    html,
    tekst
  };
}

module.exports = { bestellingBevestiging, inruilBevestiging, vraagBevestiging };
