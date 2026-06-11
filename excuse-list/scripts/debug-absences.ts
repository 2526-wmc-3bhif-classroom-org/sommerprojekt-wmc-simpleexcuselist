// Debug helper: prints the raw WebUntis absence payload so we can see where
// the excuse status actually lives. Nothing is written to the database.
//
// Usage: npx tsx scripts/debug-absences.ts <untis-username> <untis-password>

import { WebUntis } from '../server/data/untisClient';

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error('Usage: npx tsx scripts/debug-absences.ts <username> <password>');
  process.exit(1);
}

const school = process.env.UNTIS_SCHOOL || 'htl-leonding';
const host = process.env.UNTIS_BASE_URL || 'htl-leonding.webuntis.com';

const untis = new WebUntis(school, username, password, host, 'excuse-list');

try {
  await untis.login();
  const result = await untis.getAbsentLesson(new Date('2025-09-01'), new Date());
  console.log(JSON.stringify(result, null, 2));
} finally {
  await untis.logout().catch(() => {});
}
