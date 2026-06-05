import * as Zod from 'zod'
import * as Fs from 'node:fs'
import { GetNextPackageVersion } from './package-version.ts'

const FiltersListsConfigSchema = Zod.array(Zod.strictObject({
  Name: Zod.string(),
  DefinitionFileName: Zod.string(),
  Description: Zod.string(),
  ExpireDuration: Zod.number(),
  HomepageUrl: Zod.string().refine(Url => URL.canParse(Url)),
  SupportUrl: Zod.string().refine(Url => URL.canParse(Url)),
  LicenseUrl: Zod.string().refine(Url => URL.canParse(Url)),
  AdblockType: Zod.enum(['AdGuard', 'uBlockOrigin']),
  UnifiedDomainListFileName: Zod.string().optional()
}))

export type FiltersListsConfigWithVersion = (Zod.infer<typeof FiltersListsConfigSchema>[number] & { Version: string })[]

type FiltersListsConfigVersionOptions = {
  DefaultVersion?: string
  DefinitionVersionMap?: Record<string, string>
}

export async function LoadFiltersListsConfig(ConfigFilePath: string, VersionOptions: FiltersListsConfigVersionOptions = {}): Promise<FiltersListsConfigWithVersion> {
  // Load and validate filters lists config file
  const FiltersListConfig: Zod.infer<typeof FiltersListsConfigSchema> = JSON.parse(Fs.readFileSync(ConfigFilePath, { encoding: 'utf-8' }))
  await FiltersListsConfigSchema.parseAsync(FiltersListConfig)

  const DefaultVersion = VersionOptions.DefaultVersion ?? await GetNextPackageVersion()
  const FiltersListConfigWithVersion: FiltersListsConfigWithVersion = FiltersListConfig.map(Item => ({
    ...Item,
    Version: VersionOptions.DefinitionVersionMap?.[Item.DefinitionFileName] ?? DefaultVersion
  }))

  return FiltersListConfigWithVersion
}
