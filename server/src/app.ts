import 'express-async-errors';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { PrismaSessionStore } from './lib/sessionStore';
import { errorHandler, notFoundHandler } from './middleware/error';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';
import { loadEnv } from './config/env';

loadEnv();

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  })
);

// Session configuration — secure HTTP-only cookies backed by PostgreSQL
const sessionTtlMs = 24 * 60 * 60 * 1000; // 24 hours
app.use(
  session({
    store: new PrismaSessionStore(sessionTtlMs),
    secret: process.env.SESSION_SECRET!,
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
