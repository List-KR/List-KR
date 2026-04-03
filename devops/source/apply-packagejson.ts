import * as Zod from 'zod'
import * as Semver from 'semver'
import PackageJson from '@npmcli/package-json'
import { SimpleSecureReq } from '@typescriptprime/securereq'
import { SafeInitCwd } from './utils/cwd.ts'

// eslint-disable-next-line @typescript-eslint/naming-convention
type NpmRegistrySemverResponse = Awaited<ReturnType<typeof SimpleSecureReq.Request>> & { Body: { 'dist-tags': { latest: string }}}

const CurrentDate = new Date()
const CurrentDaytimeUTC = Math.trunc(Math.floor(CurrentDate.getTime() / 1000) / 86400)

const NpmRegistryPackageDistTagSchema = Zod.object({
  'dist-tags': Zod.object({
    latest: Zod.string().refine(Semver.valid)
  })
})

async function NewSemverVersion(): Promise<string> {
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
  return CurrentSemver.format()
}

const Cwd = SafeInitCwd({ Cwd: process.cwd(), InitCwd: process.env.INIT_CWD })
const RootPackageJson = await PackageJson.load(Cwd)
const NewVersion = await NewSemverVersion()
RootPackageJson.update({
  version: Semver.clean(NewVersion)!
})
await RootPackageJson.save()