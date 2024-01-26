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
      view: {
        required: true,
        type: 'string',
        max: 36,
        default: 'default'
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
   * Generic item request schema in orange-dragonfly-validator format
   * @type {Object}
   */
  static get ITEM_SCHEMA () {
    return {
      view: {
        required: true,
        type: 'string',
        max: 36,
        default: 'default'
      }
    }
  }

  /**
   * Registers API resource
   * @param {string} name Resource name the way it will be used on URL and in DynameDB
   * @param {Object} schema Resource structure schema in orange-dragonfly-validator format
   * @param {Object} [options={}] Resource custom options
   */
  static registerResource (name, schema, options = {}) {
    if (!this._SCHEMAS) {
      this._SCHEMAS = {}
    }
    this._SCHEMAS[name] = schema
    if (!this._SCHEMAS_OPTIONS) {
      this._SCHEMAS_OPTIONS = {}
    }
    this._SCHEMAS_OPTIONS[name] = options
  }

  /**
   * Returns resource structure schema if registered
   * @param {string} name Resource name the way it was registered
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
   * Returns options for the reource
   * @param {string} name Resource name the way it was registered
   * @returns {Object|null} Resource options
   */
  static getResourceOptions (name) {
    if (!this._SCHEMAS_OPTIONS) {
      throw new Error('Schemas options are not registered')
    }
    if (name in this._SCHEMAS_OPTIONS) {
      return this._SCHEMAS_OPTIONS[name]
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
   * Formats items for output
   * @param {string} resource Name of resource
   * @param {Object} payload Item's payload
   * @param {string} [view="default"] Name of the view
   * @returns {Object} Formatted output for API
   */
  static formatItem (resource, payload, view = 'default') {
    const options = this.getResourceOptions(resource)
    if (options.views) {
      if (view in options.views) {
        const format = options.views[view]
        if (typeof format === 'function') {
          return format(payload)
        }
        if (Array.isArray(format)) {
          return Object.entries(payload)
            .filter((v) => format.includes(v[0]))
            .reduce((a, c) => Object.assign(a, { [c[0]]: c[1] }), {})
        }
        if (format && (typeof format === 'object') && (format.constructor.name === 'Object')) {
          return Object.entries(payload)
            .filter((v) => v[0] in format)
            .reduce((a, c) => Object.assign(a, { [format[c[0]]]: c[1] }), {})
        }
        throw new Error(`"views" option for resource ${resource} is not array, object or function`)
      }
    }
    return payload
  }

  /**
   * Controller function for GET list of items
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeGet (route, dataProvider, request) {
    validate(this.LIST_SCHEMA, request.query)
    const { resource } = route.params
    this.getSchema(resource)
    const items = await dataProvider.search(request.user, resource, request.query)
    const output = items.map((v) => this.formatItem(resource, v, request?.query?.view))
    const options = this.getResourceOptions(resource)
    if (options.single) {
      return output.length
        ? ApiGateway.response(output[0])
        : ApiGateway.error('Object not found', 404)
    } else {
      return ApiGateway.response(output)
    }
  }

  /**
   * Controller function for POST item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routePost (route, dataProvider, request) {
    validate(this.ITEM_SCHEMA, request.query)
    const { resource } = route.params
    const options = this.getResourceOptions(resource)
    if (options.single) {
      const items = await dataProvider.search(request.user, resource, { limit: 1 })
      if (items.length) {
        const params = { ...route.params, uuid: items[0].uuid }
        return await this.routeReplaceItem({ ...route, params }, dataProvider, request)
      }
    }
    validate(this.getSchema(resource), request.body)
    const item = await dataProvider.save(request.user, resource, request.body)
    const output = this.formatItem(resource, item, request?.query?.view)
    return ApiGateway.response(output, 201)
  }

  /**
   * Controller function for GET item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeGetItem (route, dataProvider, request) {
    validate(this.ITEM_SCHEMA, request.query)
    const { resource, uuid } = route.params
    this.getSchema(resource)
    const item = await dataProvider.getAndCheckAccess(request.user, resource, uuid)
    if (!item) return ApiGateway.error('Object not found', 404)
    const output = this.formatItem(resource, item, request?.query?.view)
    return ApiGateway.response(output)
  }

  /**
   * Controller function for PUT item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeReplaceItem (route, dataProvider, request) {
    validate(this.ITEM_SCHEMA, request.query)
    const { resource, uuid } = route.params
    const payload = { ...request.body }
    if ('uuid' in payload) {
      if (payload.uuid !== uuid) return ApiGateway.error('UUID does\'t match', 400)
      delete payload.uuid
    }
    const schema = this.getSchema(resource)
    if (('timestamp' in payload) && !('timestamp' in schema)) {
      delete payload.timestamp
    }
    validate(schema, payload)
    let item = await dataProvider.getAndCheckAccess(request.user, resource, uuid)
    if (!item) return ApiGateway.error('Object not found', 404)
    item = await dataProvider.save(request.user, resource, payload, uuid)
    const output = this.formatItem(resource, item, request?.query?.view)
    return ApiGateway.response(output, 200)
  }

  /**
   * Controller function for PATCH item
   * @param {Object} route Route
   * @param {DataProvider} dataProvider Data provider
   * @param {Object} request Request
   * @returns {Object} API Gateway response
   */
  static async routeUpdateItem (route, dataProvider, request) {
    validate(this.ITEM_SCHEMA, request.query)
    const { resource, uuid } = route.params
    const schema = this.getSchema(resource)
    let item = await dataProvider.getAndCheckAccess(request.user, resource, uuid)
    if (!item) return ApiGateway.error('Object not found', 404)
    const payload = { ...item, ...request.body }
    delete payload.uuid
    if (!('timestamp' in schema)) delete payload.timestamp
    validate(schema, payload)
    item = await dataProvider.save(request.user, resource, payload, uuid)
    const output = this.formatItem(resource, item, request?.query?.view)
    return ApiGateway.response(output)
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
