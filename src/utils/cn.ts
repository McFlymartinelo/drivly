export function cn(...xs: Array<string | false | undefined | null>): string {
  return xs.filter(Boolean).join(" ")
}

export function uid(): string {
  return crypto.randomUUID()
}
