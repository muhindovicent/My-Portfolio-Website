import { EventEmitter } from 'events';
import { Store as SessionStore } from 'express-session';
import { db } from '../config/db';

const SESSION_DATA_LIMIT = 60000; // ~60KB safety limit

export class PrismaSessionStore extends EventEmitter implements SessionStore {
  constructor(private readonly ttlMs: number = 24 * 60 * 60 * 1000) {
    super();
  }

  async get(sid: string, callback: (err: any, session?: any) => void): Promise<void> {
    try {
      const record = await db.session.findUnique({
        where: { sid },
      });
      if (!record || record.expiresAt < new Date()) {
        if (record) {
          await db.session.delete({ where: { sid } }).catch(() => {});
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
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, session: any, callback: (err?: any) => void): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.ttlMs);
      const data = JSON.stringify(session);
      if (data.length > SESSION_DATA_LIMIT) {
        callback(new Error('Session data exceeds size limit'));
        return;
      }
      await db.session.upsert({
        where: { sid },
        update: { data, expiresAt, updatedAt: new Date() },
        create: { sid, data, expiresAt },
      });
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sid: string, callback: (err?: any) => void): Promise<void> {
    try {
      await db.session.delete({ where: { sid } }).catch(() => {});
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async all(callback: (err: any, sessions?: any[]) => void): Promise<void> {
    try {
      const records = await db.session.findMany();
      const sessions = records.map((r) => {
        try {
          return JSON.parse(r.data);
        } catch {
          return null;
        }
      });
      callback(null, sessions);
    } catch (err) {
      callback(err);
    }
  }

  async clear(callback: (err?: any) => void): Promise<void> {
    try {
      await db.session.deleteMany();
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async length(callback: (err: any, length?: number) => void): Promise<void> {
    try {
      const length = await db.session.count();
      callback(null, length);
    } catch (err) {
      callback(err);
    }
  }

  async touch(sid: string, session: any, callback: (err?: any) => void): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.ttlMs);
      await db.session.update({
        where: { sid },
        data: { expiresAt, updatedAt: new Date() },
      });
      callback();
    } catch (err) {
      callback(err);
    }
  }

  // Optional Store methods
  regenerate(req: any, callback: (err?: any) => void): void {
    if (req.sessionID) {
      this.destroy(req.sessionID, () => {});
    }
    req.sessionID = undefined;
    req.session = {};
    callback();
  }

  load(sid: string, callback: (err: any, session?: any) => void): void {
    this.get(sid, callback);
  }

  createSession(req: any, session: any): any {
    req.sessionID = undefined;
    req.session = session ?? {};
    return req.session;
  }
}
