export const SESSION_COOKIE_NAME = 'pos_session';

export interface SessionUser {
  id: number;
  username: string;
  display_name: string;
  role: string;
  exp: number;
}

function getSecretString(): string {
  return (
    process.env.SESSION_SECRET ||
    `smart-pos-session::${process.env.DB_NAME || 'pos'}::${process.env.DB_USER || 'root'}::${process.env.DB_PASSWORD || 'local'}`
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecretString()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionToken(user: Omit<SessionUser, 'exp'>, ttlSeconds: number): Promise<string> {
  const payload: SessionUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoder = new TextEncoder();
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey();
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuffer));
  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const encoder = new TextEncoder();
    const key = await importHmacKey();
    const sigBytes = fromBase64Url(sigB64);
    const sigCopy = new Uint8Array(sigBytes.length);
    sigCopy.set(sigBytes);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigCopy,
      encoder.encode(payloadB64)
    );
    if (!valid) return null;

    const payloadBytes = fromBase64Url(payloadB64);
    const decoded = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionUser;
    if (!decoded || typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (!decoded.username || typeof decoded.id !== 'number') return null;
    return decoded;
  } catch {
    return null;
  }
}
