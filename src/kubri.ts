import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import { bundleFromJSON } from '@sigstore/bundle'
import { getTrustedRoot } from '@sigstore/tuf'
import { toSignedEntity, toTrustMaterial, Verifier } from '@sigstore/verify'
import { getAttestations } from './github.ts'

const targets: Partial<Record<string, string>> = {
  'linux-x64': 'Linux_x86_64',
  'linux-arm64': 'Linux_arm64',
  'darwin-x64': 'MacOS_x86_64',
  'darwin-arm64': 'MacOS_arm64',
  'win32-x64': 'Windows_x86_64',
  'win32-arm64': 'Windows_arm64',
}

interface Statement {
  _type: string
  predicateType: string
  subject: { name: string; digest: Record<string, string> }[]
}

/** Installs kubri `version` into the tool cache and returns the path to its binary. */
export async function install(version: string, token: string): Promise<string> {
  const target = targets[`${process.platform}-${process.arch}`]
  if (!target) {
    throw new Error(`kubri has no release for ${process.platform}-${process.arch}`)
  }

  const cached = tc.find('kubri', version)
  if (cached) {
    core.info(`kubri ${version} found in the tool cache`)
    return getExePath(cached)
  }

  const ext = process.platform === 'win32' ? '.zip' : '.tar.gz'
  const file = `kubri_${version}_${target}${ext}`
  const url = `https://github.com/kubri/kubri/releases/download/v${version}/${file}`
  const temp = join(process.env.RUNNER_TEMP ?? tmpdir(), randomUUID())

  core.info(`Downloading ${url}`)
  const archive = await tc.downloadTool(url, join(temp, file))
  await verifyAttestation(version, file, archive, token)

  const extracted = ext === '.zip' ? await tc.extractZip(archive) : await tc.extractTar(archive)
  return getExePath(await tc.cacheDir(extracted, 'kubri', version))
}

async function verifyAttestation(
  version: string,
  file: string,
  archivePath: string,
  token: string,
): Promise<void> {
  const digest = createHash('sha256')
    .update(await readFile(archivePath))
    .digest('hex')
  const bundles = await getAttestations(digest, token)
  if (bundles.length === 0) {
    throw new Error(`kubri ${version} has no build provenance attestation`)
  }

  const identity = `https://github.com/kubri/kubri/.github/workflows/build.yml@refs/tags/v${version}`
  const verifier = new Verifier(toTrustMaterial(await getTrustedRoot()))
  const policy = {
    subjectAlternativeName: new RegExp(`^${RegExp.escape(identity)}$`),
    extensions: { issuer: 'https://token.actions.githubusercontent.com' },
  }

  let error: unknown
  for (const json of bundles) {
    try {
      const bundle = bundleFromJSON(json)
      verifier.verify(toSignedEntity(bundle), policy)
      if (bundle.content.$case !== 'dsseEnvelope') {
        throw new Error('attestation is not a DSSE envelope')
      }
      assertSubject(JSON.parse(bundle.content.dsseEnvelope.payload.toString()), file, digest)
      core.info(`Attestation verified for ${file}`)
      return
    } catch (e) {
      error = e
    }
  }
  const reason = error instanceof Error ? error.message : String(error)
  throw new Error(`Attestation verification failed for ${file}: ${reason}`)
}

function assertSubject(statement: Statement, file: string, digest: string): void {
  if (statement._type !== 'https://in-toto.io/Statement/v1') {
    throw new Error(`unexpected statement type ${statement._type}`)
  }
  if (statement.predicateType !== 'https://slsa.dev/provenance/v1') {
    throw new Error(`unexpected predicate type ${statement.predicateType}`)
  }
  if (!statement.subject.some((s) => s.name === file && s.digest.sha256 === digest)) {
    throw new Error(`${file} is not a subject of the attestation`)
  }
}

function getExePath(dir: string): string {
  return join(dir, process.platform === 'win32' ? 'kubri.exe' : 'kubri')
}
