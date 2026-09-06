import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from '../src/auth/dto/register.dto.js';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../src/common/limits.js';

function messagesFor(payload: Record<string, unknown>) {
  return validateSync(plainToInstance(RegisterDto, payload) as object).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );
}

const valid = { email: 'a@b.dev', password: 'password123', name: 'Ada' };

describe('RegisterDto password bounds', () => {
  it('still rejects a password under the minimum', () => {
    expect(messagesFor({ ...valid, password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1) })).toContain(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  });

  it('accepts a password exactly at the minimum', () => {
    expect(messagesFor({ ...valid, password: 'x'.repeat(PASSWORD_MIN_LENGTH) })).toEqual([]);
  });

  /**
   * bcrypt hashes only the first 72 bytes. Without a ceiling, two different
   * long passwords sharing a 72-byte prefix would both open the same account,
   * and the user would never be told their password was silently truncated.
   */
  it('rejects a password past the point bcrypt stops reading', () => {
    expect(messagesFor({ ...valid, password: 'x'.repeat(PASSWORD_MAX_LENGTH + 1) })).toContain(
      `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
    );
  });

  it('accepts a password exactly at the bcrypt limit', () => {
    expect(messagesFor({ ...valid, password: 'x'.repeat(PASSWORD_MAX_LENGTH) })).toEqual([]);
  });

  it('caps at 72, matching bcrypt rather than an arbitrary number', () => {
    expect(PASSWORD_MAX_LENGTH).toBe(72);
  });
});

describe('RegisterDto name and email bounds', () => {
  it('rejects a name over the limit', () => {
    expect(messagesFor({ ...valid, name: 'n'.repeat(NAME_MAX_LENGTH + 1) })).toContain(
      `Name must be ${NAME_MAX_LENGTH} characters or fewer`,
    );
  });

  it('accepts a name exactly at the limit', () => {
    expect(messagesFor({ ...valid, name: 'n'.repeat(NAME_MAX_LENGTH) })).toEqual([]);
  });

  it('still rejects an empty name', () => {
    expect(messagesFor({ ...valid, name: '' }).length).toBeGreaterThan(0);
  });

  it('rejects an email longer than an email can be', () => {
    const local = 'a'.repeat(EMAIL_MAX_LENGTH);
    expect(messagesFor({ ...valid, email: `${local}@b.dev` }).join(' ')).toContain(
      `${EMAIL_MAX_LENGTH} characters or fewer`,
    );
  });

  it('still rejects an address that is not an email', () => {
    expect(messagesFor({ ...valid, email: 'not-an-email' }).length).toBeGreaterThan(0);
  });

  it('accepts a complete, valid signup', () => {
    expect(messagesFor(valid)).toEqual([]);
  });
});
