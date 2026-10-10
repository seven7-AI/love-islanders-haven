import { describe, expect, it } from 'vitest';
import { authSchema } from './authSchema';

describe('authSchema', () => {
  it('accepts a valid login', () => {
    expect(authSchema.safeParse({ email: 'a@example.com', password: 'secret1' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = authSchema.safeParse({ email: 'not-an-email', password: 'secret1' });
    expect(result.success).toBe(false);
  });

  it('rejects a short password', () => {
    const result = authSchema.safeParse({ email: 'a@example.com', password: '123' });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched confirmation on signup', () => {
    const result = authSchema.safeParse({ email: 'a@example.com', password: 'secret1', confirmPassword: 'secret2' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['confirmPassword']);
  });
});
