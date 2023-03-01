import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { AxiosRequestConfig } from 'axios'
import { AxiosError, HttpMethod, Operation } from 'openapi-client-axios'
import { convertAxiosToApiGw, convertApiGwToAxios } from './openapi-lambda-adapters'

describe('Adapt axios request/response to AWS Lambda Proxy Event/Response', () => {

  describe('Axios request to API GW Proxy Event', () => {
    it('converts axios call with no query or path params', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'get',
        url: '/v1/users',
        data: null,
        headers: {
          Accept: 'application/json, text/plain, */*',
          authorization: 'test'
        }
      }
      const operation: Operation = {
        path: '/v1/users',
        method: HttpMethod.Get,
        responses: {}
      }

      // then
      const event = convertAxiosToApiGw(axiosConfig, operation)
      expect(event.rawPath).toEqual('/v1/users')
      expect(Object.keys(event.headers).length).toEqual(2)
      expect(event.pathParameters).toEqual({})
      expect(event.queryStringParameters).toEqual({})
      expect(event.rawQueryString).toEqual('')
      expect(event.body).toEqual('')
    })

    it('converts axios call with path params', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'get',
        url: '/v1/users/1108',
      }
      const operation: Operation = {
        path: '/v1/users/{userId}',
        method: HttpMethod.Get,
        responses: {}
      }

      // then
      const event = convertAxiosToApiGw(axiosConfig, operation)
      expect(event.rawPath).toEqual('/v1/users/1108')
      expect(event.pathParameters).toEqual({
        userId: '1108'
      })
      expect(event.queryStringParameters).toEqual({})
    })

    it('converts axios call with query params', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'get',
        url: '/v1/users',
        params: {
          limit: 20,
          offset: 100
        }
      }
      const operation: Operation = {
        path: '/v1/users',
        method: HttpMethod.Get,
        responses: {}
      }

      // then
      const event = convertAxiosToApiGw(axiosConfig, operation)
      expect(event.pathParameters).toEqual({})
      expect(event.queryStringParameters).toEqual({
        limit: '20',
        offset: '100'
      })
      expect(event.rawQueryString).toEqual('limit=20&offset=100')
    })

    it('converts axios call with both path & query params', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'get',
        url: '/v1/users/77/orders/82jh2kal',
        params: {
          flag: true,
          number: 100,
          string: 'age'
        }
      }
      const operation: Operation = {
        path: '/v1/users/{userId}/orders/{orderId}',
        method: HttpMethod.Get,
        responses: {}
      }

      // then
      const event = convertAxiosToApiGw(axiosConfig, operation)
      expect(event.pathParameters).toEqual({
        userId: '77',
        orderId: '82jh2kal'

      })
      expect(event.queryStringParameters).toEqual({
        flag: 'true',
        number: '100',
        string: 'age'
      })
      expect(event.rawQueryString).toEqual('flag=true&number=100&string=age')
    })

    it('converts axios call with multi query params', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'get',
        url: '/v1/users/johnny',
        params: {
          colors: ['red', 'blue'],
          number: 0,
          boolean: false
        }
      }
      const operation: Operation = {
        path: '/v1/users/{username}',
        method: HttpMethod.Get,
        responses: {}
      }

      // then
      const event = convertAxiosToApiGw(axiosConfig, operation)
      expect(event.pathParameters).toEqual({
        username: 'johnny'
      })
      expect(event.queryStringParameters).toEqual({
        colors: 'red,blue',
        number: '0',
        boolean: 'false'
      })
      expect(event.rawQueryString).toEqual('colors=red&colors=blue&number=0&boolean=false')
    })

    it('converts axios call with non-string headers', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'get',
        url: '/v1/users',
        headers: {
          'x-boolean': true,
          'x-number': 100,
          'x-object': {
            key: 'value'
          },
          'x-array': ['a', 'b'],
          'x-null': null,
          'x-string': 'string'
        } as unknown as Record<string, string>
      }
      const operation: Operation = {
        path: '/v1/users',
        method: HttpMethod.Get,
        responses: {}
      }

      // then
      const event = convertAxiosToApiGw(axiosConfig, operation)
      
      expect(event.headers['x-boolean']).toBe('true')
      expect(event.headers['x-number']).toBe('100')
      expect(event.headers['x-string']).toBe('string')
      expect(event.headers['x-object']).toBe('[object Object]')
      expect(event.headers['x-array']).toBe('a,b')
      expect(event.headers['x-null']).toBeUndefined()
    })
  })

  describe('Api GW Proxy Response to Axios Response', () => {

    it('converts HTTP 200 to axios response', () => {
      // given
      const user = {
        firstName: 'johnny',
        lastName: 'bravo'
      }
      const axiosConfig: AxiosRequestConfig = {
        method: 'post',
        url: '/v1/users',
        data: { user }
      }
      const apiGwResp: APIGatewayProxyStructuredResultV2 = {
        statusCode: 200,
        body: JSON.stringify({ ...user, id: 571251 }),
        isBase64Encoded: false
      }
      // then
      const axiosResp = convertApiGwToAxios(apiGwResp, axiosConfig)
      expect(axiosResp.config).toEqual(axiosConfig)
      expect(axiosResp.status).toEqual(200)
      expect(axiosResp.statusText).toEqual('OK')
      expect(axiosResp.data).toEqual({
        ...user,
        id: 571251
      })
    })

    it('converts HTTP 201 to axios response', () => {
      // given
      const user = {
        firstName: 'johnny',
        lastName: 'bravo'
      }
      const axiosConfig: AxiosRequestConfig = {
        method: 'PUT',
        url: '/v1/users/11',
        data: { user }
      }
      const apiGwResp: APIGatewayProxyStructuredResultV2 = {
        statusCode: 201,
        body: JSON.stringify({ ...user, id: 11 }),
        isBase64Encoded: false
      }
      // then
      const axiosResp = convertApiGwToAxios(apiGwResp, axiosConfig)
      expect(axiosResp.config).toEqual(axiosConfig)
      expect(axiosResp.status).toEqual(201)
      expect(axiosResp.statusText).toEqual('Created')
      expect(axiosResp.data).toEqual({
        ...user,
        id: 11
      })
    })

    it('converts HTTP 204 to axios response', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'post',
        url: '/v1/users',
        data: {}
      }
      const apiGwResp: APIGatewayProxyStructuredResultV2 = {
        statusCode: 204,
        isBase64Encoded: false
      }
      // then
      const axiosResp = convertApiGwToAxios(apiGwResp, axiosConfig)
      expect(axiosResp.config).toEqual(axiosConfig)
      expect(axiosResp.status).toEqual(204)
      expect(axiosResp.statusText).toEqual('No Content')
      expect(axiosResp.data).toBeUndefined()
    })

    it('converts HTTP 400 to axios response', () => {
      // given
      const user = {
        firstName: 'johnny',
        lastName: 'bravo'
      }
      const axiosConfig: AxiosRequestConfig = {
        method: 'post',
        url: '/v1/users',
        data: { user }
      }
      const apiGwResp: APIGatewayProxyStructuredResultV2 = {
        statusCode: 400,
        body: JSON.stringify({ message: 'email is mandatory' }),
        isBase64Encoded: false
      }

      // then
      try {
        convertApiGwToAxios(apiGwResp, axiosConfig)
        expect('Should have thrown error').toEqual('No error was thrown')
      } catch (err) {
        const error = err as AxiosError
        expect(error.isAxiosError).toBeTruthy()
        expect(error.message).toEqual('Request failed with status code 400')
        expect(error.response?.config).toEqual(axiosConfig)
        expect(error.response?.status).toEqual(400)
        expect(error.response?.statusText).toEqual('Bad Request')
      }

    })

    it('converts HTTP 403 to axios response', () => {
      // given
      const user = {
        firstName: 'johnny',
        lastName: 'bravo'
      }
      const axiosConfig: AxiosRequestConfig = {
        method: 'post',
        url: '/v1/users',
        data: { user }
      }
      const apiGwResp: APIGatewayProxyStructuredResultV2 = {
        statusCode: 403,
        body: 'Forbidden',
        isBase64Encoded: false
      }

      // then
      try {
        convertApiGwToAxios(apiGwResp, axiosConfig)
        expect('Should have thrown error').toEqual('No error was thrown')
      } catch (err) {
        const error = err as AxiosError
        expect(error.isAxiosError).toBeTruthy()
        expect(error.message).toEqual('Request failed with status code 403')
        expect(error.response?.config).toEqual(axiosConfig)
        expect(error.response?.status).toEqual(403)
        expect(error.response?.statusText).toEqual('Forbidden')
      }

    })

    it('converts HTTP 404 to axios response', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'get',
        url: '/v1/users/johnny'
      }
      const apiGwResp: APIGatewayProxyStructuredResultV2 = {
        statusCode: 404,
        isBase64Encoded: true
      }

      // then
      try {
        const axiosResp = convertApiGwToAxios(apiGwResp, axiosConfig)
        expect('Should have thrown error').toEqual('No error was thrown')
      } catch (err) {
        const error = err as AxiosError
        expect(error.isAxiosError).toBeTruthy()
        expect(error.message).toEqual('Request failed with status code 404')
        expect(error.response?.config).toEqual(axiosConfig)
        expect(error.response?.status).toEqual(404)
        expect(error.response?.statusText).toEqual('Not Found')
      }

    })

    it('converts HTTP 409 to axios response', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'patch',
        url: '/v1/users/johnny',
      }
      const apiGwResp: APIGatewayProxyStructuredResultV2 = {
        statusCode: 409,
        body: JSON.stringify({ message: 'User johnny was updated in the meantime. Please refresh' })
      }

      // then
      try {
        const axiosResp = convertApiGwToAxios(apiGwResp, axiosConfig)
        expect('Should have thrown error').toEqual('No error was thrown')
      } catch (err) {
        const error = err as AxiosError
        expect(error.isAxiosError).toBeTruthy()
        expect(error.message).toEqual('Request failed with status code 409')
        expect(error.response?.config).toEqual(axiosConfig)
        expect(error.response?.status).toEqual(409)
        expect(error.response?.statusText).toEqual('Conflict')
        expect(error.response?.data).toEqual({
          message: 'User johnny was updated in the meantime. Please refresh'
        })
      }
    })

    it('converts HTTP 500 to axios response', () => {
      // given
      const axiosConfig: AxiosRequestConfig = {
        method: 'patch',
        url: '/v1/users/johnny',
      }
      const apiGwResp: APIGatewayProxyStructuredResultV2 = {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal server error.' })
      }

      // then
      try {
        const axiosResp = convertApiGwToAxios(apiGwResp, axiosConfig)
        expect('Should have thrown error').toEqual('No error was thrown')
      } catch (err) {
        const error = err as AxiosError
        expect(error.isAxiosError).toBeTruthy()
        expect(error.message).toEqual('Request failed with status code 500')
        expect(error.response?.config).toEqual(axiosConfig)
        expect(error.response?.status).toEqual(500)
        expect(error.response?.statusText).toEqual('Internal Server Error')
        expect(error.response?.data).toEqual({
          message: 'Internal server error.'
        })
      }

    })

  })

})