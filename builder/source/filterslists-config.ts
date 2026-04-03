import * as Zod from 'zod'
import * as Semver from 'semver'
import * as Fs from 'node:fs'
import { SimpleSecureReq } from '@typescriptprime/securereq'

const FiltersListsConfigSchema = Zod.array(Zod.strictObject({
  Name: Zod.string(),
  DefinitionFileName: Zod.string(),
  Description: Zod.string(),
  ExpireDuration: Zod.number(),
  HomepageUrl: Zod.string().refine(Url => URL.canParse(Url)),
  SupportUrl: Zod.string().refine(Url => URL.canParse(Url)),
  LicenseUrl: Zod.string().refine(Url => URL.canParse(Url)),
  AdblockType: Zod.enum(['AdGuard', 'uBlockOrigin'])
}))

const NpmRegistryPackageDistTagSchema = Zod.object({
  'dist-tags': Zod.object({
    latest: Zod.string().refine(Semver.valid)
  })
})

const CurrentDate = new Date()
const CurrentDaytimeUTC = Math.trunc(Math.floor(CurrentDate.getTime() / 1000) / 86400)

// eslint-disable-next-line @typescript-eslint/naming-convention
type NpmRegistrySemverResponse = Awaited<ReturnType<typeof SimpleSecureReq.Request>> & { Body: { 'dist-tags': { latest: string }}}
export type FiltersListsConfigWithVersion = (Zod.infer<typeof FiltersListsConfigSchema>[number] & { Version: string })[]

export async function LoadFiltersListsConfig(ConfigFilePath: string): Promise<FiltersListsConfigWithVersion> {
  // Load and validate filters lists config file
  const FiltersListConfig: Zod.infer<typeof FiltersListsConfigSchema> = JSON.parse(Fs.readFileSync(ConfigFilePath, { encoding: 'utf-8' }))
  await FiltersListsConfigSchema.parseAsync(FiltersListConfig)

  // Download npm package definition from registry.npmjs.com
  const CurrentNpmRegistryPackageDef: NpmRegistrySemverResponse = await SimpleSecureReq.Request(new URL('https://registry.npmjs.com/@list-kr/filterslists'), {
    HttpMethod: 'GET',
    ExpectedAs: 'JSON',
    TLS: {
      IsHTTPSEnforced: true,
      MinTLSVersion: 'TLSv1.2',
      MaxTLSVersion: 'TLSv1.2',
      Ciphers: ['ECDHE-ECDSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-CHACHA20-POLY1305'],
      KeyExchanges: ['x25519', 'secp521r1', 'secp384r1', 'secp256r1']
    }
  }) as NpmRegistrySemverResponse
  await NpmRegistryPackageDistTagSchema.parseAsync(CurrentNpmRegistryPackageDef.Body)
  
  // Bump semver
  let CurrentSemver = Semver.parse(CurrentNpmRegistryPackageDef.Body['dist-tags'].latest)!
  if (CurrentSemver.major !== CurrentDate.getUTCFullYear() || CurrentSemver.minor !== CurrentDaytimeUTC) {
    CurrentSemver.major = CurrentDate.getUTCFullYear()
    CurrentSemver.minor = CurrentDaytimeUTC
    CurrentSemver.patch = 0
  } else {
    CurrentSemver.patch += 1
  }
  if (CurrentSemver.prerelease.length > 0) {
    CurrentSemver.prerelease = []
  }
  const FiltersListConfigWithVersion: FiltersListsConfigWithVersion = FiltersListConfig.map(Item => ({
    ...Item,
    Version: CurrentSemver.format()
  }))

  return FiltersListConfigWithVersion
}