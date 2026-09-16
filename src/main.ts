import { dirname } from 'node:path'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as context from './context.ts'
import * as github from './github.ts'
import * as kubri from './kubri.ts'

async function run(): Promise<void> {
  try {
    const inputs = context.getInputs()
    const version = await github.resolveVersion(inputs.version, inputs.githubToken)
    const bin = await kubri.install(version, inputs.githubToken)
    core.setOutput('version', version)
    core.info(`kubri ${version} installed successfully`)

    if (inputs.installOnly) {
      core.addPath(dirname(bin))
      return
    }

    await exec.exec(`"${bin}" ${inputs.args}`, [], { cwd: inputs.workdir })
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

run()
