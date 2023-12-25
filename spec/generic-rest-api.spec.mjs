/* eslint-disable no-undef */

import validate from 'orange-dragonfly-validator'
import GenericRestAPI from '../src/generic-rest-api.mjs'
import { OrangeDragonflyRouter } from 'orange-dragonfly-router'
import DataProvider from '../src/data-provider.mjs'
import FakeClient from './helpers/fake-client.mjs'

GenericRestAPI.registerResource('user', { username: { type: ['string'] } })
GenericRestAPI.registerResource('article', { name: { type: ['string'] } })

describe('LIST_SCHEMA', () => {
  it('exists', () => {
    expect(Object.keys(GenericRestAPI.LIST_SCHEMA)).toEqual(['limit', 'last_uuid', 'last_timestamp', 'start', 'end'])
  })
  it('is valid', () => {
    expect(() => validate(GenericRestAPI.LIST_SCHEMA, {})).not.toThrow()
  })
})

describe('registerResource and getSchema', () => {
  it('works', () => {
    const s1 = GenericRestAPI.getSchema('user')
    expect(s1.username.type[0]).toBe('string')
    const s2 = GenericRestAPI.getSchema('article')
    expect(s2.name.type[0]).toBe('string')
    const s3 = GenericRestAPI.getSchema('something')
    expect(s3).toBe(null)
  })
})

describe('getUserIdFromEvent', () => {
  it('works if found', () => {
    const sub = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
    const event = { requestContext: { authorizer: { claims: { sub } } } }
    expect(GenericRestAPI.getUserIdFromEvent(event)).toBe(sub)
  })
  it('works if not found', () => {
    expect(GenericRestAPI.getUserIdFromEvent({})).toBe(null)
  })
  it('works if not found (empty event)', () => {
    expect(GenericRestAPI.getUserIdFromEvent({ requestContext: {} })).toBe(null)
  })
})

describe('buildGenericRouter and make sure routing works', () => {
  it('works (get)', () => {
    const router = GenericRestAPI.buildGenericRouter()
    const route = router.route('/api/items', 'GET')
    expect(route.params.resource).toBe('items')
    expect(route.params.uuid).toBeUndefined()
    expect(route.is_default).toBe(false)
    expect(route.route_object.name).toBe('bound routeGet')
  })
  it('works (get) - custom path', () => {
    const router = GenericRestAPI.buildGenericRouter('/xxx')
    const route = router.route('/xxx/items', 'GET')
    expect(route.params.resource).toBe('items')
    expect(route.params.uuid).toBeUndefined()
    expect(route.is_default).toBe(false)
    expect(route.route_object.name).toBe('bound routeGet')
  })
  it('works (post)', () => {
    const router = GenericRestAPI.buildGenericRouter()
    const route = router.route('/api/items', 'POST')
    expect(route.params.resource).toBe('items')
    expect(route.params.uuid).toBeUndefined()
    expect(route.is_default).toBe(false)
    expect(route.route_object.name).toBe('bound routePost')
  })
  it('works (get item)', () => {
    const router = GenericRestAPI.buildGenericRouter()
    const route = router.route('/api/items/aaaaaaaa-aaaa-aaaa-aaaa-00000001', 'GET')
    expect(route.params.resource).toBe('items')
    expect(route.params.uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    expect(route.is_default).toBe(false)
    expect(route.route_object.name).toBe('bound routeGetItem')
  })
  it('works (put item)', () => {
    const router = GenericRestAPI.buildGenericRouter()
    const route = router.route('/api/items/aaaaaaaa-aaaa-aaaa-aaaa-00000001', 'PUT')
    expect(route.params.resource).toBe('items')
    expect(route.params.uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    expect(route.is_default).toBe(false)
    expect(route.route_object.name).toBe('bound routeReplaceItem')
  })
  it('works (patch item)', () => {
    const router = GenericRestAPI.buildGenericRouter()
    const route = router.route('/api/items/aaaaaaaa-aaaa-aaaa-aaaa-00000001', 'PATCH')
    expect(route.params.resource).toBe('items')
    expect(route.params.uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    expect(route.is_default).toBe(false)
    expect(route.route_object.name).toBe('bound routeUpdateItem')
  })
  it('works (delete item)', () => {
    const router = GenericRestAPI.buildGenericRouter()
    const route = router.route('/api/items/aaaaaaaa-aaaa-aaaa-aaaa-00000001', 'DELETE')
    expect(route.params.resource).toBe('items')
    expect(route.params.uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    expect(route.is_default).toBe(false)
    expect(route.route_object.name).toBe('bound routeDeleteItem')
  })
  it('works - default (404)', () => {
    const router = GenericRestAPI.buildGenericRouter()
    const route = router.route('/test', 'GET')
    expect(route.is_default).toBe(true)
  })
  it('works - custom route', () => {
    const router = new OrangeDragonflyRouter()
    router.register('/custom', 'GET', function customController () {})
    GenericRestAPI.buildGenericRouter('/api', router)
    const cRoute = router.route('/custom', 'GET')
    expect(cRoute.is_default).toBe(false)
    expect(cRoute.route_object.name).toBe('customController')
    const route = router.route('/api/items', 'GET')
    expect(route.params.resource).toBe('items')
    expect(route.params.uuid).toBeUndefined()
    expect(route.is_default).toBe(false)
    expect(route.route_object.name).toBe('bound routeGet')
  })
})

describe('processRequest', () => {
  it('works', async () => {
    const router = GenericRestAPI.buildGenericRouter()
    const response = await GenericRestAPI.processRequest({ user: 'u111', method: 'GET', path: '/somethig-something' }, router, null)
    expect(response.statusCode).toBe(404) // with 404 route it is easier to test - we don't need dataProvider, etc.
    expect(response.body).toContain('Endpoint not found')
  })
  it('no user', async () => {
    const router = GenericRestAPI.buildGenericRouter()
    const response = await GenericRestAPI.processRequest({ method: 'GET', path: '/somethig-something' }, router, null)
    expect(response.statusCode).toBe(401)
    expect(response.body).toContain('User ID not found in the event')
  })
})

describe('parseEvent', () => {
  it('works', async () => {
    const request = await GenericRestAPI.parseEvent({
      resource: '/',
      path: '/test',
      httpMethod: 'POST',
      requestContext: {
        authorizer: {
          claims: {
            sub: 'u111'
          }
        }
      },
      body: '{"test": 1}',
      isBase64Encoded: false
    })
    expect(request.method).toBe('POST')
    expect(request.path).toBe('/test')
    expect(request.user).toBe('u111')
    expect(request.body).toEqual({ test: 1 })
  })
  it('bad request', async () => {
    const request = await GenericRestAPI.parseEvent({
      resource: '/',
      path: '/test',
      httpMethod: 'POST',
      requestContext: {
        authorizer: {
          claims: {
            sub: 'u111'
          }
        }
      },
      body: '{"test": 1 ----',
      isBase64Encoded: false
    })
    expect(request).toBe(null)
  })
})

describe('routeGet', () => {
  it('works', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Items: [
        fakeClient.generateTestItem('N2', '/u111:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000002'),
        fakeClient.generateTestItem('N1', '/u111:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
      ]
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeGet({ params: { resource: 'article' } }, dataProvider, { user: 'u111' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('aaaaaaaa-aaaa-aaaa-aaaa-00000002')
    expect(response.body).toContain('aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('QueryCommand')
  })
})

describe('routePost', () => {
  it('works', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({ })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routePost({ params: { resource: 'article' } }, dataProvider, { user: 'u111', body: { name: 'Test 1' } })
    expect(response.statusCode).toBe(201)
    expect(response.body).toContain('uuid')
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('PutItemCommand')
  })
  it('dies if validation failed', async () => {
    const fakeClient = new FakeClient()
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    let thrownError = null
    try {
      await GenericRestAPI.routePost({ params: { resource: 'article' } }, dataProvider, { user: 'u111', body: { name: true } })
    } catch (e) {
      thrownError = e
    }
    expect(thrownError).not.toBe(null)
    expect(thrownError.message).toBe('Validation failed')
  })
})

describe('routeGetItem', () => {
  it('works', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u111:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeGetItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
  it('bad user', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u000:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeGetItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111' })
    expect(response.statusCode).toBe(404)
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
  it('not found', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: null
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeGetItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111' })
    expect(response.statusCode).toBe(404)
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
})

describe('routeDeleteItem', () => {
  it('works', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u111:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    fakeClient.addMock({})
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeDeleteItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('Deleted')
    let mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
    mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('DeleteItemCommand')
  })
  it('bad user', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u000:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeDeleteItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111' })
    expect(response.statusCode).toBe(404)
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
  it('not found', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: null
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeDeleteItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111' })
    expect(response.statusCode).toBe(404)
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
})

describe('routeReplaceItem', () => {
  it('works', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u111:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    fakeClient.addMock({})
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeReplaceItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111', body: { name: 'NX' } })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    expect(response.body).toContain('NX')
    let mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
    mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('PutItemCommand')
  })
  it('dies if validation failed', async () => {
    const fakeClient = new FakeClient()
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    let thrownError = null
    try {
      await GenericRestAPI.routeReplaceItem({ params: { resource: 'article' } }, dataProvider, { user: 'u111', body: { name: true } })
    } catch (e) {
      thrownError = e
    }
    expect(thrownError).not.toBe(null)
    expect(thrownError.message).toBe('Validation failed')
  })
  it('bad user', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u000:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeReplaceItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111', body: { name: 'NX' } })
    expect(response.statusCode).toBe(404)
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
  it('not found', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: null
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeReplaceItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111', body: { name: 'NX' } })
    expect(response.statusCode).toBe(404)
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
})

describe('routeUpdateItem', () => {
  it('works', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u111:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    fakeClient.addMock({})
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeUpdateItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111', body: { name: 'NX' } })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    expect(response.body).toContain('NX')
    let mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
    mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('PutItemCommand')
  })
  it('dies if validation failed', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u111:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    let thrownError = null
    try {
      await GenericRestAPI.routeUpdateItem({ params: { resource: 'article' } }, dataProvider, { user: 'u111', body: { name: true } })
    } catch (e) {
      thrownError = e
    }
    expect(thrownError).not.toBe(null)
    expect(thrownError.message).toBe('Validation failed')
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
  it('bad user', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: fakeClient.generateTestItem('N1', '/u000:article', 'aaaaaaaa-aaaa-aaaa-aaaa-00000001')
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeUpdateItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111', body: { name: 'NX' } })
    expect(response.statusCode).toBe(404)
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
  it('not found', async () => {
    const fakeClient = new FakeClient()
    fakeClient.addMock({
      Item: null
    })
    const dataProvider = new DataProvider('MyTable', '', {}, fakeClient)
    const response = await GenericRestAPI.routeUpdateItem({ params: { resource: 'article', uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-00000001' } }, dataProvider, { user: 'u111', body: { name: 'NX' } })
    expect(response.statusCode).toBe(404)
    const mock = fakeClient.getMockedCommand()
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
})
