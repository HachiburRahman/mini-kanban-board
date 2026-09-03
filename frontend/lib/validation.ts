export const PASSWORD_MIN_LENGTH = 6;

// Deliberately loose: the server is the authority on whether an address is
// real. This only catches the obvious typo before spending a round trip.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Client-side checks for the auth forms.
 *
 * Both forms carry `noValidate` so the browser's native bubbles don't clash
 * with the app's own error styling - but nothing had replaced those checks, so
 * submitting an empty login form made a request and came back with a bare
 * validation failure from the API. These run first and render in the same
 * alert the server errors use.
 */
export function validateLogin(values: { email: string; password: string }): string | null {
  const email = values.email.trim();

  if (!email) return 'Enter your email address.';
  if (!EMAIL_SHAPE.test(email)) return 'Enter a valid email address.';
  if (!values.password) return 'Enter your password.';

  return null;
}

export function validateRegister(values: {
  name: string;
  email: string;
  password: string;
}): string | null {
  const name = values.name.trim();
  const email = values.email.trim();

  if (!name) return 'Enter your name.';
  if (!email) return 'Enter your email address.';
  if (!EMAIL_SHAPE.test(email)) return 'Enter a valid email address.';
  if (!values.password) return 'Choose a password.';
  if (values.password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  return null;
}
