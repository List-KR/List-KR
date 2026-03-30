import * as Core from '@actions/core'
import { Octokit } from '@octokit/rest'
import * as Zod from 'zod'
import * as Process from 'node:process'

const Env = await Zod.object({
  GH_TOKEN: Zod.string().nonempty(),
  REPO: Zod.string().nonempty().refine(V => /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(V)),
  WORKFLOW_FILE: Zod.string().nonempty(),
  TARGET_JOB_NAME: Zod.string().nonempty(),
  MIN_SECONDS: Zod.string().nonempty().transform(V => Number(V)).refine(V => Number.isFinite(V) && V >= 0),
  CURRENT_RUN_ID: Zod.string().nonempty().transform(V => Number(V)),
  FORCE_RUN: Zod.string().nonempty().transform(V => V === 'true'),
  EVENT_NAME: Zod.string().nonempty()
}).strip().parseAsync(Process.env)

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

function EmitDecision(): void {
  Core.info(`should_run=${ShouldRun}`)
  Core.info(`matched_run_id=${MatchedRunId}`)
  Core.info(`matched_time=${MatchedTime}`)
  Core.info(`blocked_by_run_id=${BlockedByRunId}`)
  Core.info(`blocked_by_job=${BlockedByJob}`)

  Core.setOutput('should_run', String(ShouldRun))
  Core.setOutput('matched_run_id', MatchedRunId)
  Core.setOutput('matched_time', MatchedTime)
  Core.setOutput('blocked_by_run_id', BlockedByRunId)
  Core.setOutput('blocked_by_job', BlockedByJob)
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
    ShouldRun = NewCommits.data.length > 0
  } else {
    ShouldRun = true
  }
} else {
  ShouldRun = true
}

EmitDecision()

