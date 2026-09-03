import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/// Verifies the JWT bearer token and attaches `req.user`. Every board/column/
/// task route sits behind this guard - anonymous requests never reach a
/// controller method.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
