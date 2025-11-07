/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * Tests the Dev Center registration workflow:
 * - Authentication with API key
 * - Branch registration
 * - Commit registration
 */
import { jest } from '@jest/globals'
import type * as ifm from '@actions/http-client/lib/interfaces.js'

// Mock functions
const mockGetInput = jest.fn<(name: string) => string>()
const mockSetOutput = jest.fn<(name: string, value: string) => void>()
const mockSetFailed = jest.fn<(message: string) => void>()
const mockInfo = jest.fn<(message: string) => void>()
const mockNotice = jest.fn<(message: string) => void>()

const mockGetCommit = jest.fn<
  (params: { owner: string; repo: string; ref: string }) => Promise<{
    data: {
      commit: {
        message: string
        committer: { email: string } | null
      }
    }
  }>
>()
const mockPostJson =
  jest.fn<(url: string, data: string) => Promise<ifm.TypedResponse<unknown>>>()
const mockPost =
  jest.fn<(url: string, data: string) => Promise<ifm.TypedResponse<unknown>>>()

const mockAuthenticate = jest.fn<() => Promise<void>>()
const mockParseHttpResult =
  jest.fn<
    (operation: string) => (result: ifm.TypedResponse<unknown>) => unknown
  >()

// Mock modules
jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
  setOutput: mockSetOutput,
  setFailed: mockSetFailed,
  info: mockInfo,
  notice: mockNotice
}))

jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: jest.fn(() => ({
    rest: {
      repos: {
        getCommit: mockGetCommit
      }
    }
  })),
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    },
    ref: 'refs/heads/main',
    sha: 'abc123def456'
  }
}))

jest.unstable_mockModule('@actions/http-client', () => ({
  HttpClient: jest.fn(() => ({
    postJson: mockPostJson,
    post: mockPost,
    requestOptions: {}
  }))
}))

jest.unstable_mockModule('../src/methods/authenticate.js', () => ({
  authenticate: mockAuthenticate
}))

jest.unstable_mockModule('../src/methods/parse-http-result.js', () => ({
  parseHttpResult: mockParseHttpResult
}))

const { run } = await import('../src/main.js')

describe('main.ts - Dev Center Registration', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup default input values
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'github-token': 'ghp_test_token',
        url: 'https://dev-center.flake.gg',
        'api-key': 'test-api-key'
      }
      return inputs[name] || ''
    })

    // Setup default commit response
    mockGetCommit.mockResolvedValue({
      data: {
        commit: {
          message:
            'feat: add new feature\n\nDetailed description of the feature',
          committer: {
            email: 'test@example.com'
          }
        }
      }
    })

    // Setup authenticate mock
    mockAuthenticate.mockResolvedValue(undefined)

    // Setup parseHttpResult mock to return a function that processes the response
    mockParseHttpResult.mockImplementation(() => {
      return (result: ifm.TypedResponse<unknown>) => result.result
    })

    // Setup default branch creation response
    mockPostJson.mockResolvedValue({
      statusCode: 200,
      headers: {},
      result: {
        id: 'main',
        name: 'main',
        repo: 'test-owner/test-repo'
      }
    })

    // Setup default commit creation response
    mockPost.mockResolvedValue({
      statusCode: 200,
      headers: {},
      result: undefined
    })
  })

  describe('Successful registration', () => {
    it('should authenticate with the Dev Center API', async () => {
      await run()

      expect(mockAuthenticate).toHaveBeenCalledTimes(1)
      expect(mockAuthenticate).toHaveBeenCalledWith(
        expect.objectContaining({
          postJson: mockPostJson,
          post: mockPost
        })
      )
    })

    it('should register a branch with correct parameters', async () => {
      await run()

      expect(mockPostJson).toHaveBeenCalledWith(
        'https://dev-center.flake.gg/api/branch',
        JSON.stringify({
          id: 'main',
          repo: 'test-owner/test-repo'
        })
      )
    })

    it('should register a commit with correct parameters', async () => {
      await run()

      expect(mockPost).toHaveBeenCalledWith(
        'https://dev-center.flake.gg/api/commit',
        JSON.stringify({
          id: 'abc123def456',
          branchId: 'main',
          name: 'feat: add new feature',
          description:
            'feat: add new feature\n\nDetailed description of the feature',
          author: 'test@example.com'
        })
      )
    })

    it('should set time output', async () => {
      await run()

      expect(mockSetOutput).toHaveBeenCalledWith(
        'time',
        expect.stringMatching(/^\d{2}:\d{2}:\d{2}/)
      )
    })

    it('should output branch notice', async () => {
      await run()

      expect(mockNotice).toHaveBeenCalledWith('Branch')
    })

    it('should handle branch names with refs prefix correctly', async () => {
      const github = await import('@actions/github')
      github.context.ref = 'refs/heads/feature/test-branch'

      await run()

      expect(mockPostJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"id":"feature/test-branch"')
      )
    })

    it('should extract first line of commit message as name', async () => {
      mockGetCommit.mockResolvedValue({
        data: {
          commit: {
            message:
              'fix: critical bug\n\nThis was a serious issue\nthat needed fixing',
            committer: {
              email: 'dev@example.com'
            }
          }
        }
      })

      await run()

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"name":"fix: critical bug"')
      )
    })
  })

  describe('Error handling', () => {
    it('should fail when authentication fails', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Authentication failed'))

      await run()

      expect(mockSetFailed).toHaveBeenCalledWith('Authentication failed')
    })

    it('should fail when branch registration fails', async () => {
      mockPostJson.mockRejectedValue(new Error('Branch registration failed'))

      await run()

      expect(mockSetFailed).toHaveBeenCalledWith('Branch registration failed')
    })

    it('should fail when commit registration fails', async () => {
      mockPost.mockRejectedValue(new Error('Commit registration failed'))

      await run()

      expect(mockSetFailed).toHaveBeenCalledWith('Commit registration failed')
    })

    it('should fail when GitHub API call fails', async () => {
      mockGetCommit.mockRejectedValue(new Error('GitHub API error'))

      await run()

      expect(mockSetFailed).toHaveBeenCalledWith('GitHub API error')
    })

    it('should handle errors gracefully and not throw', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Test error'))

      await expect(run()).resolves.toBeUndefined()
      expect(mockSetFailed).toHaveBeenCalled()
    })
  })

  describe('Input handling', () => {
    it('should use custom URL when provided', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'url') return 'https://custom-dev-center.example.com'
        if (name === 'github-token') return 'ghp_test_token'
        if (name === 'api-key') return 'test-api-key'
        return ''
      })

      await run()

      expect(mockPostJson).toHaveBeenCalledWith(
        'https://custom-dev-center.example.com/api/branch',
        expect.any(String)
      )
      expect(mockPost).toHaveBeenCalledWith(
        'https://custom-dev-center.example.com/api/commit',
        expect.any(String)
      )
    })

    it('should retrieve all required inputs', async () => {
      await run()

      expect(mockGetInput).toHaveBeenCalledWith('github-token')
      expect(mockGetInput).toHaveBeenCalledWith('url')
      // Note: api-key is retrieved inside authenticate(), not directly in main
    })
  })

  describe('GitHub context integration', () => {
    it('should use correct repository context', async () => {
      await run()

      expect(mockGetCommit).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'abc123def456'
      })
    })

    it('should handle commits without committer email', async () => {
      mockGetCommit.mockResolvedValue({
        data: {
          commit: {
            message: 'test commit',
            committer: null
          }
        }
      })

      await run()

      // When committer is null, commit.committer?.email is undefined
      const callArgs = mockPost.mock.calls[0]
      const commitData = JSON.parse(callArgs[1])
      expect(commitData.author).toBeUndefined()
    })
  })
})
