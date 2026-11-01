/**
 * Aura Auth — cœur du service.
 *
 * Ce point d'entrée ne charge ni Express, ni `node:sqlite` : il reste utilisable
 * partout. Les adaptateurs s'importent séparément :
 *
 *   import { createSqliteDb } from "./aura/auth/server/adapters/sqlite.mjs"
 *   import { createExpressAuthRouter } from "./aura/auth/server/adapters/express.mjs"
 *   import { createWebAuthHandler } from "./aura/auth/server/adapters/web.mjs"
 */

export { createAuthService } from "./service.mjs"
export { AuthError, isAuthError } from "./errors.mjs"
export { resolveConfig } from "./config.mjs"
export { signJwt, verifyJwt, TokenError } from "./tokens.mjs"
export { dummyHash, hashPassword, verifyPassword } from "./password.mjs"
export {
  createConsoleMailer,
  createResendMailer,
  renderOtpEmail,
} from "./mailer.mjs"
export { createRateLimiter } from "./rate-limit.mjs"
export {
  readCookie,
  serializeClearCookie,
  serializeSessionCookie,
} from "./cookies.mjs"
export {
  maskEmail,
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from "./validate.mjs"
