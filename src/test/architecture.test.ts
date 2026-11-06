import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

function sources(dir: string): { file: string; text: string }[] {
  return readdirSync(join(SRC, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts'))
    .map((f) => ({ file: join(dir, f), text: readFileSync(join(SRC, dir, f), 'utf8') }))
}

function violations(dir: string, forbidden: [RegExp, string][]): string[] {
  return sources(dir).flatMap(({ file, text }) =>
    forbidden.filter(([pattern]) => pattern.test(text)).map(([, why]) => `${file}: ${why}`),
  )
}

/** Resolve relative imports at any folder depth; inline type specifiers are not runtime edges. */
function imports(file: string, text: string): { target: string; runtime: boolean }[] {
  const declarations = [...text.matchAll(/^(?:import|export)\s+(type\s+)?(\{[^}]*\}|\*\s*(?:as\s+\w+)?|[\w$]+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)\s+from\s+['"]([^'"]+)['"]/gm)]
    .map(match => ({ specifier: match[3]!, runtime: !match[1] && !(match[2]!.trim().startsWith('{') &&
      match[2]!.trim().slice(1, -1).split(',').filter(value => value.trim()).every(value => value.trim().startsWith('type '))) }))
  const sideEffects = [...text.matchAll(/^import\s+['"]([^'"]+)['"]/gm)].map(match => ({ specifier: match[1]!, runtime: true }))
  return [...declarations, ...sideEffects].map(({ specifier, runtime }) => ({
    target: specifier.startsWith('.') ? relative(SRC, resolve(SRC, dirname(file), specifier)) : specifier,
    runtime,
  }))
}

describe('architecture boundaries', () => {
  it('keeps domain logic pure and portable', () => {
    expect(
      violations('logic', [
        [/from ['"]react/, 'imports React'],
        [/\b(window|document|localStorage|sessionStorage|navigator)\b/, 'touches browser globals'],
        [/Date\.now\(|new Date\(/, 'reads the clock; inject time instead'],
        [/Math\.random\(/, 'uses unseeded randomness'],
        [/\b(setTimeout|setInterval|requestAnimationFrame)\b/, 'schedules side effects'],
      ]),
    ).toEqual([])
    expect(sources('logic').flatMap(({ file, text }) => imports(file, text)
      .filter(({ target }) => /^(adapters|hooks|components|screens|data)\//.test(target))
      .map(({ target }) => `${file}: imports outer layer ${target}`))).toEqual([])
  })

  it('keeps components and screens free of domain calculations and browser effects', () => {
    const problems = ['components', 'screens'].flatMap((dir) =>
      sources(dir).flatMap(({ file, text }) => {
        const runtimeImports = imports(file, text).filter(item => item.runtime).map(item => item.target)
        return [
          // These two pure geometry modules are the production renderer's shared contact math.
          // They cannot decide timer, persistence, feedback or reward facts.
          ...runtimeImports.filter((src) => /^(logic|adapters)\//.test(src) &&
            !(file.startsWith('components/companion/') && ['logic/scene-pose', 'logic/scene-food-rig'].includes(src))).map((src) => `${file}: imports ${src}; go through a hook`),
          ...(/localStorage|Date\.now\(/.test(text) ? [`${file}: performs effects directly`] : []),
        ]
      }),
    )
    expect(problems).toEqual([])
  })

  it('keeps test fixtures and build-only artwork out of application modules', () => {
    expect(sources('').filter(({ file }) => !file.startsWith('test/')).flatMap(({ file, text }) => imports(file, text)
      .filter(({ target }) => /^(test\/|\.\.\/scripts\/)/.test(target))
      .map(({ target }) => `${file}: imports tooling ${target}`))).toEqual([])
  })
})
