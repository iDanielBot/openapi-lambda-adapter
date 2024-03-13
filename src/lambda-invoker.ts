import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { InvocationResponse, Lambda } from '@aws-sdk/client-lambda'
import { safeParseJson } from './util'

import createDebug from 'debug'

const debug = createDebug('openapi-lambda-adapter')

let lambdaClient: Lambda
const getLambdaClient = () => {
  if (!lambdaClient) {
    lambdaClient = new Lambda({ region: 'eu-central-1' })
  }

  return lambdaClient
}

export const invokeLambda = async (params: { payload: string, functionName: string }) => {
  const { payload, functionName } = params
  const lambda = getLambdaClient()

  const res = await lambda
    .invoke({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Payload: Buffer.from(payload)
    })

  debug('Lambda invocation response', res)

  if (!isSuccess(res.StatusCode)) {
    return toApiGwResp({
      statusCode: 502,
      body: { message: `Failed to invoke lambda ${params.functionName} synchronously. Check your IAM setup.` }
    })
  }

  const safePayload = Buffer.from(res.Payload).toString('utf-8')

  if (hasTimeout(res, safePayload)) {
    return toApiGwResp({
      statusCode: 504,
      body: { message: 'Service timed out.', functionName: params.functionName, error: res.FunctionError, payload: safePayload }
    })
  }

  const response = safeParseJson(safePayload)

  // response is not in JSON format
  if (!isApiGwStructuredResp(response)) {
    return toApiGwResp({
      statusCode: 502,
      body: {
        message: 'Service returned a wrongly formatted response.',
        functionName: params.functionName,
        payload: safePayload,
        payloadJson: response
      }
    })
  }

  return response
}

const isSuccess = (statusCode: number) => statusCode >= 200 && statusCode < 300

const isApiGwStructuredResp = (resp: unknown): resp is APIGatewayProxyStructuredResultV2 => {
  if (!resp || typeof resp !== 'object') {
    return false
  }

  if (!('statusCode' in resp)) {
    return false
  }

  return true
}

const hasTimeout = (res: InvocationResponse, safePayload: string) => 'FunctionError' in res && safePayload?.includes('Task timed out')

const toApiGwResp = (params: { statusCode: number, body: Record<string, unknown> }) => {
  return {
    statusCode: params.statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params.body)
  }
}
