import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Zod from 'zod'

export const BuildManifestFileName = 'filterslists-build-manifest.json'
export const BuildManifestSchemaVersion = 1
export const BuildManifestHashAlgorithm = 'sha384'

export const BuildManifestOutputSchema = Zod.strictObject({
  path: Zod.string(),
  sha384: Zod.string()
})

export const BuildManifestDefinitionSchema = Zod.strictObject({
  definitionFileName: Zod.string(),
  version: Zod.string(),
  combinedSha384: Zod.string(),
  outputs: Zod.array(BuildManifestOutputSchema)
})

export const BuildManifestSchema = Zod.strictObject({
  schemaVersion: Zod.literal(BuildManifestSchemaVersion),
  hashAlgorithm: Zod.literal(BuildManifestHashAlgorithm),
  packageVersion: Zod.string(),
  generatedAt: Zod.string(),
  definitions: Zod.array(BuildManifestDefinitionSchema)
})

export type BuildManifest = Zod.infer<typeof BuildManifestSchema>
export type BuildManifestDefinition = Zod.infer<typeof BuildManifestDefinitionSchema>
export type BuildManifestOutput = Zod.infer<typeof BuildManifestOutputSchema>

export type BuildManifestOutputContent = {
  Path: string
  Body: string
}

export type BuildManifestDiff = {
  ChangedDefinitionFileNames: string[]
  ChangedOutputPaths: string[]
}

type ManifestDefinitionInput = {
  DefinitionFileName: string
  Version: string
}

export function NormalizeFilterListForContentHash(RawFilterList: string): string {
  return RawFilterList.replace(/^! Version:.*(?:\r\n|\n|\r|$)/gmu, '')
}

export function Sha384Hex(Content: string | Buffer): string {
  return Crypto.createHash(BuildManifestHashAlgorithm).update(Content).digest('hex')
}

export function CreateDefinitionManifestFromOutputs(
  DefinitionFileName: string,
  Version: string,
  Outputs: BuildManifestOutputContent[]
): BuildManifestDefinition {
  const HashedOutputs = Outputs
    .map(Output => ({
      path: NormalizeManifestPath(Output.Path),
      sha384: Sha384Hex(NormalizeFilterListForContentHash(Output.Body))
    }))
    .sort((A, B) => A.path.localeCompare(B.path))

  return {
    definitionFileName: DefinitionFileName,
    version: Version,
    combinedSha384: Sha384Hex(HashedOutputs.map(Output => Output.path + '\0' + Output.sha384).join('\n')),
    outputs: HashedOutputs
  }
}

export function CreateBuildManifest(
  PackageVersion: string,
  Definitions: BuildManifestDefinition[],
  GeneratedAt = new Date().toISOString()
): BuildManifest {
  return {
    schemaVersion: BuildManifestSchemaVersion,
    hashAlgorithm: BuildManifestHashAlgorithm,
    packageVersion: PackageVersion,
    generatedAt: GeneratedAt,
    definitions: [...Definitions].sort((A, B) => A.definitionFileName.localeCompare(B.definitionFileName))
  }
}

export function CreateBuildManifestFromOutputDirectory(
  OutputDirectory: string,
  PackageVersion: string,
  Definitions: ManifestDefinitionInput[],
  GeneratedAt = new Date().toISOString()
): BuildManifest {
  return CreateBuildManifest(
    PackageVersion,
    Definitions.map(Definition => CreateDefinitionManifestFromOutputDirectory(OutputDirectory, Definition)),
    GeneratedAt
  )
}

export function CreateDefinitionManifestFromOutputDirectory(
  OutputDirectory: string,
  Definition: ManifestDefinitionInput
): BuildManifestDefinition {
  const DefinitionBaseName = Path.basename(Definition.DefinitionFileName, Path.extname(Definition.DefinitionFileName))
  const OutputFiles = [
    Path.resolve(OutputDirectory, Definition.DefinitionFileName),
    ...ReadDirectoryFiles(Path.resolve(OutputDirectory, 'resolved', DefinitionBaseName))
  ]
  const Outputs = OutputFiles
    .filter(OutputFile => Fs.existsSync(OutputFile))
    .map(OutputFile => ({
      Path: Path.relative(OutputDirectory, OutputFile),
      Body: Fs.readFileSync(OutputFile, 'utf-8')
    }))

  return CreateDefinitionManifestFromOutputs(Definition.DefinitionFileName, Definition.Version, Outputs)
}

export function WriteBuildManifest(ManifestFilePath: string, Manifest: BuildManifest): void {
  Fs.mkdirSync(Path.dirname(ManifestFilePath), { recursive: true })
  Fs.writeFileSync(ManifestFilePath, JSON.stringify(Manifest, null, 2) + '\n', 'utf-8')
}

export function ParseBuildManifest(RawManifest: unknown): BuildManifest {
  return BuildManifestSchema.parse(RawManifest)
}

export function CompareBuildManifests(PreviousManifest: BuildManifest | null, CurrentManifest: BuildManifest): BuildManifestDiff {
  if (PreviousManifest === null) {
    return {
      ChangedDefinitionFileNames: CurrentManifest.definitions.map(Definition => Definition.definitionFileName),
      ChangedOutputPaths: CurrentManifest.definitions.flatMap(Definition => Definition.outputs.map(Output => Output.path))
    }
  }

  const PreviousDefinitions = new Map(PreviousManifest.definitions.map(Definition => [Definition.definitionFileName, Definition]))
  const ChangedDefinitionFileNames: string[] = []
  const ChangedOutputPaths: string[] = []

  for (const CurrentDefinition of CurrentManifest.definitions) {
    const PreviousDefinition = PreviousDefinitions.get(CurrentDefinition.definitionFileName)
    if (!PreviousDefinition || PreviousDefinition.combinedSha384 !== CurrentDefinition.combinedSha384) {
      ChangedDefinitionFileNames.push(CurrentDefinition.definitionFileName)
      ChangedOutputPaths.push(...FindChangedOutputPaths(PreviousDefinition, CurrentDefinition))
    }
  }

  return {
    ChangedDefinitionFileNames,
    ChangedOutputPaths: [...new Set(ChangedOutputPaths)].sort()
  }
}

export function CreateDefinitionVersionMap(
  PreviousManifest: BuildManifest | null,
  CurrentManifest: BuildManifest,
  ChangedDefinitionFileNames: string[],
  NextPackageVersion: string
): Record<string, string> {
  const PreviousDefinitions = new Map((PreviousManifest?.definitions ?? []).map(Definition => [Definition.definitionFileName, Definition]))
  const ChangedDefinitions = new Set(ChangedDefinitionFileNames)
  const DefinitionVersionMap: Record<string, string> = {}

  for (const Definition of CurrentManifest.definitions) {
    DefinitionVersionMap[Definition.definitionFileName] = ChangedDefinitions.has(Definition.definitionFileName)
      ? NextPackageVersion
      : PreviousDefinitions.get(Definition.definitionFileName)?.version ?? NextPackageVersion
  }

  return DefinitionVersionMap
}

function FindChangedOutputPaths(
  PreviousDefinition: BuildManifestDefinition | undefined,
  CurrentDefinition: BuildManifestDefinition
): string[] {
  if (!PreviousDefinition) {
    return CurrentDefinition.outputs.map(Output => Output.path)
  }

  const PreviousOutputs = new Map(PreviousDefinition.outputs.map(Output => [Output.path, Output]))
  const CurrentOutputPaths = new Set(CurrentDefinition.outputs.map(Output => Output.path))
  const ChangedOutputPaths: string[] = []

  for (const CurrentOutput of CurrentDefinition.outputs) {
    if (PreviousOutputs.get(CurrentOutput.path)?.sha384 !== CurrentOutput.sha384) {
      ChangedOutputPaths.push(CurrentOutput.path)
    }
  }
  for (const PreviousOutput of PreviousDefinition.outputs) {
    if (!CurrentOutputPaths.has(PreviousOutput.path)) {
      ChangedOutputPaths.push(PreviousOutput.path)
    }
  }

  return ChangedOutputPaths
}

function ReadDirectoryFiles(DirectoryPath: string): string[] {
  if (!Fs.existsSync(DirectoryPath)) {
    return []
  }

  return Fs.readdirSync(DirectoryPath)
    .map(FileName => Path.resolve(DirectoryPath, FileName))
    .filter(FilePath => Fs.statSync(FilePath).isFile())
}

function NormalizeManifestPath(FilePath: string): string {
  return FilePath.split(Path.sep).join(Path.posix.sep)
}
