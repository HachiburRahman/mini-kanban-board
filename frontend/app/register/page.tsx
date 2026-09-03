'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { saveSession } from '@/lib/auth';
import { validateRegister } from '@/lib/validation';
import { AuthShell } from '@/components/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const invalid = validateRegister({ name, email, password });
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await api.register({ name, email, password });
      saveSession(res.accessToken, res.user);
      router.push('/boards');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a board in about a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-accent underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger/25 bg-danger-tint px-3 py-2.5 text-sm font-medium text-danger"
          >
            {error}
          </p>
        )}

        <div>
          <label htmlFor="name" className="label">
            Name
          </label>
          <input
            id="name"
            required
            autoComplete="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1.5 text-sm text-ink-faint">At least 6 characters.</p>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
