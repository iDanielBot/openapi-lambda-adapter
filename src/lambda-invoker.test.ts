import AWSMock from 'aws-sdk-mock'
import AWS from 'aws-sdk'
import { invokeLambda } from './lambda-invoker'


describe('Lambda invoker', () => {

  beforeAll(() => {
    AWSMock.setSDKInstance(AWS);
  })
  afterEach(() => {
    AWSMock.restore('Lambda')
  })

  it('process 200 response with http error returned', async () => {
    // given
    AWSMock.mock('Lambda', 'invoke', (_req: AWS.Lambda.InvocationRequest, callback: Function) => {
      callback(null, {
        StatusCode: 200,
        Payload: JSON.stringify({
          statusCode: 404,
          body: JSON.stringify({
            message: 'User not found',
          }),
        })
      });
    })

    // then
    const resp = await invokeLambda({ payload: '', functionName: 'test' })
    expect(resp.statusCode).toEqual(404)
    expect(resp.body).toEqual(JSON.stringify({
      message: 'User not found',
    }))
  })

  it('process 200 response with timeout error returned', async () => {
    // given
    AWSMock.mock('Lambda', 'invoke', (_req: AWS.Lambda.InvocationRequest, callback: Function) => {
      callback(null, {
        StatusCode: 200,
        FunctionError: 'Unhandled',
        Payload: JSON.stringify({
          errorMessage: "2023-01-09T10:48:53.262Z 873b04e4-991b-4d5f-b7ca-b99df84bfd66 Task timed out after 1.00 seconds"
        })
      });
    })

    // then
    await expect(invokeLambda({ payload: '', functionName: 'test' })).rejects.toThrow()
  })

  it('process 200 response with non APIGatewayProxyStructuredResultV2 payload', async () => {
    // given
    AWSMock.mock('Lambda', 'invoke', (_req: AWS.Lambda.InvocationRequest, callback: Function) => {
      callback(null, {
        StatusCode: 200,
        Payload: JSON.stringify({
          username: 'this should fail'
        })
      });
    })

    // then
    await expect(invokeLambda({ payload: '', functionName: 'test' })).rejects.toThrow()
  })

})