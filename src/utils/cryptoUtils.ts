/**
 * PBKDF2-SHA256 PIN hashing via the SubtleCrypto API.
 * The hash + salt + iteration triple is what's persisted; verification re-derives
 * the same bits and compares in constant time across the hex encoding.
 */
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // bytes

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
  const length = hex.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function generateSalt(): string {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return bufferToHex(salt.buffer);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bufferToHex(buf);
}

async function pbkdf2Hex(pin: string, saltHex: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToUint8Array(saltHex), iterations, hash: 'SHA-256' },
    keyMaterial, KEY_LENGTH * 8
  );
  return bufferToHex(derivedBits);
}

function cryptoUnavailable(): Error {
  return new Error('Security subsystem unavailable. Ensure HTTPS or secure context.');
}

/** Hash a PIN. Returns the hash, salt, and iteration count needed for verification. */
export async function hashPin(pin: string): Promise<{
  hash: string;
  salt: string;
  iterations: number;
}> {
  const salt = generateSalt();
  return {
    hash: await pbkdf2Hex(pin, salt, PBKDF2_ITERATIONS),
    salt,
    iterations: PBKDF2_ITERATIONS,
  };
}

/** Verify a PIN against a stored PBKDF2 hash. */
export async function verifyPin(
  pin: string,
  storedHash: string,
  salt: string,
  iterations: number
): Promise<boolean> {
  try {
    return (await pbkdf2Hex(pin, salt, iterations)) === storedHash;
  } catch (err) {
    console.error('PIN verification crypto failure:', err);
    throw cryptoUnavailable();
  }
}

/** Verify a legacy SHA-256-only hash. Used to upgrade old installs to PBKDF2. */
export async function verifyLegacySha256(pin: string, storedHash: string): Promise<boolean> {
  try {
    return (await sha256Hex(pin)) === storedHash;
  } catch (err) {
    console.error('Legacy SHA-256 verification crypto failure:', err);
    throw cryptoUnavailable();
  }
}
