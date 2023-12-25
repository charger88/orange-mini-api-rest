/* eslint-disable no-undef */

import FakeClient from './helpers/fake-client.mjs'
import DataProvider from '../src/data-provider.mjs'

describe('Search', () => {
  it('works', async () => {
    const client = new FakeClient()
    client.addMock({
      Items: [
        client.generateTestItem('Saved name 3', '/u1:item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000003'),
        client.generateTestItem('Saved name 2', '/u1:item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002'),
        client.generateTestItem('Saved name 1', '/u1:item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001')
      ]
    })
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const before = Date.now()
    const items = await dataProvider.search('u1', 'item')
    const mock = client.getMockedCommand()
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
    // Test response
    expect(items.length).toBe(3)
    expect(Object.keys(items[0]).length).toBe(3)
    expect(items[0].uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000003')
    expect(items[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(items[0].timestamp).toBeLessThanOrEqual(Date.now())
    expect(items[0].name).toBe('Saved name 3')
    expect(items[1].uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000002')
    expect(items[1].timestamp).toBeGreaterThanOrEqual(before)
    expect(items[1].timestamp).toBeLessThanOrEqual(Date.now())
    expect(items[1].name).toBe('Saved name 2')
    expect(items[2].uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000001')
    expect(items[2].timestamp).toBeGreaterThanOrEqual(before)
    expect(items[2].timestamp).toBeLessThanOrEqual(Date.now())
    expect(items[2].name).toBe('Saved name 1')
    // Test command
    expect(mock.constructor.name).toBe('QueryCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable')
    expect(mock.input.KeyConditionExpression).toBe('#ort = :ort AND #ts BETWEEN :start AND :end')
    expect(Object.keys(mock.input.ExpressionAttributeNames).length).toBe(2)
    expect(mock.input.ExpressionAttributeNames['#ort']).toBe('owned_resource_type')
    expect(mock.input.ExpressionAttributeNames['#ts']).toBe('timestamp')
    expect(Object.keys(mock.input.ExpressionAttributeValues).length).toBe(3)
    expect(mock.input.ExpressionAttributeValues[':ort'].S).toBe('/u1:item')
    expect(mock.input.ExpressionAttributeValues[':start'].N).toBe('0')
    expect(parseInt(mock.input.ExpressionAttributeValues[':end'].N, 10)).toBeGreaterThanOrEqual(before)
    expect(parseInt(mock.input.ExpressionAttributeValues[':end'].N, 10)).toBeLessThanOrEqual(Date.now())
    expect(mock.input.ScanIndexForward).toBe(false)
  })
  it('works when nothing found', async () => {
    const client = new FakeClient()
    client.addMock({
      Items: []
    })
    const dataProvider = new DataProvider('MyDynamoTable2', '', {}, client)
    const items = await dataProvider.search('u2', 'record')
    expect(items.length).toBe(0)
    const mock = client.getMockedCommand()
    // Test command
    expect(mock.constructor.name).toBe('QueryCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable2')
    expect(mock.input.ExpressionAttributeValues[':ort'].S).toBe('/u2:record')
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
  })
  it('works with custom config', async () => {
    const client = new FakeClient()
    client.addMock({
      Items: []
    })
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const items = await dataProvider.search('u1', 'item', {
      start: 1672552800000,
      end: 1704088800000,
      sort: 'asc',
      limit: 15,
      last_uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001',
      last_timestamp: 1688187600000
    })
    expect(items.length).toBe(0)
    const mock = client.getMockedCommand()
    // Test command
    expect(mock.constructor.name).toBe('QueryCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable')
    expect(mock.input.KeyConditionExpression).toBe('#ort = :ort AND #ts BETWEEN :start AND :end')
    expect(Object.keys(mock.input.ExpressionAttributeNames).length).toBe(2)
    expect(mock.input.ExpressionAttributeNames['#ort']).toBe('owned_resource_type')
    expect(mock.input.ExpressionAttributeNames['#ts']).toBe('timestamp')
    expect(Object.keys(mock.input.ExpressionAttributeValues).length).toBe(3)
    expect(mock.input.ExpressionAttributeValues[':ort'].S).toBe('/u1:item')
    expect(mock.input.ExpressionAttributeValues[':start'].N).toBe('1672552800000')
    expect(mock.input.ExpressionAttributeValues[':end'].N).toBe('1704088800000')
    expect(mock.input.ScanIndexForward).toBe(true)
    expect(mock.input.Limit).toBe(15)
    expect(mock.input.ExclusiveStartKey.owned_resource_type.S).toBe('/u1:item')
    expect(mock.input.ExclusiveStartKey.timestamp.N).toBe('1688187600000')
    expect(mock.input.ExclusiveStartKey.uuid.S).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000001')
  })
  it('works with params_callback', async () => {
    const client = new FakeClient()
    client.addMock({
      Items: []
    })
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const items = await dataProvider.search('u1', 'item', {
      limit: 15
    }, (q) => {
      q.Limit = 20
    })
    expect(items.length).toBe(0)
    const mock = client.getMockedCommand()
    // Test command
    expect(mock.constructor.name).toBe('QueryCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable')
    expect(mock.input.Limit).toBe(20)
    expect(mock.input.ExpressionAttributeValues[':ort'].S).toBe('/u1:item')
  })
})

describe('Get and check access', () => {
  it('works', async () => {
    const client = new FakeClient()
    client.addMock({
      Item: client.generateTestItem('Saved name by UUID', '/u1:item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    })
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const before = Date.now()
    const item = await dataProvider.getAndCheckAccess('u1', 'item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    const mock = client.getMockedCommand()
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
    // Test response
    expect(item.uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    expect(item.timestamp).toBeGreaterThanOrEqual(before)
    expect(item.timestamp).toBeLessThanOrEqual(Date.now())
    expect(item.name).toBe('Saved name by UUID')
    // Test command
    expect(mock.constructor.name).toBe('GetItemCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable')
    expect(mock.input.Key.uuid.S).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
  })
  it('return null if resource don\'t match', async () => {
    const client = new FakeClient()
    client.addMock({
      Item: client.generateTestItem('Saved name by UUID', '/u1:item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    })
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const item = await dataProvider.getAndCheckAccess('u1', 'record', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    const mock = client.getMockedCommand()
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
    expect(item).toBe(null)
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
  it('return null if user don\'t match', async () => {
    const client = new FakeClient()
    client.addMock({
      Item: client.generateTestItem('Saved name by UUID', '/u1:item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    })
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const item = await dataProvider.getAndCheckAccess('u555', 'item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    const mock = client.getMockedCommand()
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
    expect(item).toBe(null)
    // Test command
    expect(mock.constructor.name).toBe('GetItemCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable')
    expect(mock.input.Key.uuid.S).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
  })
  it('returns null if not found', async () => {
    const client = new FakeClient()
    client.addMock({})
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const item = await dataProvider.getAndCheckAccess('u1', 'item', 'aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    const mock = client.getMockedCommand()
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
    expect(item).toBe(null)
    expect(mock.constructor.name).toBe('GetItemCommand')
  })
})

describe('Remove', () => {
  it('works', async () => {
    const client = new FakeClient()
    client.addMock({})
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const res = await dataProvider.remove('aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    expect(res).toBe(true)
    const mock = client.getMockedCommand()
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
    // Test command
    expect(mock.constructor.name).toBe('DeleteItemCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable')
    expect(mock.input.Key.uuid.S).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
  })
})

describe('Save', () => {
  it('works - creating a new one', async () => {
    const client = new FakeClient()
    client.addMock({})
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const before = Date.now()
    const item = await dataProvider.save('u1', 'item', { name: 'New item', amount: 5 })
    expect(item.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(item.timestamp).toBeGreaterThanOrEqual(before)
    expect(item.timestamp).toBeLessThanOrEqual(Date.now())
    expect(item.name).toBe('New item')
    expect(item.amount).toBe(5)
    const mock = client.getMockedCommand()
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
    // Test command
    expect(mock.constructor.name).toBe('PutItemCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable')
    expect(mock.input.Item.uuid.S).toBe(item.uuid)
    expect(mock.input.Item.timestamp.N).toBe(item.timestamp.toString())
    expect(mock.input.Item.data.M.name.S).toBe('New item')
    expect(mock.input.Item.data.M.amount.N).toBe('5')
  })
  it('works - updating the existing one', async () => {
    const client = new FakeClient()
    client.addMock({})
    const dataProvider = new DataProvider('MyDynamoTable', '', {}, client)
    const item = await dataProvider.save('u1', 'item', { name: 'Updated item', amount: 5, timestamp: 1688187600000 }, 'aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    expect(item.uuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-000000000000')
    expect(item.timestamp).toBe(1688187600000)
    expect(item.name).toBe('Updated item')
    expect(item.amount).toBe(5)
    const mock = client.getMockedCommand()
    expect(client.commandMocksCount).toBe(0)
    expect(client.mockedCommandsCount).toBe(0)
    // Test command
    expect(mock.constructor.name).toBe('PutItemCommand')
    expect(mock.input.TableName).toBe('MyDynamoTable')
    expect(mock.input.Item.uuid.S).toBe(item.uuid)
    expect(mock.input.Item.timestamp.N).toBe(item.timestamp.toString())
    expect(mock.input.Item.data.M.name.S).toBe('Updated item')
    expect(mock.input.Item.data.M.amount.N).toBe('5')
  })
})
