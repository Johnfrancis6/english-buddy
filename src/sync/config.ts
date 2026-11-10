import { mergeCloud } from './rows';
import { SupabaseSync } from './supabaseSync';
import { NO_CLOUD, type CloudData, type CloudSync } from './types';

/**
 * The Supabase project of English Buddy. Empty = accounts are off and
 * everything stays in the browser. Once Franco has created the project, its
 * URL and its publishable key (sb_publishable_…, or the legacy "anon" key)
 * go here: both are public by design, Row Level Security protects the data.
 * They can also be pasted in the settings (for a test project).
 */
export const PROJECT_URL = '';
export const PUBLISHABLE_KEY = '';

const KEY = 'english-buddy.cloud.v1';
const DELETED = 'english-buddy.cloud.deleted-facts';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface CloudConfig {
  url: string;
  key: string;
}

/** The settings override wins over the built-in project. */
export function cloudConfig(store: Store = localStorage): CloudConfig {
  try {
    const p = JSON.parse(store.getItem(KEY) ?? '{}') as Partial<CloudConfig>;
    if (typeof p.url === 'string' && p.url.trim() && typeof p.key === 'string' && p.key.trim()) {
      return { url: p.url.trim(), key: p.key.trim() };
    }
  } catch {
    /* ignore a broken value */
  }
  return { url: PROJECT_URL, key: PUBLISHABLE_KEY };
}

export function saveCloudConfig(c: CloudConfig, store: Store = localStorage): void {
  if (!c.url.trim() || !c.key.trim()) store.removeItem(KEY);
  else store.setItem(KEY, JSON.stringify({ url: c.url.trim(), key: c.key.trim() }));
}

/** A Supabase project URL looks like https://<ref>.supabase.co. */
export const isProjectUrl = (url: string) =>
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url.trim());

export function makeCloud(redirectTo: string, store: Store = localStorage): CloudSync {
  const c = cloudConfig(store);
  return c.url && c.key ? new SupabaseSync(c.url, c.key, redirectTo) : NO_CLOUD;
}

/** Facts erased here, to erase online at the next sync. */
export function deletedFacts(store: Store = localStorage): string[] {
  try {
    const v = JSON.parse(store.getItem(DELETED) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function rememberDeleted(ids: readonly string[], store: Store = localStorage): void {
  store.setItem(DELETED, JSON.stringify([...new Set([...deletedFacts(store), ...ids])]));
}
export function forgetDeleted(store: Store = localStorage): void {
  store.removeItem(DELETED);
}

/**
 * One synchronisation: read online, merge with this browser, write the
 * result here and online. Returns the merged data for the caller to save.
 */
export async function syncOnce(
  cloud: CloudSync,
  local: CloudData,
  store: Store = localStorage,
): Promise<CloudData> {
  const deleted = deletedFacts(store);
  const merged = mergeCloud(local, await cloud.pull(), deleted);
  await cloud.push(merged, deleted);
  forgetDeleted(store);
  return merged;
}
