/**
 * Erreur métier de l'auth Aura.
 *
 * Les adaptateurs HTTP la traduisent en réponse JSON :
 *   { error, code, retryAfter? }
 *
 * Tout le reste (erreur inattendue) doit rester un 500 générique : on ne
 * laisse jamais fuiter une stack trace ou un message SQL au client.
 */
export class AuthError extends Error {
  constructor(status, message, options = {}) {
    super(message)
    this.name = "AuthError"
    this.status = status
    this.code = options.code ?? codeForStatus(status)
    this.retryAfter = options.retryAfter
    this.details = options.details
  }
}

export function codeForStatus(status) {
  switch (status) {
    case 400:
      return "bad_request"
    case 401:
      return "unauthorized"
    case 403:
      return "forbidden"
    case 404:
      return "not_found"
    case 409:
      return "conflict"
    case 429:
      return "rate_limited"
    default:
      return status >= 500 ? "server_error" : "error"
  }
}

export function isAuthError(error) {
  return error instanceof AuthError
}
