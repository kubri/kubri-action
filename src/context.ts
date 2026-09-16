import * as core from '@actions/core'

export interface Inputs {
  version: string
  args: string
  workdir: string
  installOnly: boolean
  githubToken: string
}

export function getInputs(): Inputs {
  return {
    version: core.getInput('version'),
    args: core.getInput('args'),
    workdir: core.getInput('workdir'),
    installOnly: core.getBooleanInput('install-only'),
    githubToken: core.getInput('github-token'),
  }
}
