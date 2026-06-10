import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, verifyLegacySha256 } from './cryptoUtils';

describe('cryptoUtils', () => {
  describe('hashPin', () => {
    it('generates a hash with salt and iterations', async () => {
      const result = await hashPin('1234');
      
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('salt');
      expect(result).toHaveProperty('iterations');
      expect(typeof result.hash).toBe('string');
      expect(typeof result.salt).toBe('string');
      expect(result.iterations).toBe(100_000);
    });

    it('generates different hashes for same PIN (different salts)', async () => {
      const result1 = await hashPin('1234');
      const result2 = await hashPin('1234');
      
      // Same PIN should produce different hashes due to random salt
      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it('generates different hashes for different PINs', async () => {
      const result1 = await hashPin('1234');
      const result2 = await hashPin('5678');
      
      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('verifyPin', () => {
    it('verifies correct PIN', async () => {
      const { hash, salt, iterations } = await hashPin('1234');
      
      const result = await verifyPin('1234', hash, salt, iterations);
      expect(result).toBe(true);
    });

    it('rejects incorrect PIN', async () => {
      const { hash, salt, iterations } = await hashPin('1234');
      
      const result = await verifyPin('5678', hash, salt, iterations);
      expect(result).toBe(false);
    });

    it('works with different PIN lengths', async () => {
      const { hash, salt, iterations } = await hashPin('123456');
      
      const result = await verifyPin('123456', hash, salt, iterations);
      expect(result).toBe(true);
    });
  });

  describe('verifyLegacySha256', () => {
    it('verifies legacy SHA-256 hash', async () => {
      // SHA-256 of "1234"
      const encoder = new TextEncoder();
      const data = encoder.encode('1234');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const expectedHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const result = await verifyLegacySha256('1234', expectedHash);
      expect(result).toBe(true);
    });

    it('rejects incorrect PIN with legacy hash', async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode('1234');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const expectedHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const result = await verifyLegacySha256('5678', expectedHash);
      expect(result).toBe(false);
    });
  });

  describe('security parameters', () => {
    it('PBKDF2 parameters are secure', async () => {
      const result = await hashPin('1234');
      
      expect(result.iterations).toBeGreaterThanOrEqual(100_000);
      // Salt should be 16 bytes = 32 hex characters
      expect(result.salt.length).toBe(32);
      // Hash should be 32 bytes = 64 hex characters
      expect(result.hash.length).toBe(64);
    });
  });
});
