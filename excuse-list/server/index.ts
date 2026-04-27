import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { WebUntis } from 'webuntis';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const school = process.env.UNTIS_SCHOOL || 'htl-leonding';
const url = process.env.UNTIS_BASE_URL || 'htl-leonding.webuntis.com';
const jwtSecret = process.env.JWT_SECRET || 'super-secret-key-1234';

app.use(cors());
app.use(express.json());

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const untis = new WebUntis(school, username, password, url);


  try {
    await untis.login();
    await untis.logout();

    const token = jwt.sign({ username, password }, jwtSecret, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error('WebUntis login error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/absences', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
try {
  const decoded = jwt.verify(token, jwtSecret) as any;
  console.log(`Attempting to fetch absences for user: ${decoded.username}`);

  const untis = new WebUntis(school, decoded.username, decoded.password, url);

  await untis.login();
  console.log('Untis login successful');

  const startDate = new Date('2025-09-01');
  const endDate = new Date();
  const responseData = await untis.getAbsentLesson(startDate, endDate);
  const absences = responseData.absences || [];
  console.log(`Fetched ${absences.length} total absences`);

  await untis.logout();


  const filteredAbsences = absences.filter((a: any) => {

    return a.isExcused === false && !a.excuseStatus;
  });
  console.log(`Filtered to ${filteredAbsences.length} unexcused absences`);

  res.json(filteredAbsences);
} catch (error: any) {
  console.error('Error fetching absences detail:', error);
  res.status(401).json({ error: 'Unauthorized or error fetching data', details: error.message });
}
});

app.get('/api/getAllStudents', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  let untis: WebUntis | null = null;

  try {
    const decoded = jwt.verify(token, jwtSecret) as { username: string; password: string };

    untis = new WebUntis(school, decoded.username, decoded.password, url);
    await untis.login();

    const students = await untis.getStudents();

    // Nur die Felder, die du im Frontend wirklich brauchst
    const mapped = students.map((s: any) => ({
      id: s.id,
      foreName: s.foreName,
      lastName: s.longName || s.name,
      displayName: `${s.foreName ?? ''} ${s.longName ?? s.name ?? ''}`.trim(),
    }));

    return res.json(mapped);
  } catch (error: any) {
    console.error('Error fetching students:', error);
    return res.status(500).json({
      error: 'Could not fetch students',
      details: error.message,
    });
  } finally {
    if (untis) {
      try {
        await untis.logout();
      } catch {
        // ignore logout errors
      }
    }
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
