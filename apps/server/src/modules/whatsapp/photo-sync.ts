import type { PrismaClient } from '@prisma/client';
import { normalizedJid } from './contact.repository.js';

export class PhotoSync {
  private pending = new Set<string>();
  private seen = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private work: Promise<void> = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly fetchPhoto: (jid: string) => Promise<string | undefined>,
    private readonly notify: () => void,
  ) {}

  add(ids: string[], force = false) {
    for (const id of ids) {
      const jid = normalizedJid(id);
      if (jid && (force || !this.seen.has(jid))) this.pending.add(jid);
    }
    if (!this.stopped && !this.timer) this.schedule();
  }

  private schedule() {
    this.timer = setTimeout(() => {
      this.work = this.next().finally(() => {
        this.timer = undefined;
        if (!this.stopped && this.pending.size) this.schedule();
      });
    }, 400);
    this.timer.unref();
  }

  private async next() {
    const jid = this.pending.values().next().value as string | undefined;
    if (!jid || this.stopped) return;
    this.pending.delete(jid);
    this.seen.add(jid);
    if (this.seen.size > 10_000) this.seen.delete(this.seen.values().next().value!);
    try {
      const url = await this.fetchPhoto(jid);
      if (this.stopped || !url) return;
      const identity = await this.db.whatsappIdentity.findUnique({ where: { jid } });
      if (identity) {
        await this.db.contact.update({ where: { id: identity.contactId }, data: { profilePicture: url } });
        this.notify();
      }
    } catch {
      // Private or unavailable profile photos do not interrupt contact synchronization.
    }
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.pending.clear();
    await this.work;
  }
}
