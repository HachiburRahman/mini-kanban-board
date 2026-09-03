import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MAX_MESSAGE,
  TITLE_MAX_LENGTH,
  TITLE_MAX_MESSAGE,
} from '../../common/limits.js';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH, { message: TITLE_MAX_MESSAGE })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH, { message: DESCRIPTION_MAX_MESSAGE })
  description?: string;
}
