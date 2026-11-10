import { ALL_STORES, clearStores, countStores, type StoreName } from './db';

/**
 * Everything this app keeps lives in this browser: the IndexedDB stores
 * below (text and scores only, never voice) and a few `localStorage` entries
 * whose names start with `english-buddy.` (settings and keys, onboarding,
 * optional account). This module lists them in one place so that the
 * settings can show what is kept and erase any of it, or all of it.
 */
export interface DataGroup {
  id: 'talks' | 'facts' | 'cards' | 'docs' | 'pron';
  /** French label shown in the settings. */
  label: string;
  /** One French line: what it contains. */
  what: string;
  stores: readonly StoreName[];
}

export const DATA_GROUPS: readonly DataGroup[] = [
  {
    id: 'talks',
    label: 'Conversations, bilans et chansons',
    what: 'Le texte des conversations, leurs bilans, tes chansons et leurs notes',
    stores: ['talks', 'sing', 'songs'],
  },
  {
    id: 'facts',
    label: 'Ce que les personnages savent de toi',
    what: 'Les faits notés après les bilans',
    stores: ['facts'],
  },
  {
    id: 'cards',
    label: 'Révisions',
    what: 'Tes cartes de révision et leur calendrier',
    stores: ['cards'],
  },
  {
    id: 'docs',
    label: 'Documents',
    what: 'Le texte des PDF et des pages importés',
    stores: ['docs'],
  },
  {
    id: 'pron',
    label: 'Notes de prononciation',
    what: 'Les phrases lues et leurs notes',
    stores: ['pron'],
  },
];

/** Prefix of every `localStorage` entry written by the app. */
export const LOCAL_PREFIX = 'english-buddy.';

/** Set once the old debriefs have been turned into review cards. */
export const CARDS_BACKFILLED = `${LOCAL_PREFIX}cards-backfilled.v1`;

export function storesOf(id: DataGroup['id']): readonly StoreName[] {
  return DATA_GROUPS.find((g) => g.id === id)?.stores ?? [];
}

/** The `localStorage` keys that belong to the app. */
export function appKeys(keys: readonly string[]): string[] {
  return keys.filter((k) => k.startsWith(LOCAL_PREFIX));
}

/** Records per group, read in one transaction. */
export async function countGroups(): Promise<Record<DataGroup['id'], number>> {
  const n = await countStores();
  return Object.fromEntries(
    DATA_GROUPS.map((g) => [g.id, g.stores.reduce((sum, st) => sum + n[st], 0)]),
  ) as Record<DataGroup['id'], number>;
}

export async function clearGroup(id: DataGroup['id']): Promise<void> {
  await clearStores(storesOf(id));
}

interface KeyStore {
  readonly length: number;
  key(i: number): string | null;
  removeItem(k: string): void;
}

/** Erases every store and every app entry of `localStorage` (keys included). */
export async function wipeEverything(store: KeyStore = localStorage): Promise<void> {
  await clearStores(ALL_STORES);
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k) keys.push(k);
  }
  for (const k of appKeys(keys)) store.removeItem(k);
}
