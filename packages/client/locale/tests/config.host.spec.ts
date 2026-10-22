import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as HostPlugin from '../src/index.ts'
import { liveConfig, omitsGeneratedPage } from '../../../settings/settings/tests/live-config.ts'
import { plainConfig } from '../../../settings/settings/src/schema.ts'
import {
  Config, LOCALE_STACK_MAX_LENGTH, apply,
} from '@deepseek-ai/dsh-client-locale'

const STACK_OVER_LIMIT = ['ru', 'en', 'zh', 'ja', 'fr', 'de', 'pt', 'it', 'es'].slice(0, LOCALE_STACK_MAX_LENGTH + 1)

describe('locale host', () => {
  it('registers an open locale preference with the Host settings lifecycle', async () => {
    const ctx = new Context()
    const configuration = await liveConfig(ctx, { Config, apply })
    const { fiber } = configuration
    // The stack is an array field, so schemastery normalizes its absence to [].
    expect(plainConfig(configuration.fiber.config)).toEqual({ languages: [] })
    await configuration.update({ preference: 'en' })
    expect(plainConfig(configuration.fiber.config)).toEqual({ preference: 'en', languages: [] })
    await configuration.update({ preference: 'pt-BR' })
    expect(plainConfig(configuration.fiber.config)).toEqual({ preference: 'pt-BR', languages: [] })
    await expect(configuration.update({ preference: 'bad locale' })).rejects.toThrow()
    await expect(configuration.update({ preference: '123' })).rejects.toThrow()
    await fiber.dispose()
  })

  it('projects an ordered language stack beside the single preference', async () => {
    const ctx = new Context()
    const configuration = await liveConfig(ctx, { Config, apply })
    const { fiber } = configuration
    await configuration.update({ preference: 'ru', languages: ['ru', 'en', 'zh'] })
    expect(plainConfig(configuration.fiber.config)).toEqual({ preference: 'ru', languages: ['ru', 'en', 'zh'] })
    // A stack entry naming a language no catalog hosts is a document the Host
    // must still accept: the client skips it at resolution instead.
    await configuration.update({ languages: ['xx', 'en'] })
    expect(plainConfig(configuration.fiber.config)).toEqual({ preference: 'ru', languages: ['xx', 'en'] })
    await expect(configuration.update({ languages: ['bad locale'] })).rejects.toThrow()
    await expect(configuration.update({ languages: STACK_OVER_LIMIT })).rejects.toThrow()
    await fiber.dispose()
  })
})

it('keeps its own instance off the generated Settings pages', () => omitsGeneratedPage(ctx => ctx.plugin(HostPlugin)))
