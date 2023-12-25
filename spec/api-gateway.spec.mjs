/* eslint-disable no-undef */

import ApiGateway from '../src/api-gateway.mjs'

describe('Response', () => {
  it('works', () => {
    const response = ApiGateway.response()
    expect(response.statusCode).toBe(200)
    expect(response.multiValueHeaders['Access-Control-Allow-Origin'][0]).toBe('*')
    expect(response.multiValueHeaders['Access-Control-Allow-Headers'][0]).toBe('*')
    expect(response.body).toBe('')
    expect(response.isBase64Encoded).toBe(false)
  })
  it('works with custom response', () => {
    const response = ApiGateway.response({ test: 1 }, 201, { 'X-Header': ['12345'] }, false, 'https://localhost')
    expect(response.statusCode).toBe(201)
    expect(response.multiValueHeaders['Access-Control-Allow-Origin'][0]).toBe('https://localhost')
    expect(response.multiValueHeaders['Access-Control-Allow-Headers'][0]).toBe('*')
    expect(response.multiValueHeaders['X-Header'][0]).toBe('12345')
    expect(response.multiValueHeaders['Content-Type'][0]).toBe('application/json')
    expect(response.body).toBe('{\n  "test": 1\n}')
    expect(response.isBase64Encoded).toBe(false)
  })
})

describe('Special methods', () => {
  it('works for temporary (default) redirect', async () => {
    const response = ApiGateway.redirect('https://localhost')
    expect(response.statusCode).toBe(302)
    expect(response.multiValueHeaders.Location[0]).toBe('https://localhost')
    expect(response.body).toBeUndefined()
    expect(response.isBase64Encoded).toBeUndefined()
  })
  it('works for permanent redirect', async () => {
    const response = ApiGateway.redirect('https://localhost', true, 'https://127.0.0.1')
    expect(response.statusCode).toBe(301)
    expect(response.multiValueHeaders.Location[0]).toBe('https://localhost')
    expect(response.body).toBeUndefined()
    expect(response.isBase64Encoded).toBeUndefined()
  })
  it('works for errors', async () => {
    const response = ApiGateway.error('Something went extremely wrong')
    expect(response.statusCode).toBe(500)
    expect(response.multiValueHeaders['Access-Control-Allow-Origin'][0]).toBe('*')
    expect(response.multiValueHeaders['Access-Control-Allow-Headers'][0]).toBe('*')
    expect(response.multiValueHeaders['Content-Type'][0]).toBe('application/json')
    expect(response.body).toContain('"message": "Something went extremely wrong')
    expect(response.isBase64Encoded).toBe(false)
  })
  it('works for errors (customized)', async () => {
    const response = ApiGateway.error('Something went completely wrong', 418, { extra: 12345 }, { 'X-Header': ['12345'] }, 'https://localhost')
    expect(response.statusCode).toBe(418)
    expect(response.multiValueHeaders['Access-Control-Allow-Origin'][0]).toBe('https://localhost')
    expect(response.multiValueHeaders['Access-Control-Allow-Headers'][0]).toBe('*')
    expect(response.multiValueHeaders['X-Header'][0]).toBe('12345')
    expect(response.multiValueHeaders['Content-Type'][0]).toBe('application/json')
    expect(response.body).toContain('"message": "Something went completely wrong')
    expect(response.isBase64Encoded).toBe(false)
  })
})
