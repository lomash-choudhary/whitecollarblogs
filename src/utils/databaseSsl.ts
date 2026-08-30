/**
 * Works out whether a Postgres connection needs TLS.
 *
 * Hosted Postgres (Neon, Supabase, RDS…) refuses plaintext connections, but
 * node-postgres only turns TLS on if the URL asks for it. A connection string
 * pasted without `?sslmode=require` therefore fails with a confusing
 * "connection is insecure" error. So: honour an explicit sslmode when one is
 * given, and otherwise switch TLS on for anything that isn't local.
 *
 * Keep in sync with the same logic in scripts/upgrade-db-multisite.mjs, which
 * runs under plain node and cannot import this file.
 */

export type DatabaseSsl = boolean | { rejectUnauthorized: boolean } | undefined

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

export function isLocalDatabase(connectionString: string): boolean {
  try {
    const { hostname } = new URL(connectionString)
    return LOCAL_HOSTS.has(hostname)
  } catch {
    return false
  }
}

export function databaseSsl(connectionString: string): DatabaseSsl {
  // An explicit sslmode in the URL wins; node-postgres already handles it.
  if (/[?&]sslmode=/i.test(connectionString)) return undefined

  if (isLocalDatabase(connectionString)) return undefined

  // Remote host with nothing specified: use TLS and verify the certificate.
  // Providers whose chain Node cannot verify need DATABASE_SSL_NO_VERIFY=true.
  return process.env.DATABASE_SSL_NO_VERIFY === 'true' ? { rejectUnauthorized: false } : true
}
