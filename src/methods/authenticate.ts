import * as core from '@actions/core'
import { HttpClient } from '@actions/http-client'
import { parseHttpResult } from './parse-http-result.js'

export async function authenticate(http: HttpClient) {
  const url = core.getInput('url')
  const apiKey = core.getInput('api-key')

  core.info(`Authenticating @ ${url}`)

  return http
    .postJson<{ access: string }>(`${url}/api/authenticate/api/json`, null, {
      'API-KEY': apiKey,
      'content-type': 'application/json'
    })
    .then(parseHttpResult('authenticate'))
    .then((result) => {
      http.requestOptions = {
        ...http.requestOptions,
        headers: {
          ...http.requestOptions?.headers,
          Authorization: `Bearer ${result.access}`,
          'content-type': 'application/json'
        }
      }
      core.info('Authenticated!')
    })
}
