import * as ifm from '@actions/http-client/lib/interfaces.js'
import { ApiError } from '../types/api-error.js'

export function parseHttpResult<T>(operation: string) {
  return (result: ifm.TypedResponse<T>) => {
    if (result.statusCode < 200 || result.statusCode >= 400)
      throw new ApiError(`Failed to ${operation}: Error ${result.statusCode}`)
    if (result.result == null)
      throw new ApiError(
        `Expected result body but got while attempting to ${operation}`
      )
    return result.result
  }
}
