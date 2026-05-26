import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './db/database.js';
import { sessionSecret } from './config.js';

import authRoutes from './routes/authRoutes.js';
import bookRoutes from './routes/bookRoutes.js';
import requestRoutes from './routes/requestRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(express.json());
app.use(cookieParser(sessionSecret));

// API Routes
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/requests', requestRoutes);

// Error handling
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ message: 'Request body must be valid JSON.' });
  }
  next(err);
});

// Static files
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Database and server startup
await initDatabase();

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`BookBridge server running on http://localhost:${port}`);
  });
}

export default app;
