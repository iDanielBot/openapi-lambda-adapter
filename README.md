<h1>openapi-lambda-adapter</h1>

<p align="center">JavaScript/Typescript library for making AWS Lambda to Lambda calls via <a href="https://github.com/anttiviljami/openapi-client-axios" target="_blank">openapi-client-axios</a> .

## Features

- [x] Easy to make API like calls via <a href="https://github.com/anttiviljami/openapi-client-axios" target="_blank">openapi-client-axios</a> library.
```javascript
  client.api.registerRunner(getLambdaRunner('target-lambda-name'))
```
- [x] Use your API clients from [OpenAPI v3 definitions](https://github.com/OAI/OpenAPI-Specification) to make AWS Lambda to Lambda calls between your platform microservices.
  - `client.getPet(1)`
  - `client.searchPets()`
  - `client.searchPets({ ids: [1, 2, 3] })`
  - `client.updatePet(1, payload)`
- [x] No need to run your requests via Api Gateway, you can directly run microservice to microservice call, i.e. AWS Lambda to Lambda, by leveraging AWS backbone infrastructure.
- [x] Leverage AWS IAM for permission management.
<b>Eg:</b>
```yaml
  Resources:
    MyLambda:
      Type: AWS::Serverless::Function
      Properties:
        ...
        Policies:
          - LambdaInvokePolicy:
              FunctionName: target-lambda-name
```

## Restrictions
- [x] To run in AWS Lambda with Nodejs Runtime Environment >= 12

## Quick Start

```
npm install --save openapi-client-axios openapi-lambda-adapter
```


Setup for single lambda handling all API Gateway requests 

```javascript
import OpenAPIClientAxios from 'openapi-client-axios';
import { getLambdaRunner } from 'openapi-lambda-adapter';

const api = new OpenAPIClientAxios({ definition: 'https://example.com/api/openapi.json' });
const client = api.initSync();
client.api.registerRunner(getLambdaRunner('target-lambda-name'));

const res = await client.createPet(null, { name: 'Garfield' });
console.log('Pet created', res.data);
```

Setup for multiple lambdas, each lambda handling one API Gateway resource 

```javascript
import OpenAPIClientAxios from 'openapi-client-axios';
import { getLambdaRunner } from 'openapi-lambda-adapter';

const api = new OpenAPIClientAxios({ definition: 'https://example.com/api/openapi.json' });
const client = api.initSync();
client.api.getOperations().forEach((operation) => {
    const lambdaName = ... get lambda-name for operationId
    client.api.registerRunner(getLambdaRunner(lambdaName), operation.operationId)
  })

const res = await client.createPet(null, { name: 'Garfield' });
console.log('Pet created', res.data);

const resp = await client.getPet({ id: 1 }, null);
console.log('Pet retrieved', resp.data);
```