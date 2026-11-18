import 'express-async-errors';
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { PrismaSessionStore } from './lib/sessionStore';
import { errorHandler, notFoundHandler } from './middleware/error';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';
import { loadEnv } from './config/env';

const config = loadEnv();

const app = express();

app.set('trust proxy', 1);

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (config.NODE_ENV === 'production') {
    const supplied = Buffer.from(req.get('x-origin-secret') || '');
    const expected = Buffer.from(config.ORIGIN_SECRET!);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.sendStatus(403); return;
    }
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin: config.CORS_ORIGIN || false,
    credentials: true,
  })
);

// Session configuration — secure HTTP-only cookies backed by PostgreSQL
const sessionTtlMs = 24 * 60 * 60 * 1000; // 24 hours
app.use(
  session({
    store: new PrismaSessionStore(),
    secret: config.SESSION_SECRET,
    name: 'connect.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionTtlMs,
    },
  })
);

// Health check (public)
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'portfolio-api', env: process.env.NODE_ENV });
});

// API routes
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);

// 404
app.use(notFoundHandler);

// Centralized error handler (must be last)
app.use(errorHandler);

export default app;
