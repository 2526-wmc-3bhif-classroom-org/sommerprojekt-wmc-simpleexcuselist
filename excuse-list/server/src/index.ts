// Must be first: loads .env and validates required vars before any router
// module reads process.env.
import { env } from '../config/env';
import express from 'express';
import cors from 'cors';
import authRouter from './authRouter';
import studentRouter from './studentRouter';
import parentRouter from './parentRouter';
import teacherRouter from './teacherRouter';
import attachmentRouter from './attachmentRouter';

const app = express();
const port = env.port;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(authRouter);
app.use(studentRouter);
app.use(parentRouter);
app.use(teacherRouter);
app.use(attachmentRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
