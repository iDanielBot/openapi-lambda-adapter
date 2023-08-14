import { Lambda, InvokeCommand } from '@aws-sdk/client-lambda'
import { invokeLambda } from './lambda-invoker'
import { mockClient } from 'aws-sdk-client-mock'
import { Uint8ArrayBlobAdapter } from '@aws-sdk/util-stream'

const mockLambda = mockClient(Lambda)

beforeEach(() => {
  mockLambda.reset();
});

describe('Lambda invoker', () => {
  it('process 200 response with http error returned', async () => {
    // given
    mockLambda.on(InvokeCommand).resolves({
      StatusCode: 200,
      Payload: Uint8ArrayBlobAdapter.fromString(JSON.stringify({
        statusCode: 404,
        body: {
          message: 'User not found',
        },
      }))
    })

    // then
    const resp = await invokeLambda({ payload: '', functionName: 'test' })
    expect(resp.statusCode).toEqual(404)
    expect(resp.body).toEqual({
      message: 'User not found',
    })
  })

  it('process 200 response with timeout error returned', async () => {
    // given
    mockLambda.on(InvokeCommand).resolves({
      StatusCode: 200,
      FunctionError: 'Unhandled',
      Payload: Uint8ArrayBlobAdapter.fromString(JSON.stringify({
        errorMessage: "2023-01-09T10:48:53.262Z 873b04e4-991b-4d5f-b7ca-b99df84bfd66 Task timed out after 1.00 seconds"
      }))
    })

    // then
    await expect(invokeLambda({ payload: '', functionName: 'test' })).rejects.toThrow()
  })

  it('process 200 response with non APIGatewayProxyStructuredResultV2 payload', async () => {
    // given
    mockLambda.on(InvokeCommand).resolves({
      StatusCode: 200,
      Payload: Uint8ArrayBlobAdapter.fromString(JSON.stringify({
        username: 'this should fail'
      }))
    })

    // then
    await expect(invokeLambda({ payload: '', functionName: 'test' })).rejects.toThrow()
  })
})