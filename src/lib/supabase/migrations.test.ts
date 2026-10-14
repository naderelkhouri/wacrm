import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Supabase database migrations integrity', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')

  it('has no duplicate migration version numbers', () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    expect(files.length).toBeGreaterThan(0)

    const versions = new Map<string, string[]>()

    for (const file of files) {
      const match = file.match(/^(\d+)_/)
      expect(
        match,
        `Migration file '${file}' must start with a numeric prefix like '001_'`,
      ).not.toBeNull()

      const version = match![1]
      const existing = versions.get(version) ?? []
      existing.push(file)
      versions.set(version, existing)
    }

    const duplicates: string[] = []
    for (const [version, fileList] of versions.entries()) {
      if (fileList.length > 1) {
        duplicates.push(
          `Version ${version} is duplicated across files: ${fileList.join(', ')}`,
        )
      }
    }

    expect(
      duplicates,
      `Duplicate migration versions found:\n${duplicates.join('\n')}`,
    ).toEqual([])
  })

  it('follows standard migration naming conventions (e.g. 001_name.sql)', () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    const validNamingRegex = /^\d{3}_[a-z0-9_]+\.sql$/

    for (const file of files) {
      expect(
        validNamingRegex.test(file),
        `Migration file '${file}' does not match expected naming convention /\\d{3}_[a-z0-9_]+\\.sql/`,
      ).toBe(true)
    }
  })
})
