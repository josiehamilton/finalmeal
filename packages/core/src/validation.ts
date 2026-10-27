/** Same rule as the `profiles.username` check in the database. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

export const DISPLAY_NAME_MAX = 60;
export const BIO_MAX = 100;

/** Screens in the first-run onboarding flow. */
export const ONBOARDING_STEPS = 6;

/** Placeholder until Josie picks the real link domain. */
export const PLACEHOLDER_LINK_DOMAIN = 'finalmeal.example';

export function isValidUsername(s: string): boolean {
  return USERNAME_PATTERN.test(s);
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** A deliberately loose check (something@domain.tld); the email code is the real proof. */
export function isPlausibleEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s.trim());
}
