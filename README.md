# Orange Mini API (REST)

With this library you can easily create small AWS-based REST API which uses AWS API Gateway, AWS Lambda, DynamoDB and, presumably, AWS Cognito.

This API limits access to resources per user - it means users can create and retrieve their data only. It can be useful for services where people track on their progress or history of something.

For every registered schema (resource) you will get set of endpoints

## Endpoints

* `GET /api/{resource}` - Get list of the objects (specific resource)
* `POST /api/{resource}` - Create new object
* `GET /api/{resource}/{uuid}` - Get object
* `PATCH /api/{resource}/{uuid}` - Update object (only new values should be provided)
* `PUT /api/{resource}/{uuid}` - Replace object (the entire payload should be provided)
* `DELETE /api/{resource}/{uuid}` - Delete object

### Query string parameters for "Get list" endpoint

* `limit` - limit (without it being provided, all records will be returned)
* `last_uuid` - last UUID value (for pagination)
* `last_timestamp` - last timestamp value (for pagination)
* `start` - beginning of the time range selection (timestamp in milliseconds)
* `end` - end of the time range selection (timestamp in milliseconds)

## DynamoDB configuration

Create a table in DynamoDB. Most configurations are up to you, but some things are critical:

1. The main Partition key should be `uuid` (String).
2. Create an additional index:
   - Name: `OwnedResources`
   - Partition key: `owned_resource_type` (String)
   - Sort key: `timestamp` (Number)

## Usage example

```javascript
import { ApiGateway, DataProvider, GenericRestAPI } from 'orange-mini-api-rest'

// Schemas should be defined in orange-dragonfly-validator format. See more at https://github.com/charger88/orange-dragonfly-validator
const SCHEMA_ARTICLE = { title: { required: true, type: 'string', max: 512 } }

// Objects of the registered resource will be accessible via /api/{resource} and /api/{resource}/{uuid} URIs.
GenericRestAPI.registerResource('article', SCHEMA_ARTICLE)

// You may decide to use environmental variable
const DYNAMO_DB_TABLE = 'MyTable'

// This optional feature, if define as non-empty string, would allow you to use one DynamoDB table for multiple projects - it will be part of the owned_resource_type key
const DYNAMO_DB_PREFIX = null

// This is AWS Lambda definition
export const handler = async (event) => {
  const router = GenericRestAPI.buildGenericRouter() // It is how we define router with all necessary endpoints
  router.register('/ping', 'GET', async () => ApiGateway.response({ now: Date.now() })) // Custom route
  const dataProvider = new DataProvider(TABLE, PREFIX)
  const request = GenericRestAPI.parseEvent(event) // "parseEvent" parses AWS API Gateway event
  return await GenericRestAPI.processRequest(request, router, dataProvider)
}
```

### Custom output

You can define different views for the specific resource:

```javascript
const views = {
  default: ['uuid', 'name', 'timestamp'] // "default" view will be applied by default.
  brief: ['uuid', 'name'], // any other view could be provided in query string like "/resources?view=brief"
  arr_view: ['uuid'], // there are 3 ways to define view. You can brovide array with the list of parameters to show
  obj_view: { 'uuid': 'id', 'name': 'name' }, // if view is defined as array, it will work as mapping (original parameter name to output parameter)
  fn_view: (output) => ({ ...output, random: Math.random() }), // function used for view woud receive generic output as parameter and should return the formatted one
}

GenericRestAPI.registerResource('article', SCHEMA_ARTICLE, { views })
```

## AWS NPM packages warning

For the purpose of the optimization AWS SDK packages are moved to `devDependencies` instead of `dependencies` in `package.json`.

If you are going to run it not as AWS Lambda, you will need to add these dependencies into your project:

```
"@aws-sdk/client-dynamodb": "^3.478.0",
"@aws-sdk/util-dynamodb": "^3.478.0",
```

## Serverless.yaml example

In case you will decide to use Serverless Framework, this might be helpful:

```yaml
service: {{YOUR_SERVICE_NAME}}
provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  stage: ${opt:stage, "prod"}
  iam:
    role:
      statements:
        - Effect: "Allow"
          Action:
            - "dynamodb:*"
          Resource: 
            - "arn:aws:dynamodb:*:*:*"
custom:
  cors-settings:
    origin: '*'
    headers:
      - '*'
  authorizer:
    name: authorizer
    type: COGNITO_USER_POOLS
    arn: arn:aws:cognito-idp:us-east-1:639794228698:userpool/{{YOUR_COGNITO_POOL_ID}}

functions:

  rest-api:
    handler: lambda.handler
    timeout: 30
    events:
      - http:
          path: /{proxy+}
          method: any
          cors: ${self:custom.cors-settings}
          authorizer: ${self:custom.authorizer}

```

## Description of some errors you may see:

* `Incorrect request` - Incorrect JSON body of the request.
* `User ID not found in the event` - Event doesn't have User information. The default solution expects AWS Cognito authorizer being used.
* `Resource type not found` - The requested resource is not registered (did you register it with `GenericRestAPI.registerResource`?).
* `Endpoint not found` - Incorrect path (URL).
* `Object not found` - The object with a certain UUID doesn't exist; it is not accessible for the current user, or the resource type in the URL is different from the object's one.
