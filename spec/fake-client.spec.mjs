/* eslint-disable no-undef */

import FakeClient from './helpers/fake-client.mjs'

describe('Proper workflow', () => {
  it('works and the order is proper', async () => {
    const fakeClient = new FakeClient()
    const mock1 = 'mock 1'
    const mock2 = 'mock 2'
    fakeClient.addMock(mock1)
    fakeClient.addMock(mock2)
    const response1 = await fakeClient.send('test 1')
    const response2 = await fakeClient.send('test 2')
    expect(response1).toBe(mock1)
    expect(response2).toBe(mock2)
    expect(fakeClient.getMockedCommand()).toBe('test 1')
    expect(fakeClient.getMockedCommand()).toBe('test 2')
  })
})

describe('Fake Client Errors', () => {
  it('dies if no mocks were never added', async () => {
    const fakeClient = new FakeClient()
    let thrownError = null
    try {
      await fakeClient.send('test')
    } catch (e) {
      thrownError = e
    }
    expect(thrownError).not.toBe(null)
    expect(thrownError.message).toBe('No more mocks are found')
  })
  it('dies if no mocks were never added (when getting mocked request)', async () => {
    const fakeClient = new FakeClient()
    let thrownError = null
    try {
      fakeClient.getMockedCommand()
    } catch (e) {
      thrownError = e
    }
    expect(thrownError).not.toBe(null)
    expect(thrownError.message).toBe('No more mocked commands are found')
  })
  it('dies if no more mocks found', async () => {
    const fakeClient = new FakeClient()
    const mock = 'mock 1'
    fakeClient.addMock(mock)
    const response = await fakeClient.send('test')
    expect(response).toBe(mock)
    expect(fakeClient.getMockedCommand()).toBe('test')
    let thrownError = null
    try {
      await fakeClient.send('test')
    } catch (e) {
      thrownError = e
    }
    expect(thrownError).not.toBe(null)
    expect(thrownError.message).toBe('No more mocks are found')
  })
  it('dies if no more mocked calls found', async () => {
    const fakeClient = new FakeClient()
    const mock = 'mock 1'
    fakeClient.addMock(mock)
    const response = await fakeClient.send('test')
    expect(response).toBe(mock)
    expect(fakeClient.getMockedCommand()).toBe('test')
    let thrownError = null
    try {
      fakeClient.getMockedCommand()
    } catch (e) {
      thrownError = e
    }
    expect(thrownError).not.toBe(null)
    expect(thrownError.message).toBe('No more mocked commands are found')
  })
})
