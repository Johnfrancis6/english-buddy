import { factToRow, rowToFact, rowToTalk, talkToRow, type FactRow, type TalkRow } from './rows';
import type { CloudData, CloudSync, CloudUser } from './types';

/**
 * The account through Supabase (supabase-js v2, API checked on 2026-11-10 at
 * supabase.com/docs/reference/javascript: createClient, auth.signInWithOtp
 * with emailRedirectTo, auth.getSession, auth.signOut, from().select /
 * upsert / delete().in()). Every table has Row Level Security: a user only
 * reads and writes their own rows (supabase/schema.sql).
 *
 * The library is loaded only when an account is configured, so the site
 * stays light for everyone else.
 */

/** The part of the supabase-js client this file uses (lets tests fake it). */
export interface SupabaseLike {
  auth: {
    getSession(): Promise<{
      data: { session: { user: { id: string; email?: string } } | null };
      error: unknown;
    }>;
    signInWithOtp(args: {
      email: string;
      options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
    }): Promise<{ error: unknown }>;
    signOut(): Promise<{ error: unknown }>;
  };
  from(table: string): {
    select(columns: string): PromiseLike<{ data: unknown[] | null; error: unknown }>;
    upsert(rows: object[]): PromiseLike<{ error: unknown }>;
    delete(): { in(column: string, values: readonly string[]): PromiseLike<{ error: unknown }> };
  };
}

export const FACTS_TABLE = 'learner_facts';
export const TALKS_TABLE = 'talk_summaries';

export class CloudError extends Error {
  constructor(
    readonly step: string,
    detail: unknown,
  ) {
    super(`${step}: ${(detail as { message?: string })?.message ?? String(detail)}`);
  }
}

const check = (step: string, error: unknown) => {
  if (error) throw new CloudError(step, error);
};

export class SupabaseSync implements CloudSync {
  readonly configured = true;
  private client: Promise<SupabaseLike> | null = null;

  constructor(
    private readonly url: string,
    private readonly key: string,
    /** Where the sign-in link brings the learner back (this page). */
    private readonly redirectTo: string,
    private readonly makeClient: (url: string, key: string) => Promise<SupabaseLike> = loadClient,
  ) {}

  private get db(): Promise<SupabaseLike> {
    this.client ??= this.makeClient(this.url, this.key);
    return this.client;
  }

  async currentUser(): Promise<CloudUser | null> {
    const { data, error } = await (await this.db).auth.getSession();
    check('session', error);
    const u = data.session?.user;
    return u ? { id: u.id, email: u.email ?? '' } : null;
  }

  async sendMagicLink(email: string): Promise<void> {
    const { error } = await (
      await this.db
    ).auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: this.redirectTo, shouldCreateUser: true },
    });
    check('lien de connexion', error);
  }

  async signOut(): Promise<void> {
    const { error } = await (await this.db).auth.signOut();
    check('déconnexion', error);
  }

  async pull(): Promise<CloudData> {
    const db = await this.db;
    const facts = await db.from(FACTS_TABLE).select('*');
    check('lecture de la mémoire', facts.error);
    const talks = await db.from(TALKS_TABLE).select('*');
    check('lecture des conversations', talks.error);
    return {
      facts: ((facts.data ?? []) as FactRow[]).map(rowToFact),
      talks: ((talks.data ?? []) as TalkRow[]).map(rowToTalk),
    };
  }

  async push(data: CloudData, deletedFactIds: readonly string[]): Promise<void> {
    const user = await this.currentUser();
    if (!user) throw new CloudError('envoi', 'not signed in');
    const db = await this.db;
    if (data.facts.length) {
      const { error } = await db
        .from(FACTS_TABLE)
        .upsert(data.facts.map((f) => factToRow(f, user.id)));
      check('envoi de la mémoire', error);
    }
    if (deletedFactIds.length) {
      const { error } = await db.from(FACTS_TABLE).delete().in('id', deletedFactIds);
      check('effacement en ligne', error);
    }
    const rows = data.talks
      .map((t) => talkToRow(t, user.id))
      .filter((r): r is TalkRow => r !== null);
    if (rows.length) {
      const { error } = await db.from(TALKS_TABLE).upsert(rows);
      check('envoi des conversations', error);
    }
  }
}

async function loadClient(url: string, key: string): Promise<SupabaseLike> {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }) as unknown as SupabaseLike;
}
