import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function sources(dir: string): { file: string; text: string }[] {
  return readdirSync(join(SRC, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))
    .map((f) => ({ file: `${dir}/${f}`, text: readFileSync(join(SRC, dir, f), 'utf8') }))
}

function violations(dir: string, forbidden: [RegExp, string][]): string[] {
  return sources(dir).flatMap(({ file, text }) =>
    forbidden.filter(([pattern]) => pattern.test(text)).map(([, why]) => `${file}: ${why}`),
  )
}

describe('architecture boundaries', () => {
  it('keeps domain logic pure and portable', () => {
    expect(
      violations('logic', [
        [/from ['"]react/, 'imports React'],
        [/from ['"]\.\.\/(adapters|hooks|components|screens|data)/, 'imports an outer layer'],
        [/\b(window|document|localStorage|sessionStorage|navigator)\b/, 'touches browser globals'],
        [/Date\.now\(|new Date\(/, 'reads the clock; inject time instead'],
        [/Math\.random\(/, 'uses unseeded randomness'],
        [/\b(setTimeout|setInterval|requestAnimationFrame)\b/, 'schedules side effects'],
      ]),
    ).toEqual([])
  })

  it('keeps components and screens free of domain calculations and browser effects', () => {
    const problems = ['components', 'screens'].flatMap((dir) =>
      sources(dir).flatMap(({ file, text }) => {
        const runtimeImports = [...text.matchAll(/^import\s+(type\s)?[\s\S]*?from\s+['"]([^'"]+)['"]/gm)]
          .filter((m) => !m[1])
          .map((m) => m[2] ?? '')
        return [
          ...runtimeImports.filter((src) => /^\.\.\/(logic|adapters)\//.test(src)).map((src) => `${file}: imports ${src}; go through a hook`),
          ...(/localStorage|Date\.now\(/.test(text) ? [`${file}: performs effects directly`] : []),
        ]
      }),
    )
    expect(problems).toEqual([])
  })
})
