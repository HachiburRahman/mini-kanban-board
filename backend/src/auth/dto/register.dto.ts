import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_MAX_MESSAGE,
  NAME_MAX_LENGTH,
  NAME_MAX_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
} from '../../common/limits.js';

export class RegisterDto {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH, { message: EMAIL_MAX_MESSAGE })
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_MIN_MESSAGE })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_MAX_MESSAGE })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH, { message: NAME_MAX_MESSAGE })
  name!: string;
}
