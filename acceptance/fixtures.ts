import { createBareSoul, createDistilledSoul, createEvolvedSoul } from '../tests/e2e/fixtures/soul-fixtures.js'
import type { FixtureFactory, EnvironmentDeclaration } from './types.js'

const fixtures = new Map<string, FixtureFactory>()

fixtures.set('void', () => {
  // No-op: createTestHome already provides config.yaml
})

fixtures.set('bare-soul', (homeDir, opts) => {
  createBareSoul(homeDir, opts.soulName)
})

fixtures.set('distilled-soul', (homeDir, opts) => {
  createDistilledSoul(homeDir, opts.soulName, opts.persona)
})

fixtures.set('evolved-soul', (homeDir, opts) => {
  createEvolvedSoul(homeDir, opts.soulName, { persona: opts.persona })
})

export class UnknownFixtureError extends Error {
  constructor(name: string) {
    super(`UNKNOWN_FIXTURE: "${name}". Valid fixtures: ${[...fixtures.keys()].join(', ')}`)
    this.name = 'UnknownFixtureError'
  }
}

export function getFixture(name: string): FixtureFactory {
  const factory = fixtures.get(name)
  if (!factory) throw new UnknownFixtureError(name)
  return factory
}

export function applyFixture(
  homeDir: string,
  env: EnvironmentDeclaration,
): void {
  const factory = getFixture(env.fixture)
  factory(homeDir, {
    soulName: env.soulName,
    persona: env.persona,
  })
}
