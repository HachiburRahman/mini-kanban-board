import { IsInt, Min } from 'class-validator';

export class MoveColumnDto {
  /** 0-based position the column should land at among the board's OTHER
   *  columns (i.e. not counting the column being moved). */
  @IsInt()
  @Min(0)
  index!: number;
}
