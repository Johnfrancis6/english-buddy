import type { Fact } from '../memory/facts';
import type { SavedTalk } from '../storage/talks';

/**
 * Optional online account (docs/BRIEF.md "Accounts"). Local-first: the
 * browser's IndexedDB is the reference; the account is a copy that follows
 * the learner to another computer. Off until a project URL is given.
 *
 * What goes online: the memory facts and a summary of each talk (date,
 * character, scene, durations, word counts, scores, mistakes, words to
 * learn). Never the full transcript, never a voice, never an API key.
 */
export interface CloudUser {
  id: string;
  email: string;
}

export interface CloudData {
  facts: Fact[];
  talks: SavedTalk[];
}

export interface CloudSync {
  /** A project URL and key are known. */
  readonly configured: boolean;
  /** The signed-in user, after the magic link has been opened. */
  currentUser(): Promise<CloudUser | null>;
  /** Sends a sign-in link by email (no password). */
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Everything this user has online. */
  pull(): Promise<CloudData>;
  /** Writes these facts and talks, and removes the facts erased here. */
  push(data: CloudData, deletedFactIds: readonly string[]): Promise<void>;
}

/** The account when no project is configured: everything stays local. */
export const NO_CLOUD: CloudSync = {
  configured: false,
  currentUser: async () => null,
  sendMagicLink: async () => {
    throw new Error('cloud not configured');
  },
  signOut: async () => {},
  pull: async () => ({ facts: [], talks: [] }),
  push: async () => {},
};
