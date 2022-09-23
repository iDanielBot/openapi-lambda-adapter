import {
  APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2,
  APIGatewayProxyEventQueryStringParameters, APIGatewayProxyEventPathParameters
} from 'aws-lambda'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { Runner, Operation, UnknownContext } from 'openapi-client-axios'
import { invokeLambda } from './lambda-invoker'
import { params } from 'bath/params'
import { safeParseJson } from './util'

export const getLambdaRunner = (functionName: string): Runner => {
  return {
    runRequest: lambdaRunner,
    context: { functionName }
  }
}

const lambdaRunner = async (axiosConfig: AxiosRequestConfig, operation: Operation, context?: UnknownContext) => {
  const proxyEventV2 = convertAxiosToApiGw(axiosConfig, operation)
  const payload = JSON.stringify(proxyEventV2)
  const functionName = context?.functionName as string
  return await invokeLambda({ payload, functionName })
    .then((resp) => convertApiGwToAxios(resp, axiosConfig))
}

export const convertAxiosToApiGw = (config: AxiosRequestConfig, operation: Operation): APIGatewayProxyEventV2 => {
  // extract path params
  // eg: for path template /v1/users/{id} & path url /v1/users/1108 -> will extract {'id': '1108'}
  const template = operation.path
  const parsedParams = params(template)(config.url)

  const pathParams: APIGatewayProxyEventPathParameters = {
    ...parsedParams
  }

  // extract query params -> convert each value to ta string
  const queryParams = Object.entries(config.params ?? {}).reduce<APIGatewayProxyEventQueryStringParameters>((queryParams, [key, val]) => {
    queryParams[key] = val.toString()
    return queryParams
  }, {})

  const queryString: string[] = []
  Object.entries(config.params ?? {}).forEach(([key, val]) => {
    if (val && Array.isArray(val)) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      queryString.push(...val.map((entry) => `${key}=${entry.toString()}`))
    } else {
      queryString.push(`${key}=${val.toString()}`)
    }
  })

  const urlSearchParams = new URLSearchParams()
  Object.entries(config.params ?? {}).forEach(([key, val]) => urlSearchParams.append(key, val.toString()))

  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: config.url,
    headers: { ...(config.headers ?? {}) },
    queryStringParameters: queryParams,
    rawQueryString: queryString.join('&'),
    pathParameters: pathParams,
    requestContext: {
      accountId: 'lambda-invoke',
      apiId: 'lambda-invoke',
      authorizer: {
        lambda: {
          'lambda-invoke': true
        }
      },
      domainName: 'lambda-invoke',
      domainPrefix: 'lambda-invoke',
      http: {
        method: config.method,
        sourceIp: '',
        path: config.url,
        protocol: 'HTTP/1.1',
        userAgent: 'lambda-invoke'
      },
      requestId: 'YgeNKidKliAEJYQ=',
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now()
    },
    body: config.data ? JSON.stringify(config.data) : '',
    isBase64Encoded: false,
    httpMethod: config.method
  } as APIGatewayProxyEventV2
}

export const convertApiGwToAxios = (resp: APIGatewayProxyStructuredResultV2, axiosConfig: AxiosRequestConfig) => {
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
