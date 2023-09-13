import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { InvocationResponse, Lambda } from '@aws-sdk/client-lambda'
import { safeParseJson } from './util'

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

  if (!isSuccess(res.StatusCode)) {
    throw new Error(`Failed to invoke lambda ${params.functionName} synchronously`)
  }

  const safePayload = Buffer.from(res.Payload).toString('utf-8')

  if (hasTimeout(res, safePayload)) {
    throw new Error(safePayload)
  }

  const response = safeParseJson(safePayload)

  // response is not in JSON format
  if (!isApiGwStructuredResp(response)) {
    throw new Error('Received a response which is not in APIGatewayProxyStructuredResultV2 format')
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
