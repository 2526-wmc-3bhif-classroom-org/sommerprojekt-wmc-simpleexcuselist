import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { seedMockTeacher } from '../data/teacherRepository';
import authRouter from './authRouter';
import studentRouter from './studentRouter';
import parentRouter from './parentRouter';
import teacherRouter from './teacherRouter';
import attachmentRouter from './attachmentRouter';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(authRouter);
app.use(studentRouter);
app.use(parentRouter);
app.use(teacherRouter);
app.use(attachmentRouter);

app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  await seedMockTeacher();
});
