import type {
  APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2,
  APIGatewayProxyEventQueryStringParameters, APIGatewayProxyEventPathParameters,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  Context
} from 'aws-lambda'

import createDebug from 'debug'

import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { Runner, Operation, UnknownContext } from 'openapi-client-axios'
import { invokeLambda } from './lambda-invoker'
import { params } from 'bath/params'
import { safeParseJson } from './util'
import { v4 as uuidv4 } from 'uuid'

const debug = createDebug('openapi-lambda-adapter')

export const getLambdaRunner = (targetFunctionName: string, crtLambdaContext?: Context): Runner => {
  return {
    runRequest: lambdaRunner,
    context: { functionName: targetFunctionName, crtLambdaContext }
  }
}

const lambdaRunner = async (axiosConfig: AxiosRequestConfig, operation: Operation, context?: UnknownContext) => {
  const proxyEventV2 = convertAxiosToApiGw(axiosConfig, operation, context?.crtLambdaContext as Context)
  const payload = JSON.stringify(proxyEventV2)
  const functionName = context?.functionName as string
  return await invokeLambda({ payload, functionName })
    .then((resp) => convertApiGwToAxios(resp, axiosConfig))
}

export interface LambdaRunnerAuthContext { 'lambda-invoke': true, callerIdentity: string }

export const convertAxiosToApiGw = (config: AxiosRequestConfig, operation: Operation, crtLambdaContext?: Context): APIGatewayProxyEventV2WithLambdaAuthorizer<LambdaRunnerAuthContext> => {
  // extract path params
  // eg: for path template /v1/users/{id} & path url /v1/users/1108 -> will extract {'id': '1108'}
  const template = operation.path
  const parsedParams = params(template)(config.url)

  const pathParams: APIGatewayProxyEventPathParameters = {
    ...parsedParams
  }

  // extract query params -> convert each value to ta string
  const queryParams = Object.entries(config.params ?? {}).filter(entryValueExists).reduce<APIGatewayProxyEventQueryStringParameters>((queryParams, [key, val]) => {
    queryParams[key] = val?.toString()
    return queryParams
  }, {})

  const queryString: string[] = []
  Object.entries(config.params ?? {}).filter(entryValueExists).forEach(([key, val]) => {
    if (val && Array.isArray(val)) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      queryString.push(...val.map((entry) => `${key}=${entry.toString()}`))
    } else {
      queryString.push(`${key}=${val.toString()}`)
    }
  })

  const headers: Record<string, string> = {}
  for (const [key, val] of Object.entries(config.headers ?? {}).filter(entryValueExists)) {
    headers[key] = val.toString()
  }

  // identify caller lambda
  const sourceIdentity = ['lambda-invoke', crtLambdaContext?.invokedFunctionArn].filter(Boolean).join('-')

  // default to lambda-invoke user-agent
  if (!headers['User-Agent'] && !headers['user-agent']) {
    headers['User-Agent'] = sourceIdentity
  }

  const lambdaPayload: APIGatewayProxyEventV2WithLambdaAuthorizer<LambdaRunnerAuthContext> = {
    version: '2.0',
    routeKey: '$default',
    rawPath: config.url,
    headers,
    queryStringParameters: queryParams,
    rawQueryString: queryString.join('&'),
    pathParameters: pathParams,
    requestContext: {
      accountId: 'lambda-invoke',
      apiId: 'lambda-invoke',
      authorizer: {
        lambda: {
          'lambda-invoke': true,
          callerIdentity: sourceIdentity
        }
      },
      domainName: 'lambda-invoke',
      domainPrefix: 'lambda-invoke',
      http: {
        method: config.method,
        sourceIp: '',
        path: config.url,
        protocol: 'HTTP/1.1',
        userAgent: headers['user-agent'] ?? headers['User-Agent']
      },
      requestId: crtLambdaContext?.awsRequestId ?? `lambda-invoke-${uuidv4()}`,
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now()
    },
    body: config.data ? JSON.stringify(config.data) : '',
    isBase64Encoded: false
  }

  // for backwards compat with older event format
  Object.assign(lambdaPayload, { httpMethod: config.method })

  debug('lambdaRequest %o', lambdaPayload)

  return lambdaPayload
}

export const convertApiGwToAxios = (resp: APIGatewayProxyStructuredResultV2, axiosConfig: AxiosRequestConfig) => {
  debug('lambdaResponse %o', resp)

  const axiosResp = {
    config: axiosConfig,
    status: resp.statusCode,
    statusText: HTTP_CODE_TO_TEXT[resp.statusCode],
    headers: resp.headers,
    data: safeParseJson(resp.body)
  } as AxiosResponse

  if (resp.statusCode && Number(resp.statusCode) >= 400) {
    throw new AxiosError(`Request failed with status code ${resp.statusCode}`, axiosResp.statusText, axiosResp)
  }

  return axiosResp
}

const entryValueExists = (entry: [string, unknown]): boolean => entry[1] !== null && entry[1] !== undefined

class AxiosError extends Error {
  public readonly code: string
  public readonly config: AxiosRequestConfig
  public readonly request: any
  public readonly response: AxiosResponse
  public readonly isAxiosError: boolean

  constructor (message: string, code: string, response: AxiosResponse) {
    super(message)

    this.message = message
    this.name = 'AxiosError'
    this.isAxiosError = true
    Object.setPrototypeOf(this, AxiosError.prototype)

    code && (this.code = code)
    response && (this.response = response)
    response?.config && (this.config = response.config)
    response?.request && (this.request = response.request)
  }

  public toJSON () {
    return {
      // Standard
      message: this.message,
      name: this.name,
      stack: this.stack,
      // Axios
      config: this.config,
      code: this.code,
      status: this.response?.status ?? null,
      respData: this.response?.data ? safeParseJson(this.response?.data) : null
    }
  }
}

const HTTP_CODE_TO_TEXT: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Time-out',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Request Entity Too Large',
  414: 'Request-URI Too Large',
  415: 'Unsupported Media Type',
  416: 'Requested range not satisfiable',
  417: 'Expectation Failed',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Time-out',
  505: 'HTTP Version not supported'
}
