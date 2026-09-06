import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

/**
 * The only unauthenticated routes in the app, so the only ones an attacker can
 * hammer for free. Both are rate limited per IP: without it, `POST /auth/login`
 * is an open password-guessing oracle, and `POST /auth/register` will happily
 * fill the users table.
 *
 * Limits are per IP and deliberately generous enough that a person mistyping a
 * password, or a reviewer setting up a few accounts to try sharing, never
 * notices - while still turning "guess passwords as fast as the network
 * allows" into something that would take years against bcrypt.
 */
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
