import { describe, it, expect } from 'vitest';
import { parseChatInput } from '../../src/utils/chatParser';

describe('parseChatInput', () => {
  it('beli kopi di Indomaret 50000', () => {
    expect(parseChatInput('beli kopi di Indomaret 50000')).toEqual({
      description: 'Kopi Di Indomaret',
      amount: 50000,
    });
  });
  it('kopi 50rb', () => {
    expect(parseChatInput('kopi 50rb')?.amount).toBe(50000);
  });
  it('1,5jt', () => {
    expect(parseChatInput('laptop 1,5jt')?.amount).toBe(1_500_000);
  });
  it('strip dari clause into desc', () => {
    expect(parseChatInput('kopi 20000 dari kas')?.description).toBe('Kopi');
  });
  it('no amount -> null', () => {
    expect(parseChatInput('halo bang')).toBeNull();
  });
});
