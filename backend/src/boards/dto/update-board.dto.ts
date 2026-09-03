import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TITLE_MAX_LENGTH, TITLE_MAX_MESSAGE } from '../../common/limits.js';

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH, { message: TITLE_MAX_MESSAGE })
  title?: string;
}
