/*
 * E-mailmeldingen bij nieuwe aanvragen (vraag, inruil, bestelling).
 *
 * Werkt via SMTP — de verzendgegevens van je eigen mailbox (bijv. bij Strato).
 * Instellen via omgevingsvariabelen (op Render onder Environment):
 *   SMTP_HOST  bijv. smtp.strato.de
 *   SMTP_PORT  meestal 465
 *   SMTP_USER  bijv. info@agroria.nl
 *   SMTP_PASS  het wachtwoord van die mailbox
 *   MAIL_NAAR  waar de meldingen heen moeten (standaard: gelijk aan SMTP_USER)
 *
 * Zijn deze niet ingesteld, dan doet de site het gewoon — er worden dan
 * simpelweg geen mails gestuurd (en het beheer toont een hint).
 */
const nodemailer = require('nodemailer');

const HOST = (process.env.SMTP_HOST || '').trim();
const PORT = parseInt(process.env.SMTP_PORT) || 465;
const USER = (process.env.SMTP_USER || '').trim();
const PASS = process.env.SMTP_PASS || '';
const NAAR = (process.env.MAIL_NAAR || '').trim() || USER;

const actief = !!(HOST && USER && PASS && NAAR);

let transporter = null;
if (actief) {
  transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS }
  });
}

// Verstuurt een melding; blokkeert nooit de website (fouten worden alleen gelogd).
function stuurMelding(onderwerp, tekst) {
  if (!actief) return Promise.resolve(false);
  return transporter.sendMail({
    from: `"Agroria website" <${USER}>`,
    to: NAAR,
    subject: onderwerp,
    text: tekst
  }).then(() => true).catch(err => {
    console.error('E-mailmelding kon niet worden verstuurd:', err.message);
    return false;
  });
}

module.exports = { stuurMelding, actief };
