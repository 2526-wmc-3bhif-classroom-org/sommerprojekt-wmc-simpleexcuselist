import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { WebUntis } from 'webuntis';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const school = process.env.UNTIS_SCHOOL || 'htl-leonding';
const untisHost = process.env.UNTIS_BASE_URL || 'htl-leonding.webuntis.com';
const jwtSecret = process.env.JWT_SECRET || 'super-secret-key-1234';

async function withUntis<T>(
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

app.use(cors());
app.use(express.json());

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    console.log('Attempting login for:', username);
    await withUntis(username, password, async (untis) => {
      const session = untis.sessionInformation;
      console.log('Logged in, personId:', session?.personId);
    });

    const token = jwt.sign({ username, password }, jwtSecret, { expiresIn: '1h' });
    res.json({ token });
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/absences', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    console.log(`Fetching absences for user: ${decoded.username}`);

    const absences = await withUntis(decoded.username, decoded.password, async (untis) => {
      const startDate = new Date('2025-09-01');
      const endDate = new Date();
      const result = await untis.getAbsentLesson(startDate, endDate, -1);
      return result.absences ?? [];
    });

    console.log(`Fetched ${absences.length} total absences`);

    const unexcused = absences.filter((a) => a.isExcused === false && !a.excuseStatus);
    console.log(`Filtered to ${unexcused.length} unexcused absences`);

    res.json(unexcused);
  } catch (error: any) {
    console.error('Error fetching absences:', error.message);
    res.status(500).json({ error: 'Error fetching absences', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
