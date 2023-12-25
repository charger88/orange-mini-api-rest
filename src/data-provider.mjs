import { DynamoDBClient, QueryCommand, PutItemCommand, GetItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb'
import { v4 } from 'uuid'

/**
 * Class responsible for the communication with DynamoDB which is used as a data storage
 */
export default class DataProvider {
  /**
   * Creates DataProvider instanse
   * @param {string} table DynamoDB table name
   * @param {string} [prefix=""] Optional prefix for "owned_resource_type" parameter in the table
   * @param {Object} [clientConfig={}] Config for DynamoDBClient client (it is meaningless if "client" parameter is provided)
   * @param {DynamoDBClient|FakeClient|null} [client=null] Allows to use specific DynamoDB clint (if not provided, DynamoDBClient client with "clientConfig" config will be created)
   */
  constructor (table, prefix = '', clientConfig = {}, client = null) {
    this.table = table
    this.prefix = prefix
    this.client = client || new DynamoDBClient(clientConfig)
  }

  /**
   * Perfroms search in DynamoDB table
   * @param {string} userId ID of the user
   * @param {string} resource Type of the API resource
   * @param {Object} [search={}] Search parameters
   * @param {function|null} params_callback Callback function to modify QueryCommand parameters if necessary
   * @returns {Object[]} List of items
   */
  async search (userId, resource, search = {}, params_callback = null) {
    const params = {
      TableName: this.table,
      IndexName: 'OwnedResources',
      KeyConditionExpression: '#ort = :ort AND #ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ort': 'owned_resource_type',
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':ort': { S: this._getOwnerResourceType(userId, resource) },
        ':start': { N: (search.start || 0).toString() },
        ':end': { N: (search.end || Date.now()).toString() }
      },
      ScanIndexForward: search.sort === 'asc'
    }
    if (search.limit) {
      params.Limit = search.limit
    }
    if (search.last_uuid && search.last_timestamp) {
      params.ExclusiveStartKey = {
        owned_resource_type: { S: this._getOwnerResourceType(userId, resource) },
        timestamp: { N: search.last_timestamp.toString() },
        uuid: { S: search.last_uuid }
      }
    }
    if (params_callback) await params_callback(params)
    const command = new QueryCommand(params)
    const res = await this.client.send(command)
    return (res.Items || []).map((v) => this.constructor._formatItem(v))
  }

  /**
   * Returns item by UUID if found and if it is available
   * @param {string} userId ID of the user
   * @param {string} resource Type of the API resource
   * @param {string} uuid UUID of DB record
   * @returns {Object|null} Item
   */
  async getAndCheckAccess (userId, resource, uuid) {
    const params = {
      TableName: this.table,
      Key: {
        uuid: { S: uuid }
      }
    }
    const command = new GetItemCommand(params)
    const res = await this.client.send(command)
    if (!res.Item) {
      return null
    }
    if (res.Item.owned_resource_type.S !== this._getOwnerResourceType(userId, resource)) {
      return null
    }
    return this.constructor._formatItem(res.Item)
  }

  /**
   * Removes record (access is not being checked in this function)
   * @param {string} uuid UUID of DB record
   * @returns {boolean} Removal status
   */
  async remove (uuid) {
    const params = {
      TableName: this.table,
      Key: {
        uuid: { S: uuid }
      }
    }
    const command = new DeleteItemCommand(params)
    await this.client.send(command)
    return true
  }

  /**
   * Saves item in the database (access is not being checked in this function)
   * @param {string} userId ID of the user
   * @param {string} resource Type of the API resource
   * @param {Object} data_raw Data of the item
   * @param {string|null} [current_uuid=null] UUID of DB record if record is not new
   * @returns {Object} Item
   */
  async save (userId, resource, data_raw, current_uuid = null) {
    const uuid = current_uuid || v4()
    const data = { ...data_raw }
    let timestamp = Date.now()
    if ('timestamp' in data) {
      timestamp = data.timestamp
      delete data.timestamp
    }
    const owned_resource_type = this._getOwnerResourceType(userId, resource)
    const payload = { uuid, owned_resource_type, timestamp, data }
    const command = new PutItemCommand({
      TableName: this.table,
      Item: marshall(payload)
    })
    await this.client.send(command)
    return this.constructor._formatItem(payload, false)
  }

  /**
   * Generates owner_resource_type value
   * @private
   * @param {string} userId ID of the user
   * @param {string} resource Type of the API resource
   * @returns {string} owner_resource_type value
   */
  _getOwnerResourceType (userId, resource) {
    return `${this.prefix || ''}/${userId}:${resource}`
  }

  /**
   * Creates external representation of the item
   * @private
   * @param {Object} raw Item
   * @param {boolean} [is_raw=true] If raw, it means data is just loaded from DynamoDB
   * @returns {Object} External representation of the item
   */
  static _formatItem (raw, is_raw = true) {
    const item = is_raw ? unmarshall(raw) : raw
    const output = { uuid: null, timestamp: null, ...item.data }
    delete output.owned_resource_type
    output.uuid = item.uuid
    output.timestamp = item.timestamp
    return output
  }
}
