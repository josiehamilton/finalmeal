import { isValidUsername } from '@finalmeal/core';

const MAX = 30;

/**
 * A starting handle from a display name: lower-case, words joined with underscores, anything
 * else dropped, at most 30 characters. Empty when too little is left to make a valid handle.
 */
export function suggestUsername(displayName: string): string {
  const handle = displayName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX)
    .replace(/_+$/g, '');
  return isValidUsername(handle) ? handle : '';
}
