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
