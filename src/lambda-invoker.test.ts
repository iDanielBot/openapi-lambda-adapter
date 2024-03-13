import { Lambda, InvokeCommand } from '@aws-sdk/client-lambda'
import { invokeLambda } from './lambda-invoker'
import { mockClient } from 'aws-sdk-client-mock'
import { Uint8ArrayBlobAdapter } from '@smithy/util-stream'

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
        body: JSON.stringify({
          message: 'User not found',
        }),
      }))
    })

    // then
    const resp = await invokeLambda({ payload: '', functionName: 'test' })
    expect(resp.statusCode).toEqual(404)
    expect(resp.body).toEqual(JSON.stringify({
      message: 'User not found',
    }))
  })

  it('converts 200 responses with timeout to 504 Gateway Timeout error', async () => {
    // given
    mockLambda.on(InvokeCommand).resolves({
      StatusCode: 200,
      FunctionError: 'Unhandled',
      Payload: Uint8ArrayBlobAdapter.fromString(JSON.stringify({
        errorMessage: "2023-01-09T10:48:53.262Z 873b04e4-991b-4d5f-b7ca-b99df84bfd66 Task timed out after 1.00 seconds"
      }))
    })

    // then
    const resp = await invokeLambda({ payload: '', functionName: 'test' })
    expect(resp.statusCode).toEqual(504)
    expect(resp.body).toEqual(
      JSON.stringify({
        "message": "Service timed out.",
        "functionName": "test", "error": "Unhandled",
        "payload": JSON.stringify({ "errorMessage": "2023-01-09T10:48:53.262Z 873b04e4-991b-4d5f-b7ca-b99df84bfd66 Task timed out after 1.00 seconds" })
      })
    )
  })

  it('converts 200 response with non APIGatewayProxyStructuredResultV2 payload to 502 Bad Gateway error', async () => {
    // given
    mockLambda.on(InvokeCommand).resolves({
      StatusCode: 200,
      Payload: Uint8ArrayBlobAdapter.fromString(JSON.stringify({
        username: 'this should fail'
      }))
    })

    // then
    const resp = await invokeLambda({ payload: '', functionName: 'test' })
    expect(resp.statusCode).toEqual(502)
    expect(resp.body).toEqual(
      JSON.stringify({
        "message": "Service returned a wrongly formatted response.",
        "functionName": "test",
        "payload": JSON.stringify({
          username: 'this should fail'
        }),
        "payloadJson": {
          username: 'this should fail'
        }
      })
    )
  })
})