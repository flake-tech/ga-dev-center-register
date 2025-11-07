import * as core from '@actions/core'
import * as github from '@actions/github'
import { HttpClient } from '@actions/http-client'
import { authenticate } from './methods/authenticate.js'
import { BranchCreate, BranchRead } from './types/branch.js'
import { parseHttpResult } from './methods/parse-http-result.js'
import { CommitCreate } from './types/commit.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('github-token')
    const octokit = github.getOctokit(githubToken)
    const url = core.getInput('url')
    const repo = `${github.context.repo.owner}/${github.context.repo.repo}`
    const branchName = github.context.ref.replace('refs/heads/', '')
    const commitRef = github.context.sha
    const { commit } = (
      await octokit.rest.repos.getCommit({
        ...github.context.repo,
        ref: github.context.sha
      })
    ).data

    const http = new HttpClient(undefined, undefined)

    await authenticate(http)

    const branch = await http
      .postJson<BranchRead>(`${url}/api/branch`, {
        id: branchName,
        repo
      } satisfies BranchCreate)
      .then(parseHttpResult('register branch'))
    core.notice('Branch Registered')

    await http
      .postJson(`${url}/api/commit`, {
        id: commitRef,
        branchId: branch.id,
        name: commit.message.split('\n')[0],
        description: commit.message,
        author: commit.committer?.email
      } satisfies CommitCreate)
      .then(parseHttpResult('register commit'))
    core.notice('Commit Registered')

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    console.log(error)
    if (
      error != null &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    )
      core.setFailed(error.message)
    else core.setFailed(error?.toString() ?? 'Unknown error')
  }
}
