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
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function generateSalt(): string {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return bufferToHex(salt.buffer);
}

/**
 * Hash a PIN using PBKDF2 with a random salt.
 * Returns the hash, salt, and iteration count — all needed for verification.
 */
export async function hashPin(pin: string): Promise<{
  hash: string;
  salt: string;
  iterations: number;
}> {
  const salt = generateSalt();
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToUint8Array(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  return {
    hash: bufferToHex(derivedBits),
    salt,
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Verify a PIN against a stored PBKDF2 hash using the stored salt and iterations.
 */
export async function verifyPin(
  pin: string,
  storedHash: string,
  salt: string,
  iterations: number
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: hexToUint8Array(salt),
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      KEY_LENGTH * 8
    );

    const hash = bufferToHex(derivedBits);
    return hash === storedHash;
  } catch (err) {
    console.error('PIN verification crypto failure:', err);
    throw new Error('Security subsystem unavailable. Ensure HTTPS or secure context.');
  }
}

/**
 * Legacy SHA-256 verification for migrating old hashes to PBKDF2.
 */
export async function verifyLegacySha256(pin: string, storedHash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer) === storedHash;
  } catch (err) {
    console.error('Legacy SHA-256 verification crypto failure:', err);
    throw new Error('Security subsystem unavailable. Ensure HTTPS or secure context.');
  }
}
