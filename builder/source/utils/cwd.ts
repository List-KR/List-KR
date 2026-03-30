import * as Path from 'node:path'
import * as Process from 'node:process'

export function GetWorkingDirectory(): string {
  return Path.resolve(Process.env.INIT_CWD ?? Process.cwd())
}