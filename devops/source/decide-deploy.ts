import * as Core from '@actions/core'
import { Octokit } from '@octokit/rest'
import * as Zod from 'zod'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Process from 'node:process'
import { SimpleSecureReq } from '@typescriptprime/securereq'
import {
  DeduplicateUnifiedExternalSources,
  GetUnifiedExternalSourceUrls,
  type UnifiedExternalSource,
  type UnifiedExternalSourceAdblockType
} from '@builder/unified-external-source-urls.ts'

const UnifiedFiltersListsConfigSchema = Zod.array(Zod.object({
  AdblockType: Zod.enum(['AdGuard', 'uBlockOrigin']),
  UnifiedDomainListFileName: Zod.string().optional()
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

type UnifiedExternalSourceHeadResponse = Awaited<ReturnType<typeof SimpleSecureReq.Request>> & {
  Headers: Record<string, string | string[] | undefined>
}

type ChangedUnifiedExternalSource = UnifiedExternalSource & {
  ModifiedAt: string
  Reason: string
}

const WorkingDirectory = Path.resolve(import.meta.dirname, '../..')
const HeadRequestTimeoutMs = 30000

const OctokitInstance = new Octokit({
  auth: Env.GH_TOKEN
})

const WorkflowRuns = await OctokitInstance.actions.listWorkflowRunsForRepo({
  owner: Env.REPO.split('/')[0],
  repo: Env.REPO.split('/')[1],
  workflow_id: Env.WORKFLOW_FILE,
  per_page: 100
})

const Owner = Env.REPO.split('/')[0]
const Repo = Env.REPO.split('/')[1]

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

  Core.setOutput('should_run', String(ShouldRun))
  Core.setOutput('matched_run_id', MatchedRunId)
  Core.setOutput('matched_time', MatchedTime)
  Core.setOutput('blocked_by_run_id', BlockedByRunId)
  Core.setOutput('blocked_by_job', BlockedByJob)
  Core.setOutput('external_source_changed', String(ExternalSourceChanged))
  Core.setOutput('matched_external_source_name', MatchedExternalSourceName)
  Core.setOutput('matched_external_source_url', MatchedExternalSourceUrl)
  Core.setOutput('matched_external_source_modified_at', MatchedExternalSourceModifiedAt)
}

function LoadUnifiedExternalSources(ConfigFilePath: string): UnifiedExternalSource[] {
  const RawConfig = JSON.parse(Fs.readFileSync(ConfigFilePath, 'utf-8')) as unknown
  const FiltersListsConfig = UnifiedFiltersListsConfigSchema.parse(RawConfig)
  const UnifiedAdblockTypes = new Set<UnifiedExternalSourceAdblockType>()

  for (const Definition of FiltersListsConfig) {
    if (typeof Definition.UnifiedDomainListFileName === 'string') {
      UnifiedAdblockTypes.add(Definition.AdblockType)
    }
  }

  const Sources = [...UnifiedAdblockTypes].flatMap(AdblockTypeValue => GetUnifiedExternalSourceUrls(AdblockTypeValue))
  return DeduplicateUnifiedExternalSources(Sources)
}

async function FindChangedUnifiedExternalSource(Since: string): Promise<ChangedUnifiedExternalSource | null> {
  const SinceMs = Date.parse(Since)
  if (!Number.isFinite(SinceMs)) {
    Core.warning('[unified-external] Cannot check external source updates because matched_time is invalid: ' + Since)
    return null
  }

  const ConfigFilePath = Path.resolve(WorkingDirectory, Env.UNIFIED_CONFIG_FILE)
  const Sources = LoadUnifiedExternalSources(ConfigFilePath)
  Core.info('[unified-external] Checking ' + Sources.length + ' external sources for updates since ' + Since)

  for (const Source of Sources) {
    const ChangedSource = await CheckUnifiedExternalSource(Source, SinceMs)
    if (ChangedSource !== null) {
      return ChangedSource
    }
  }

  return null
}

async function CheckUnifiedExternalSource(Source: UnifiedExternalSource, SinceMs: number): Promise<ChangedUnifiedExternalSource | null> {
  try {
    const Response = await SimpleSecureReq.Request(new URL(Source.Url), {
      HttpMethod: 'HEAD',
      ExpectedAs: 'String',
      FollowRedirects: true,
      MaxRedirects: 5,
      TimeoutMs: HeadRequestTimeoutMs
    }) as UnifiedExternalSourceHeadResponse

    if (Response.StatusCode < 200 || Response.StatusCode >= 300) {
      Core.warning('[unified-external] Skipping ' + Source.Name + ' (' + Source.Url + '): HTTP ' + Response.StatusCode)
      return null
    }

    const LastModified = GetHttpHeader(Response.Headers, 'last-modified')
    if (!LastModified) {
      Core.warning('[unified-external] ' + Source.Name + ' has no Last-Modified header; treating it as changed')
      return {
        ...Source,
        ModifiedAt: 'unknown',
        Reason: 'missing-last-modified'
      }
    }

    const LastModifiedMs = Date.parse(LastModified)
    if (!Number.isFinite(LastModifiedMs)) {
      Core.warning('[unified-external] ' + Source.Name + ' has an invalid Last-Modified header; treating it as changed: ' + LastModified)
      return {
        ...Source,
        ModifiedAt: LastModified,
        Reason: 'invalid-last-modified'
      }
    }

    Core.info('[unified-external] ' + Source.Name + ': last-modified=' + LastModified)
    if (LastModifiedMs > SinceMs) {
      return {
        ...Source,
        ModifiedAt: LastModified,
        Reason: 'newer-than-matched-build'
      }
    }
  } catch (ErrorValue) {
    Core.warning('[unified-external] Failed to check ' + Source.Name + ' (' + Source.Url + '): ' + FormatError(ErrorValue))
  }

  return null
}

function GetHttpHeader(Headers: Record<string, string | string[] | undefined>, HeaderName: string): string | null {
  const NormalizedHeaderName = HeaderName.toLowerCase()

  for (const [CurrentHeaderName, HeaderValue] of Object.entries(Headers)) {
    if (CurrentHeaderName.toLowerCase() !== NormalizedHeaderName) {
      continue
    }

    if (Array.isArray(HeaderValue)) {
      return HeaderValue[0] ?? null
    }

    return HeaderValue ?? null
  }

  return null
}

function FormatError(ErrorValue: unknown): string {
  if (ErrorValue instanceof Error) {
    return ErrorValue.message
  }

  return String(ErrorValue)
}

if (Env.FORCE_RUN) {
  ShouldRun = true
  EmitDecision()
  Process.exit(0)
}

if (PreviousRuns.length === 0) {
  ShouldRun = true
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
  } else if (Env.EVENT_NAME === 'schedule') {
    const NewCommits = await OctokitInstance.repos.listCommits({
      owner: Owner,
      repo: Repo,
      sha: 'master',
      since: LatestSuccessfulPrepare.CompletedAt,
      per_page: 1
    })

    if (NewCommits.data.length > 0) {
      ShouldRun = true
    } else {
      const ChangedExternalSource = await FindChangedUnifiedExternalSource(LatestSuccessfulPrepare.CompletedAt)
      if (ChangedExternalSource !== null) {
        ExternalSourceChanged = true
        MatchedExternalSourceName = ChangedExternalSource.Name
        MatchedExternalSourceUrl = ChangedExternalSource.Url
        MatchedExternalSourceModifiedAt = ChangedExternalSource.ModifiedAt
        Core.info('[unified-external] Build required by ' + ChangedExternalSource.Name + ' (' + ChangedExternalSource.Reason + ')')
        ShouldRun = true
      }
    }
  } else {
    ShouldRun = true
  }
} else {
  ShouldRun = true
}

EmitDecision()
