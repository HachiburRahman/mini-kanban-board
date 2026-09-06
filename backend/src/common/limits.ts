/**
 * Shared input limits.
 *
 * Titles had a floor but no ceiling, so the API accepted a 5000-character card
 * title. One such card stretched its column past 1700px and pushed "Add card"
 * off screen - and on a shared board any member could do that to everyone.
 */
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 5000;

export const TITLE_MAX_MESSAGE = `Title must be ${TITLE_MAX_LENGTH} characters or fewer`;
export const DESCRIPTION_MAX_MESSAGE = `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`;

/**
 * Account field limits.
 *
 * The password ceiling is not arbitrary: bcrypt hashes only the first 72
 * BYTES and silently ignores the rest, so without a cap two different long
 * passwords sharing a 72-byte prefix would log into the same account. 72 is
 * the honest limit, so we state it rather than truncating behind the user's
 * back.
 */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 72;
export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254; // RFC 5321 maximum path length

export const PASSWORD_MIN_MESSAGE = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
export const PASSWORD_MAX_MESSAGE = `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`;
export const NAME_MAX_MESSAGE = `Name must be ${NAME_MAX_LENGTH} characters or fewer`;
export const EMAIL_MAX_MESSAGE = `Email must be ${EMAIL_MAX_LENGTH} characters or fewer`;
