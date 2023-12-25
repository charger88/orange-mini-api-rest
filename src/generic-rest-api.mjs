import { OrangeDragonflyRouter } from 'orange-dragonfly-router'
import validate from 'orange-dragonfly-validator'

import ApiGateway from './api-gateway.mjs'

/**
 * Generic API Controller functionality
 */
export default class GenericRestAPI {
  /**
   * Search request schema in orange-dragonfly-validator format
   * @type {Object}
   */
  static get LIST_SCHEMA () {
    return {
      limit: {
        transform: (v) => parseInt(v, 10),
        apply_transformed: true,
        type: 'integer',
        min: 0
      },
      last_uuid: {
        type: 'string',
        min: 36,
        max: 36
      },
      last_timestamp: {
        transform: (v) => parseInt(v, 10),
        apply_transformed: true,
        type: 'integer',
        min: 0
      },
      start: {
        transform: (v) => parseInt(v, 10),
        apply_transformed: true,
        type: 'integer',
        min: 0
      },
      end: {
        transform: (v) => parseInt(v, 10),
        apply_transformed: true,
        type: 'integer',
        min: 0
      }
    }
  }

  /**
   * Registers API resource
   * @param {string} name Resource name the way it will be used on URL and in DynameDB
   * @param {Object} schema Resource structure schema in orange-dragonfly-validator format
   */
  static registerResource (name, schema) {
    if (!this._SCHEMAS) {
      this._SCHEMAS = {}
    }
    this._SCHEMAS[name] = schema
  }

  /**
   * Returns resource structure schema if registered
   * @param {string} name Resource name the way it will be used on URL and in DynameDB
   * @returns {Object|null} Resource structure schema
   */
  static getSchema (name) {
    if (!this._SCHEMAS) {
      throw new Error('Schemas are not registered')
    }
    if (name in this._SCHEMAS) {
      return this._SCHEMAS[name]
    }
    return null
  }

  /**
   * Returns user ID from AWS API Gateway event
   * @param {Object} event AWS API Gateway event
   * @returns {string} User ID
   */
  static getUserIdFromEvent (event) {
    return event?.requestContext?.authorizer?.claims?.sub || null
  }

  /**
   * Parses event
   * @param {Object} event AWS API Gateway event
   * @returns {Object} Necessery data
   */
  static parseEvent (event) {
    try {
      return {
        body: event.body ? JSON.parse(event.body) : {},
        query: event.queryStringParameters || {},
        method: event.httpMethod,
        path: event.path,
        user: this.getUserIdFromEvent(event)
      }
    } catch (e) {
      return null
    }
  }

  /**
   * API call processor
   * @param {Object} request Event parsed via parseEvent
   * @param {OrangeDragonflyRouter} router Router
   * @param {DataProvider} dataProvider Data provider
   * @returns {Object} Response for API Gateway
   */
  static async processRequest (request, router, dataProvider) {
    if (!request) {
      return ApiGateway.error('Incorrect request', 400)
    }
    if (!request.user) {
      return ApiGateway.error('User ID not found in the event', 401)
    }
    const route = router.route(request.path, request.method)
    if ('resource' in route.params) {
      if (!this.getSchema(route.params.resource)) {
        return ApiGateway.error('Resource type not found', 404)
      }
    }
    try {
      return await route.route_object(route, dataProvider, request)
    } catch (e) {
      if (e.constructor.name === 'ValidationException') {
        return ApiGateway.error('Validation error', 422, e.info)
      }
      console.error(e)
      return ApiGateway.error('Something went wrong', 500)
    }
  }

  /**
   * Builds a router with generic API endpoints
   * @param {string} [prefix="/api"] API prefix (where API endoints will be mounted)
   * @param {OrangeDragonflyRouter|null} [router=null] Existing router (optional)
   * @returns {OrangeDragonflyRouter} Router
   */
  static buildGenericRouter (prefix = '/api', router = null) {
    return (router || OrangeDragonflyRouter.init())
      .register(`${prefix}/{resource}`, 'GET', this.routeGet.bind(this))
      .register(`${prefix}/{resource}`, 'POST', this.routePost.bind(this))
      .register(`${prefix}/{resource}/{uuid}`, 'GET', this.routeGetItem.bind(this))
      .register(`${prefix}/{resource}/{uuid}`, 'PUT', this.routeReplaceItem.bind(this))
      .register(`${prefix}/{resource}/{uuid}`, 'PATCH', this.routeUpdateItem.bind(this))
      .register(`${prefix}/{resource}/{uuid}`, 'DELETE', this.routeDeleteItem.bind(this))
      .registerDefault(this.routeDefault.bind(this))
  }

  /**
   * Controller function for GET list of items
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeGet (route, dataProvider, request) {
    const { resource } = route.params
    this.getSchema(resource)
    validate(this.LIST_SCHEMA, request.query)
    const items = await dataProvider.search(request.user, resource, request.query)
    return ApiGateway.response(items)
  }

  /**
   * Controller function for POST item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routePost (route, dataProvider, request) {
    const { resource } = route.params
    validate(this.getSchema(resource), request.body)
    const item = await dataProvider.save(request.user, resource, request.body)
    return ApiGateway.response(item, 201)
  }

  /**
   * Controller function for GET item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeGetItem (route, dataProvider, request) {
    const { resource, uuid } = route.params
    this.getSchema(resource)
    const item = await dataProvider.getAndCheckAccess(request.user, resource, uuid)
    if (!item) return ApiGateway.error('Object not found', 404)
    return ApiGateway.response(item)
  }

  /**
   * Controller function for PUT item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeReplaceItem (route, dataProvider, request) {
    const { resource, uuid } = route.params
    validate(this.getSchema(resource), request.body)
    let item = await dataProvider.getAndCheckAccess(request.user, resource, uuid)
    if (!item) return ApiGateway.error('Object not found', 404)
    item = await dataProvider.save(request.user, resource, request.body, uuid)
    return ApiGateway.response(item, 200)
  }

  /**
   * Controller function for PATCH item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeUpdateItem (route, dataProvider, request) {
    const { resource, uuid } = route.params
    const schema = this.getSchema(resource)
    let item = await dataProvider.getAndCheckAccess(request.user, resource, uuid)
    if (!item) return ApiGateway.error('Object not found', 404)
    const payload = { ...item, ...request.body }
    delete payload.uuid
    if (!('timestamp' in schema)) delete payload.timestamp
    validate(schema, payload)
    item = await dataProvider.save(request.user, resource, payload, uuid)
    return ApiGateway.response(item)
  }

  /**
   * Controller function for DELETE item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeDeleteItem (route, dataProvider, request) {
    const { resource, uuid } = route.params
    this.getSchema(resource)
    let item = await dataProvider.getAndCheckAccess(request.user, resource, uuid)
    if (!item) return ApiGateway.error('Object not found', 404)
    item = await dataProvider.remove(uuid)
    return ApiGateway.response({ message: 'Deleted', timestamp: Date.now() })
  }

  /**
   * Controller for default route (Error 404)
   * @returns {Object} API Gateway response
   */
  static async routeDefault () {
    return ApiGateway.error('Endpoint not found', 404)
  }
}
