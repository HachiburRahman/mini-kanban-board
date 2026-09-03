// Regression: ISSUE-006 — auth forms round-tripped to the server for empty input
// Found by /qa on 2026-09-03
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-09-03.md
//
// Both forms carry `noValidate`, which switches off the native checks their
// inputs already declared, and nothing replaced them. Clicking "Sign in" on an
// empty form made a network request and returned a validation failure from the
// API instead of being caught in the browser.

import { describe, it, expect } from 'vitest';
import { validateLogin, validateRegister, PASSWORD_MIN_LENGTH } from '../lib/validation';

describe('ISSUE-006: login is validated before any request', () => {
  it('rejects a completely empty form', () => {
    expect(validateLogin({ email: '', password: '' })).toBe('Enter your email address.');
  });

  it('rejects whitespace-only email', () => {
    expect(validateLogin({ email: '   ', password: 'hunter22' })).toBe(
      'Enter your email address.',
    );
  });

  it('rejects an address that is not shaped like an email', () => {
    expect(validateLogin({ email: 'not-an-email', password: 'hunter22' })).toBe(
      'Enter a valid email address.',
    );
  });

  it('rejects a missing password', () => {
    expect(validateLogin({ email: 'a@b.com', password: '' })).toBe('Enter your password.');
  });

  it('accepts valid credentials', () => {
    expect(validateLogin({ email: 'a@b.com', password: 'x' })).toBeNull();
  });

  it('does not second-guess password length at login', () => {
    // An existing account may predate any length rule; only the server decides.
    expect(validateLogin({ email: 'a@b.com', password: 'ab' })).toBeNull();
  });
});

describe('ISSUE-006: register is validated before any request', () => {
  it('asks for the name first on an empty form', () => {
    expect(validateRegister({ name: '', email: '', password: '' })).toBe('Enter your name.');
  });

  it('rejects a whitespace-only name', () => {
    expect(validateRegister({ name: '  ', email: 'a@b.com', password: 'hunter22' })).toBe(
      'Enter your name.',
    );
  });

  it('rejects a malformed email', () => {
    expect(validateRegister({ name: 'A', email: 'a@b', password: 'hunter22' })).toBe(
      'Enter a valid email address.',
    );
  });

  it('catches the short password locally, matching the server rule', () => {
    // This is the exact case that produced "Request failed (400)" in the QA run.
    expect(validateRegister({ name: 'QA Tester', email: 'a@b.com', password: '123' })).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  });

  it('accepts a password exactly at the minimum', () => {
    expect(
      validateRegister({ name: 'A', email: 'a@b.com', password: 'x'.repeat(PASSWORD_MIN_LENGTH) }),
    ).toBeNull();
  });

  it('accepts a complete, valid signup', () => {
    expect(
      validateRegister({ name: 'QA Tester', email: 'qa@example.com', password: 'hunter22' }),
    ).toBeNull();
  });

  it('agrees with the server minimum', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
  });
});
