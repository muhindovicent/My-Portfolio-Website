import 'express-async-errors';
import express from 'express';
import path from 'path';
import { timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { PrismaSessionStore } from './lib/sessionStore';
import { errorHandler, notFoundHandler } from './middleware/error';
import { requireStudioPage } from './middleware/auth';
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

// Portfolio Studio — auth-guarded SPA served by the API origin.
const studioDir = path.resolve(process.cwd(), 'public', 'studio');

app.use('/admin', (req, res, next) => {
  if (req.path.startsWith('/assets/')) return next();
  if (config.NODE_ENV === 'production') {
    const supplied = Buffer.from(req.get('x-origin-secret') || '');
    const expected = Buffer.from(config.ORIGIN_SECRET!);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.sendStatus(403);
      return;
    }
  }
  next();
});

app.use(
  '/admin/assets',
  express.static(path.join(studioDir, 'assets'), { maxAge: '1h', fallthrough: false })
);

app.get('/admin/login', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(studioDir, 'index.html'));
});

app.get(['/admin', '/admin/*'], requireStudioPage, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(studioDir, 'index.html'));
});

// Public portfolio output is normally served as static files. In local development
// and tests, serve it here so direct project URLs can be exercised end to end.
if (config.NODE_ENV !== 'production') {
  const portfolioDir = path.resolve(process.cwd(), '..', 'dist');
  app.get(['/work/:slug', '/work/:slug/'], (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(portfolioDir, 'work', '_project', 'index.html'), (error) => {
      if (error) next(error);
    });
  });
  app.use(express.static(portfolioDir));
}

// 404
app.use(notFoundHandler);

// Centralized error handler (must be last)
app.use(errorHandler);

export default app;
