import * as Semver from 'semver'
import * as Zod from 'zod'
import { SimpleSecureReq } from '@typescriptprime/securereq'

const NpmPackageName = '@list-kr/filterslists'
const NpmPackagePath = '@list-kr%2Ffilterslists'

const NpmRegistryPackageDistTagSchema = Zod.object({
  'dist-tags': Zod.object({
    latest: Zod.string().refine(Semver.valid)
  })
})

// eslint-disable-next-line @typescript-eslint/naming-convention
type NpmRegistrySemverResponse = Awaited<ReturnType<typeof SimpleSecureReq.Request>> & { Body: { 'dist-tags': { latest: string }}}

export async function GetLatestPackageVersion(): Promise<string> {
  const CurrentNpmRegistryPackageDef: NpmRegistrySemverResponse = await SimpleSecureReq.Request(new URL('https://registry.npmjs.com/' + NpmPackagePath), {
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

  return Semver.clean(CurrentNpmRegistryPackageDef.Body['dist-tags'].latest)!
}

export function GetNextPackageVersionFromLatest(LatestPackageVersion: string, CurrentDate = new Date()): string {
  const CurrentDaytimeUTC = Math.trunc(Math.floor(CurrentDate.getTime() / 1000) / 86400)
  const CurrentSemver = Semver.parse(LatestPackageVersion)

  if (!CurrentSemver) {
    throw new Error('Invalid latest package version: ' + LatestPackageVersion)
  }

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

  return CurrentSemver.format()
}

export async function GetNextPackageVersion(): Promise<string> {
  return GetNextPackageVersionFromLatest(await GetLatestPackageVersion())
}

export function GetPublishedBuildManifestUrl(PackageVersion: string): string {
  return 'https://cdn.jsdelivr.net/npm/' + NpmPackageName + '@' + PackageVersion + '/dist/filterslists-build-manifest.json'
}
