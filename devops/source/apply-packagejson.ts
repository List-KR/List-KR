import * as Semver from 'semver'
import PackageJson from '@npmcli/package-json'
import { SafeInitCwd } from './utils/cwd.ts'
import { GetNextPackageVersion } from '@builder/package-version.ts'

const Cwd = SafeInitCwd({ Cwd: process.cwd(), InitCwd: process.env.INIT_CWD })
const RootPackageJson = await PackageJson.load(Cwd)
const NewVersion = process.env.FILTERSLISTS_NEXT_PACKAGE_VERSION?.trim() || await GetNextPackageVersion()
const CleanVersion = Semver.clean(NewVersion)

if (!CleanVersion) {
  throw new Error('Invalid package version: ' + NewVersion)
}

RootPackageJson.update({
  version: CleanVersion
})
await RootPackageJson.save()
