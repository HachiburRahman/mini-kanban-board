import { IsEmail } from 'class-validator';

export class ShareBoardDto {
  @IsEmail()
  email!: string;
}
