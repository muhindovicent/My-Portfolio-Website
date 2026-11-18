import { EventEmitter } from 'events.ts';
import {
  Store as ExpressSessionStore,
  SessionData,
  Session,
} from 'express-session.ts';
import { Request } from 'express.ts';
import { db } from '../config/db.ts.ts';

const SESSION_DATA_LIMIT = 60000; // ~60KB safety limit

export class PrismaSessionStore extends EventEmitter implements ExpressSessionStore {
  constructor(private readonly ttlMs: number = 24 * 60 * 60 * 1000) {
    super();
  }

  get(sid: string, callback: (err: any, session?: any) => void): void {
    db.session
      .findUnique({ where: { sid } })
      .then((record) => {
        if (!record || record.expiresAt < new Date()) {
          if (record) {
            db.session.delete({ where: { sid } }).catch(() => {});
          }
          callback(null, null);
          return;
        }
        let data: any;
        try {
          data = JSON.parse(record.data);
        } catch {
          data = null;
        }
        callback(null, data);
      })
      .catch(callback);
  }

  set(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const data = JSON.stringify(session);
    if (data.length > SESSION_DATA_LIMIT) {
      callback?.(new Error('Session data exceeds size limit'));
      return;
    }
    db.session
      .upsert({
        where: { sid },
        update: { data, expiresAt, updatedAt: new Date() },
        create: { sid, data, expiresAt },
      })
      .then(() => callback?.())
      .catch(callback);
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    db.session
      .delete({ where: { sid } })
      .then(() => callback?.())
      .catch(() => callback?.());
  }

  all(callback: (err: any, sessions?: any[]) => void): void {
    db.session
      .findMany()
      .then((records) => {
        const sessions = records.map((r) => {
          try {
            return JSON.parse(r.data);
          } catch {
            return null;
          }
        });
        callback(null, sessions);
      })
      .catch(callback);
  }

  clear(callback?: (err?: any) => void): void {
    db.session
      .deleteMany()
      .then(() => callback?.())
      .catch(callback);
  }

  length(callback: (err: any, length?: number) => void): void {
    db.session
      .count()
      .then((length) => callback(null, length))
      .catch(callback);
  }

  touch(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    db.session
      .update({
        where: { sid },
        data: { expiresAt, updatedAt: new Date() },
      })
      .then(() => callback?.())
      .catch(callback);
  }

  regenerate(req: Request): void {
    const sid = req.sessionID as string | undefined;
    if (sid) {
      this.destroy(sid, () => {});
    }
    (req.sessionID as string | undefined) = undefined;
    req.session = {} as Session & Partial<SessionData>;
  }

  load(sid: string, callback: (err: any, session?: any) => void): void {
    this.get(sid, callback);
  }

  createSession(req: Request, session: SessionData): Session & SessionData {
    (req.sessionID as string | undefined) = undefined;
    req.session = session as Session & Partial<SessionData>;
    return req.session as Session & SessionData;
  }
}


