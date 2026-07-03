/*
 * Zet het wachtwoord van "root" terug op een bekend wachtwoord.
 * Gebruik dit als je niet meer kunt inloggen.
 *
 * Typ in het opdrachtvenster (in de projectmap):
 *     npm run wachtwoord
 * Daarna kun je inloggen met gebruikersnaam "root" en wachtwoord "agroria".
 *
 * Wil je een eigen wachtwoord? Geef het mee, bijvoorbeeld:
 *     npm run wachtwoord -- MijnWachtwoord
 */
const bcrypt = require('bcryptjs');
const db = require('./db');

const nieuw = process.argv[2] || process.env.ADMIN_PASSWORD || 'agroria';
const data = db.read();

if (!data.users || data.users.length === 0) {
  data.users = [{
    id: db.id(), username: 'root', email: 'info@agroria.nl', name: 'Beheerder',
    passwordHash: bcrypt.hashSync(nieuw, 10), createdAt: new Date().toISOString()
  }];
} else {
  const root = data.users.find(u => u.username === 'root') || data.users[0];
  root.passwordHash = bcrypt.hashSync(nieuw, 10);
}
db.write(data);

console.log('\n────────────────────────────────────────────────');
console.log('• Wachtwoord opnieuw ingesteld.');
console.log('  Gebruikersnaam: root');
console.log('  Wachtwoord:     ' + nieuw);
console.log('  Start de site nu met:  npm start');
console.log('────────────────────────────────────────────────\n');
