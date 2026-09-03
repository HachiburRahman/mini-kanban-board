import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MoveTaskDto {
  /** Target column id. Omit it to reorder within the task's current column. */
  @IsOptional()
  @IsString()
  columnId?: string;

  /** 0-based position the task should land at among the target column's
   *  OTHER tasks (i.e. not counting the task being moved). The frontend
   *  computes this straight from where the card was dropped. */
  @IsInt()
  @Min(0)
  index!: number;
}
