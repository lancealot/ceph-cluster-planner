import type { Scenario } from '../types/scenario';
import { deserialize, serialize } from './scenario';
import type { Workspace } from '../types/scenario';

const HASH_PREFIX = '#s=';

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeScenarioToHash(workspace: Workspace, name = 'shared'): string {
  const scenario = serialize(workspace, name);
  return HASH_PREFIX + utf8ToBase64Url(JSON.stringify(scenario));
}

export function decodeScenarioFromHash(hash: string): Scenario | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    const json = base64UrlToUtf8(hash.slice(HASH_PREFIX.length));
    return deserialize(JSON.parse(json));
  } catch {
    return null;
  }
}

export function buildShareUrl(workspace: Workspace, name?: string): string {
  const hash = encodeScenarioToHash(workspace, name);
  const base = `${window.location.origin}${window.location.pathname}`;
  return base + hash;
}
