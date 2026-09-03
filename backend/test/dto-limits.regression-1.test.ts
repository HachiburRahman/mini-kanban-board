// Regression: ISSUE-004 — no maximum length on titles
// Found by /qa on 2026-09-03
// Report: .gstack/qa-reports/qa-report-localhost-3000-2026-09-03.md
//
// POST /columns/:id/tasks accepted a 5000-character title and returned 201. The
// card then stretched its column past 1700px and pushed "Add card" off screen,
// and any member of a shared board could do that to everyone.

import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateTaskDto } from '../src/tasks/dto/create-task.dto.js';
import { UpdateTaskDto } from '../src/tasks/dto/update-task.dto.js';
import { CreateColumnDto } from '../src/columns/dto/create-column.dto.js';
import { UpdateColumnDto } from '../src/columns/dto/update-column.dto.js';
import { CreateBoardDto } from '../src/boards/dto/create-board.dto.js';
import { UpdateBoardDto } from '../src/boards/dto/update-board.dto.js';
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '../src/common/limits.js';

type Ctor = new () => object;

function errorsFor(cls: Ctor, payload: Record<string, unknown>) {
  return validateSync(plainToInstance(cls, payload) as object);
}

function messagesFor(cls: Ctor, payload: Record<string, unknown>) {
  return errorsFor(cls, payload).flatMap((e) => Object.values(e.constraints ?? {}));
}

const titleDtos: [string, Ctor][] = [
  ['CreateTaskDto', CreateTaskDto],
  ['UpdateTaskDto', UpdateTaskDto],
  ['CreateColumnDto', CreateColumnDto],
  ['UpdateColumnDto', UpdateColumnDto],
  ['CreateBoardDto', CreateBoardDto],
  ['UpdateBoardDto', UpdateBoardDto],
];

describe('ISSUE-004: title length is capped on every DTO that takes one', () => {
  it.each(titleDtos)('%s rejects a title over the limit', (_name, cls) => {
    const errors = errorsFor(cls, { title: 'x'.repeat(TITLE_MAX_LENGTH + 1) });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it.each(titleDtos)('%s accepts a title exactly at the limit', (_name, cls) => {
    expect(errorsFor(cls, { title: 'x'.repeat(TITLE_MAX_LENGTH) })).toHaveLength(0);
  });

  it.each(titleDtos)('%s still rejects an empty title', (_name, cls) => {
    const errors = errorsFor(cls, { title: '' });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('rejects the exact 5000-character title the QA run got a 201 for', () => {
    const errors = errorsFor(CreateTaskDto, { title: 'x'.repeat(5000) });

    expect(errors).toHaveLength(1);
  });

  it('gives a message a user can act on, not a raw constraint name', () => {
    const messages = messagesFor(CreateTaskDto, { title: 'x'.repeat(TITLE_MAX_LENGTH + 1) });

    expect(messages).toContain('Title must be 200 characters or fewer');
  });
});

describe('ISSUE-004: description length is capped too', () => {
  it('rejects a description over the limit', () => {
    const errors = errorsFor(CreateTaskDto, {
      title: 'ok',
      description: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1),
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('accepts a description exactly at the limit', () => {
    const errors = errorsFor(CreateTaskDto, {
      title: 'ok',
      description: 'x'.repeat(DESCRIPTION_MAX_LENGTH),
    });

    expect(errors).toHaveLength(0);
  });

  it('leaves description optional', () => {
    expect(errorsFor(CreateTaskDto, { title: 'ok' })).toHaveLength(0);
  });
});

describe('ISSUE-004: optional titles stay optional', () => {
  it.each([
    ['UpdateTaskDto', UpdateTaskDto],
    ['UpdateColumnDto', UpdateColumnDto],
    ['UpdateBoardDto', UpdateBoardDto],
  ] as [string, Ctor][])('%s allows an absent title', (_name, cls) => {
    expect(errorsFor(cls, {})).toHaveLength(0);
  });
});
