/**
 * AWS API Gateway helpers class
 */
export default class ApiGateway {
  /**
   * Returns response in AWS API Gateway format
   * @param {Object|string} body Response payload
   * @param {number} statusCode HTTP response status
   * @param {Object} [responseHeaders={}] Custom headers
   * @param {boolean} [base64=false] Defines if body is Base64 encoded
   * @param {string} [origin='*'] Allowed origin (for API we assume there is no need to do any restrictions)
   * @returns {Object} Response for API Gateway
   */
  static response (body = '', statusCode = 200, responseHeaders = {}, base64 = false, origin = '*') {
    if (!Number.isInteger(statusCode) || (statusCode < 100) || (statusCode > 599)) {
      throw new Error('Incorrect HTTP error code')
    }
    const redirect = Math.floor(statusCode / 100) === 3
    const extraHeaders = origin !== null ? { 'Access-Control-Allow-Origin': [origin], 'Access-Control-Allow-Headers': ['*'] } : {}
    const multiValueHeaders = Object.assign({}, responseHeaders, redirect ? {} : extraHeaders)
    const res = { statusCode }
    if (body !== null) {
      if (typeof body === 'string') {
        res.body = body
        res.isBase64Encoded = base64
      } else {
        res.body = JSON.stringify(body, null, 2)
        if (!('Content-Type' in multiValueHeaders)) {
          multiValueHeaders['Content-Type'] = ['application/json']
        }
        res.isBase64Encoded = false
      }
    }
    res.multiValueHeaders = multiValueHeaders
    return res
  }

  /**
   * Returns HTTP redirect response in AWS API Gateway format
   * @param {string} location Redirect URL
   * @param {boolean} [permanent=false] Defines if redirect is permanent
   * @param {string} [origin='*'] Allowed origin (for API we assume there is no need to do any restrictions)
   * @returns {Object} Response for API Gateway
   */
  static redirect (location, permanent = false, origin = '*') {
    return this.response(null, permanent ? 301 : 302, { Location: [location] }, false, origin)
  }

  /**
   * Returns error response in AWS API Gateway format
   * @param {string} message Error message
   * @param {number} [statusCode=500] HTTP response status
   * @param {Object} [errorDetails={}] Additional parameter for response
   * @param {Object} [responseHeaders={}] Custom headers
   * @param {string} [origin='*'] Allowed origin (for API we assume there is no need to do any restrictions)
   * @returns {Object} Response for API Gateway
   */
  static error (message, statusCode = 500, errorDetails = {}, responseHeaders = {}, origin = '*') {
    const time = (new Date()).toISOString()
    return this.response(Object.assign({ message, time }, errorDetails), statusCode, responseHeaders, false, origin)
  }
}
