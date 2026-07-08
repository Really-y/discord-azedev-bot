import { logger } from "./logger";
import { USER_FACING_ERRORS } from "./constants";

export function handleError(
  context: string,
  error: unknown,
  userFacingMessage?: string,
): string {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error(`[${context}] ${message}`, { stack });

  return userFacingMessage ?? USER_FACING_ERRORS.generic;
}

export function logAndReturnError(
  context: string,
  error: unknown,
  userFacingMessage?: string,
): string {
  return handleError(context, error, userFacingMessage);
}
