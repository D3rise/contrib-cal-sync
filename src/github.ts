export interface GitHubRepository {
  readonly owner: string
  readonly repository: string
}

export interface GitHubIdentity {
  readonly id: number
  readonly login: string
  readonly name: string | null
}

export function parseGitHubRepositoryUrl(value: string): GitHubRepository {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Mirror repository must be a valid GitHub HTTPS URL.')
  }
  const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || parts.length !== 2) {
    throw new Error('Mirror repository must point to a standalone GitHub repository.')
  }
  return { owner: parts[0]!, repository: parts[1]! }
}

export async function getGitHubIdentity(token: string, fetchImpl: typeof fetch = fetch): Promise<GitHubIdentity> {
  let response: Response
  try {
    response = await fetchImpl('https://api.github.com/user', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28'
      },
      signal: AbortSignal.timeout(30_000)
    })
  } catch (cause) {
    throw new Error('GitHub is unavailable.', { cause })
  }
  if (!response.ok) throw new Error(`GitHub rejected the identity request with HTTP ${response.status}.`)
  const value = await response.json() as Record<string, unknown>
  if (!Number.isInteger(value.id) || typeof value.login !== 'string') throw new Error('GitHub returned an incompatible identity response.')
  return { id: value.id as number, login: value.login, name: typeof value.name === 'string' ? value.name : null }
}

export function deriveNoreplyEmail(identity: GitHubIdentity): string {
  return `${identity.id}+${identity.login}@users.noreply.github.com`
}

export async function getDefaultBranch(repository: GitHubRepository, token: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(`https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28'
    },
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`GitHub rejected the repository request with HTTP ${response.status}.`)
  const value = await response.json() as Record<string, unknown>
  return typeof value.default_branch === 'string' && value.default_branch !== '' ? value.default_branch : 'main'
}
