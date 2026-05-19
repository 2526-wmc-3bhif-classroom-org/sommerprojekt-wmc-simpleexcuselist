import { WebUntis } from 'webuntis';

const school = process.env.UNTIS_SCHOOL || 'htl-leonding';
const untisHost = process.env.UNTIS_BASE_URL || 'htl-leonding.webuntis.com';

export async function withUntis<T>(
  username: string,
  password: string,
  fn: (untis: WebUntis) => Promise<T>,
): Promise<T> {
  const untis = new WebUntis(school, username, password, untisHost, 'excuse-list');
  await untis.login();
  try {
    return await fn(untis);
  } finally {
    try {
      await untis.logout();
    } catch {}
  }
}

export async function fetchRandomFirstName(): Promise<string> {
  const res = await fetch('https://randomuser.me/api/?inc=name');
  const data = await res.json();
  return data.results[0].name.first;
}

export async function fetchUserDetails(
  untis: WebUntis,
  personType: number,
  personId: number,
  username: string,
) {
  let firstName = username;
  let lastName = '';
  try {
    if (personType === 5) {
      const students = await untis.getStudents();
      const me = students.find((s: any) => s.id === personId);
      if (me) {
        firstName = me.foreName || firstName;
        lastName = me.longName || lastName;
      }
    } else if (personType === 2) {
      const teachers = await untis.getTeachers();
      const me = teachers.find((t: any) => t.id === personId);
      if (me) {
        firstName = me.foreName || firstName;
        lastName = me.longName || lastName;
      }
    }
  } catch (err) {
    console.warn('Could not fetch user master data:', err);
  }
  return { firstName, lastName };
}

export async function fetchUserClassAndNamesFallback(
  untis: WebUntis,
  personId: number,
  currentFirstName: string,
  currentLastName: string,
  username: string,
) {
  let className = 'UNKNOWN';
  let firstName = currentFirstName;
  let lastName = currentLastName;
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);

  const timetable = await untis.getOwnTimetableForRange(start, end);

  for (const lesson of timetable) {
    if (lesson.kl && lesson.kl.length > 0) {
      className = lesson.kl[0].name;
    }

    const me: any =
      lesson.su?.find((s: any) => s.id === personId) ||
      lesson.te?.find((t: any) => t.id === personId);

    if (me) {
      if (firstName === username && me.foreName) firstName = me.foreName;
      if (!lastName && me.longName) lastName = me.longName;
    }

    if (className !== 'UNKNOWN' && lastName !== '') {
      break;
    }
  }
  return { className, firstName, lastName };
}
