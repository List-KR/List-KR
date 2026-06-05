import * as Core from '@actions/core'
import { Octokit } from '@octokit/rest'
import * as Zod from 'zod'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Process from 'node:process'
import * as Os from 'node:os'
import * as ChildProcess from 'node:child_process'
import { SimpleSecureReq } from '@typescriptprime/securereq'
import {
  BuildManifestFileName,
  CompareBuildManifests,
  CreateDefinitionVersionMap,
  ParseBuildManifest,
  type BuildManifest
} from '@builder/build-manifest.ts'
import { GetLatestPackageVersion, GetNextPackageVersionFromLatest, GetPublishedBuildManifestUrl } from '@builder/package-version.ts'

const FiltersListsConfigSchema = Zod.array(Zod.object({
  DefinitionFileName: Zod.string()
}).loose())

const Env = await Zod.object({
  GH_TOKEN: Zod.string().nonempty(),
  REPO: Zod.string().nonempty().refine(V => /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(V)),
  WORKFLOW_FILE: Zod.string().nonempty(),
  TARGET_JOB_NAME: Zod.string().nonempty(),
  MIN_SECONDS: Zod.string().nonempty().transform(V => Number(V)).refine(V => Number.isFinite(V) && V >= 0),
  CURRENT_RUN_ID: Zod.string().nonempty().transform(V => Number(V)),
  FORCE_RUN: Zod.string().nonempty().transform(V => V === 'true'),
  EVENT_NAME: Zod.string().nonempty(),
  UNIFIED_CONFIG_FILE: Zod.string().nonempty().default('filterslists/filterslists.config.json')
}).strip().parseAsync(Process.env)

type BuildManifestResponse = Awaited<ReturnType<typeof SimpleSecureReq.Request>> & {
  Body: unknown
}

type PackageVersionContext = {
  LatestPackageVersion: string
  NextPackageVersion: string
}

type PreviousBuildManifestResult = {
  Manifest: BuildManifest | null
  Url: string
}

const WorkingDirectory = Path.resolve(import.meta.dirname, '../..')
const Owner = Env.REPO.split('/')[0]
const Repo = Env.REPO.split('/')[1]

const OctokitInstance = new Octokit({
  auth: Env.GH_TOKEN
})

const WorkflowRuns = await OctokitInstance.actions.listWorkflowRunsForRepo({
  owner: Owner,
  repo: Repo,
  workflow_id: Env.WORKFLOW_FILE,
  per_page: 100
})

const PreviousRuns = WorkflowRuns.data.workflow_runs
  .filter(Run => Run.id !== Env.CURRENT_RUN_ID)
  .sort((A, B) => new Date(B.created_at).getTime() - new Date(A.created_at).getTime())

let ShouldRun = false
let MatchedRunId = ''
let MatchedTime = ''
let BlockedByRunId = ''
let BlockedByJob = ''
let ExternalSourceChanged = false
let MatchedExternalSourceName = ''
let MatchedExternalSourceUrl = ''
let MatchedExternalSourceModifiedAt = ''
let NextPackageVersion = ''
let ManifestAvailable = false
let ChangedDefinitionFileNames: string[] = []
let ChangedOutputPaths: string[] = []
let DefinitionVersionsJson = '{}'

function EmitDecision(): void {
  Core.info(`should_run=${ShouldRun}`)
  Core.info(`matched_run_id=${MatchedRunId}`)
  Core.info(`matched_time=${MatchedTime}`)
  Core.info(`blocked_by_run_id=${BlockedByRunId}`)
  Core.info(`blocked_by_job=${BlockedByJob}`)
  Core.info(`external_source_changed=${ExternalSourceChanged}`)
  Core.info(`matched_external_source_name=${MatchedExternalSourceName}`)
  Core.info(`matched_external_source_url=${MatchedExternalSourceUrl}`)
  Core.info(`matched_external_source_modified_at=${MatchedExternalSourceModifiedAt}`)
  Core.info(`next_package_version=${NextPackageVersion}`)
  Core.info(`manifest_available=${ManifestAvailable}`)
  Core.info(`changed_definition_file_names=${JSON.stringify(ChangedDefinitionFileNames)}`)
  Core.info(`changed_output_paths=${JSON.stringify(ChangedOutputPaths)}`)
  Core.info(`definition_versions_json=${DefinitionVersionsJson}`)

  Core.setOutput('should_run', String(ShouldRun))
  Core.setOutput('matched_run_id', MatchedRunId)
  Core.setOutput('matched_time', MatchedTime)
  Core.setOutput('blocked_by_run_id', BlockedByRunId)
  Core.setOutput('blocked_by_job', BlockedByJob)
  Core.setOutput('external_source_changed', String(ExternalSourceChanged))
  Core.setOutput('matched_external_source_name', MatchedExternalSourceName)
  Core.setOutput('matched_external_source_url', MatchedExternalSourceUrl)
  Core.setOutput('matched_external_source_modified_at', MatchedExternalSourceModifiedAt)
  Core.setOutput('next_package_version', NextPackageVersion)
  Core.setOutput('manifest_available', String(ManifestAvailable))
  Core.setOutput('changed_definition_file_names', JSON.stringify(ChangedDefinitionFileNames))
  Core.setOutput('changed_output_paths', JSON.stringify(ChangedOutputPaths))
  Core.setOutput('definition_versions_json', DefinitionVersionsJson)
}

function LoadConfiguredDefinitionFileNames(): string[] {
  const ConfigFilePath = Path.resolve(WorkingDirectory, Env.UNIFIED_CONFIG_FILE)
  const RawConfig = JSON.parse(Fs.readFileSync(ConfigFilePath, 'utf-8')) as unknown
  const FiltersListsConfig = FiltersListsConfigSchema.parse(RawConfig)

  return FiltersListsConfig.map(Definition => Definition.DefinitionFileName)
}

async function LoadPackageVersionContext(): Promise<PackageVersionContext> {
  const LatestPackageVersion = await GetLatestPackageVersion()

  return {
    LatestPackageVersion,
    NextPackageVersion: GetNextPackageVersionFromLatest(LatestPackageVersion)
  }
}

async function LoadPreviousBuildManifest(LatestPackageVersion: string): Promise<PreviousBuildManifestResult> {
  const Url = GetPublishedBuildManifestUrl(LatestPackageVersion)

  try {
    const Response = await SimpleSecureReq.Request(new URL(Url), {
      HttpMethod: 'GET',
      ExpectedAs: 'JSON',
      FollowRedirects: true,
      MaxRedirects: 5,
      TimeoutMs: 30000
    }) as BuildManifestResponse

    if (Response.StatusCode < 200 || Response.StatusCode >= 300) {
      Core.warning('[build-manifest] Failed to download previous manifest from ' + Url + ': HTTP ' + Response.StatusCode)
      return { Manifest: null, Url }
    }

    return { Manifest: ParseBuildManifest(Response.Body), Url }
  } catch (ErrorValue) {
    Core.warning('[build-manifest] Failed to load previous manifest from ' + Url + ': ' + FormatError(ErrorValue))
    return { Manifest: null, Url }
  }
}

async function BuildCandidateManifest(PackageVersion: string): Promise<BuildManifest> {
  const OutputDirectory = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'filterslists-preflight-'))
  const ManifestFilePath = Path.join(OutputDirectory, BuildManifestFileName)

  Core.info('[build-manifest] Building candidate outputs in ' + OutputDirectory)
  await RunNpmBuild({
    ...Process.env,
    FILTERSLISTS_OUTPUT_DIR: OutputDirectory,
    FILTERSLISTS_BUILD_MANIFEST_FILE: ManifestFilePath,
    FILTERSLISTS_NEXT_PACKAGE_VERSION: PackageVersion,
    FILTERSLISTS_DEFINITION_VERSIONS_JSON: undefined
  })

  return ParseBuildManifest(JSON.parse(Fs.readFileSync(ManifestFilePath, 'utf-8')) as unknown)
}

async function RunNpmBuild(Environment: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((Resolve, Reject) => {
    const Child = ChildProcess.spawn('npm', ['run', 'build', '-w', 'builder'], {
      cwd: WorkingDirectory,
      env: Environment,
      stdio: 'inherit'
    })

    Child.on('error', Reject)
    Child.on('exit', Code => {
      if (Code === 0) {
        Resolve()
      } else {
        Reject(new Error('Candidate build failed with exit code ' + String(Code)))
      }
    })
  })
}

function UseAllDefinitions(VersionContext: PackageVersionContext): void {
  NextPackageVersion = VersionContext.NextPackageVersion
  ChangedDefinitionFileNames = LoadConfiguredDefinitionFileNames()
  ChangedOutputPaths = []
  DefinitionVersionsJson = JSON.stringify(Object.fromEntries(
    ChangedDefinitionFileNames.map(DefinitionFileName => [DefinitionFileName, VersionContext.NextPackageVersion])
  ))
  ShouldRun = true
}

function ApplyManifestDecision(
  PreviousManifest: BuildManifest | null,
  CandidateManifest: BuildManifest,
  VersionContext: PackageVersionContext,
  HasNewCommits: boolean
): void {
  const Diff = CompareBuildManifests(PreviousManifest, CandidateManifest)
  const DefinitionVersionMap = CreateDefinitionVersionMap(
    PreviousManifest,
    CandidateManifest,
    Diff.ChangedDefinitionFileNames,
    VersionContext.NextPackageVersion
  )

  NextPackageVersion = VersionContext.NextPackageVersion
  ChangedDefinitionFileNames = Diff.ChangedDefinitionFileNames
  ChangedOutputPaths = Diff.ChangedOutputPaths
  DefinitionVersionsJson = JSON.stringify(DefinitionVersionMap)
  ShouldRun = ChangedDefinitionFileNames.length > 0
  ExternalSourceChanged = ShouldRun && Env.EVENT_NAME === 'schedule' && !HasNewCommits
  if (ExternalSourceChanged) {
    MatchedExternalSourceName = 'output-hash-manifest'
    MatchedExternalSourceUrl = GetPublishedBuildManifestUrl(VersionContext.LatestPackageVersion)
    MatchedExternalSourceModifiedAt = CandidateManifest.generatedAt
  }
}

async function HasNewCommitsSince(Since: string): Promise<boolean> {
  const NewCommits = await OctokitInstance.repos.listCommits({
    owner: Owner,
    repo: Repo,
    sha: 'master',
    since: Since,
    per_page: 1
  })

  return NewCommits.data.length > 0
}

function FormatError(ErrorValue: unknown): string {
  if (ErrorValue instanceof Error) {
    return ErrorValue.message
  }

  return String(ErrorValue)
}

if (Env.FORCE_RUN) {
  UseAllDefinitions(await LoadPackageVersionContext())
  EmitDecision()
  Process.exit(0)
}

if (PreviousRuns.length === 0) {
  UseAllDefinitions(await LoadPackageVersionContext())
  EmitDecision()
  Process.exit(0)
}

let LatestSuccessfulPrepare: {
  RunId: number
  CompletedAt: string
  JobName: string
} | null = null

for (const Run of PreviousRuns) {
  const Jobs = await OctokitInstance.actions.listJobsForWorkflowRun({
    owner: Owner,
    repo: Repo,
    run_id: Run.id,
    per_page: 100
  })

  const SuccessJob = Jobs.data.jobs.find(Job => (
    Job.name === Env.TARGET_JOB_NAME
    && Job.conclusion === 'success'
  ))

  if (SuccessJob !== undefined && SuccessJob.completed_at !== null) {
    LatestSuccessfulPrepare = {
      RunId: Run.id,
      CompletedAt: SuccessJob.completed_at,
      JobName: SuccessJob.name
    }
    break
  }
}

if (LatestSuccessfulPrepare !== null) {
  MatchedRunId = String(LatestSuccessfulPrepare.RunId)
  MatchedTime = LatestSuccessfulPrepare.CompletedAt

  const CompletedAtMs = Date.parse(LatestSuccessfulPrepare.CompletedAt)
  const ThresholdMs = Date.now() - (Env.MIN_SECONDS * 1000)
  const CooldownPassed = Number.isFinite(CompletedAtMs) && CompletedAtMs <= ThresholdMs

  if (!CooldownPassed) {
    BlockedByRunId = String(LatestSuccessfulPrepare.RunId)
    BlockedByJob = LatestSuccessfulPrepare.JobName
    ShouldRun = false
  } else {
    const VersionContext = await LoadPackageVersionContext()
    const PreviousManifest = await LoadPreviousBuildManifest(VersionContext.LatestPackageVersion)
    const CandidateManifest = await BuildCandidateManifest(VersionContext.NextPackageVersion)
    const HasNewCommits = Env.EVENT_NAME === 'schedule'
      ? await HasNewCommitsSince(LatestSuccessfulPrepare.CompletedAt)
      : true

    ManifestAvailable = PreviousManifest.Manifest !== null
    ApplyManifestDecision(PreviousManifest.Manifest, CandidateManifest, VersionContext, HasNewCommits)
    Core.info('[build-manifest] Changed definitions: ' + ChangedDefinitionFileNames.join(', '))
    Core.info('[build-manifest] Changed outputs: ' + ChangedOutputPaths.join(', '))
  }
} else {
  UseAllDefinitions(await LoadPackageVersionContext())
}

EmitDecision()
