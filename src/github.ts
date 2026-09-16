import { HttpClient } from '@actions/http-client'
import semver from 'semver'

const http = new HttpClient('kubri-action')
const api = 'https://api.github.com/repos/kubri/kubri'

interface GitHubRelease {
  tag_name: string
  draft: boolean
}

interface Attestations {
  attestations: { bundle: unknown }[]
}

/** Resolves `latest`, an exact version or a semver range to the newest matching kubri version. */
export async function resolveVersion(version: string, token: string): Promise<string> {
  const exact = semver.clean(version)
  if (exact) {
    return exact
  }
  if (version === 'latest') {
    const release = await getJson<GitHubRelease>(`${api}/releases/latest`, token)
    return release.tag_name.replace(/^v/, '')
  }

  const range = semver.validRange(version)
  if (!range) {
    throw new Error(`Invalid version: ${version}`)
  }
  const versions: string[] = []
  for (let page = 1; ; page++) {
    const releases = await getJson<GitHubRelease[]>(
      `${api}/releases?per_page=100&page=${page}`,
      token,
    )
    versions.push(...releases.filter((r) => !r.draft).map((r) => r.tag_name.replace(/^v/, '')))
    if (releases.length < 100) {
      break
    }
  }
  const match = semver.maxSatisfying(versions, range)
  if (!match) {
    throw new Error(`No kubri release matches ${version}`)
  }
  return match
}

/** Returns the build provenance attestation bundles published for an artifact's SHA-256 digest. */
export async function getAttestations(digest: string, token: string): Promise<unknown[]> {
  const predicateType = encodeURIComponent('https://slsa.dev/provenance/v1')
  const url = `${api}/attestations/sha256:${digest}?predicate_type=${predicateType}`
  const { result } = await http.getJson<Attestations>(url, headers(token))
  return result?.attestations.map((a) => a.bundle) ?? []
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const { result } = await http.getJson<T>(url, headers(token))
  if (!result) {
    throw new Error(`Not found: ${url}`)
  }
  return result
}

function headers(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    ...(token && { authorization: `Bearer ${token}` }),
  }
}
