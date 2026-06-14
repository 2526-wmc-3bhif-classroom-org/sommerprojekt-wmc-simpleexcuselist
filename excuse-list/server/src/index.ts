// Must be first: loads .env and validates required vars before any router
// module reads process.env.
import { env } from '../config/env';
import express from 'express';
import authRouter from './authRouter';
import studentRouter from './studentRouter';
import parentRouter from './parentRouter';
import teacherRouter from './teacherRouter';
import attachmentRouter from './attachmentRouter';

const app = express();
const port = env.port;


app.set('trust proxy', 1);

// No CORS middleware: the frontend is served same-origin (Vite proxy in dev,
// nginx reverse proxy in deployment), so the API only ever sees same-origin
// requests. If auth ever moves to cookies or a cross-origin frontend, add a
// CORS policy restricted to that specific origin — see docs/security-issues.md #8.

// Sized for the max excuse upload: 3 attachments x 5 MB, base64-inflated (~33%)
// plus the message/JSON overhead. Per-file/count/type limits are enforced in
// validateAttachments; this is the outer ceiling so oversized bodies are
// rejected before parsing.
app.use(express.json({ limit: '22mb' }));
app.use(express.urlencoded({ limit: '22mb', extended: true }));

app.use(authRouter);
app.use(studentRouter);
app.use(parentRouter);
app.use(teacherRouter);
app.use(attachmentRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
