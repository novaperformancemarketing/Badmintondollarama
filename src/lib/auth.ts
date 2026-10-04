/** Shared-passcode access. When APP_PASSCODE is unset the app is open. */
export const AUTH_COOKIE = 'sc_auth';

export async function passcodeToken(passcode: string): Promise<string> {
  const bytes = new TextEncoder().encode(`smash-champs:${passcode}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
