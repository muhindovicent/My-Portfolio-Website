import { Store, SessionData } from 'express-session';
import { createHash } from 'node:crypto';
import { db } from '../config/db';

declare module 'express-session' {
  interface SessionData { adminId?: string; version?: number; mfaVerified?: boolean; csrfToken?: string }
}
const key = (sid: string) => createHash('sha256').update(sid).digest('hex');
type Done = (err?: unknown) => void;
// Inherit createSession/regenerate from Store: express-session owns IDs, cookies and callbacks.
export class PrismaSessionStore extends Store {
  get(sid: string, cb: (err: unknown, data?: SessionData | null) => void) {
    db.session.findFirst({where:{sid:key(sid), expiresAt:{gt:new Date()}}})
      .then(row => cb(null,row ? JSON.parse(row.data) : null)).catch(cb);
  }
  set(sid: string, session: SessionData, cb: Done = () => {}) {
    const data = {data:JSON.stringify(session), adminId:session.adminId ?? null,
      expiresAt:new Date(session.cookie.expires ?? Date.now())};
    db.session.upsert({where:{sid:key(sid)}, create:{sid:key(sid), ...data}, update:data})
      .then(() => cb()).catch(cb);
  }
  destroy(sid: string, cb: Done = () => {}) {
    db.session.deleteMany({where:{sid:key(sid)}}).then(() => cb()).catch(cb);
  }
}
