import { describe, it, expect, vi } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service.js';

function makeService(existingUser: unknown) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(existingUser),
      create: vi.fn(({ data }) => Promise.resolve({ id: 'u1', ...data })),
    },
  };
  const jwt = { sign: vi.fn().mockReturnValue('signed.jwt.token') };
  return { service: new AuthService(prisma as never, jwt as never), prisma, jwt };
}

describe('AuthService.register', () => {
  it('hashes the password instead of storing it in plain text', async () => {
    const { service, prisma } = makeService(null);

    await service.register({ email: 'a@b.com', password: 'hunter22', name: 'A' });

    const stored = prisma.user.create.mock.calls[0][0].data;
    expect(stored.passwordHash).not.toBe('hunter22');
    expect(await bcrypt.compare('hunter22', stored.passwordHash)).toBe(true);
  });

  it('never returns the password hash to the client', async () => {
    const { service } = makeService(null);

    const result = await service.register({ email: 'a@b.com', password: 'hunter22', name: 'A' });

    expect(result.user).toEqual({ id: 'u1', email: 'a@b.com', name: 'A' });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('rejects a duplicate email with 409 Conflict', async () => {
    const { service } = makeService({ id: 'u1', email: 'a@b.com' });

    await expect(
      service.register({ email: 'a@b.com', password: 'hunter22', name: 'A' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('AuthService.login', () => {
  it('returns a token and the safe user fields on a correct password', async () => {
    const passwordHash = await bcrypt.hash('hunter22', 10);
    const { service, jwt } = makeService({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      passwordHash,
    });

    const result = await service.login({ email: 'a@b.com', password: 'hunter22' });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1', email: 'a@b.com' });
  });

  it('gives the same error for a wrong password as for an unknown email', async () => {
    // Different messages would let an attacker confirm which emails have accounts.
    const passwordHash = await bcrypt.hash('hunter22', 10);
    const wrongPassword = makeService({ id: 'u1', email: 'a@b.com', name: 'A', passwordHash });
    const unknownEmail = makeService(null);

    const a = await wrongPassword.service
      .login({ email: 'a@b.com', password: 'wrong-password' })
      .catch((e) => e);
    const b = await unknownEmail.service
      .login({ email: 'nobody@b.com', password: 'hunter22' })
      .catch((e) => e);

    expect(a).toBeInstanceOf(UnauthorizedException);
    expect(b).toBeInstanceOf(UnauthorizedException);
    expect(a.message).toBe(b.message);
  });
});
