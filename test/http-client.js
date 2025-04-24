/**
 * Fetch-based HTTP client that mimics the request-promise-native API
 */

class HttpClient {
  constructor(defaults = {}) {
    this.defaults = defaults;
    this.baseUrl = defaults.baseUrl || '';
  }

  /**
   * Make an HTTP GET request
   */
  async get(url, options = {}) {
    return this._makeRequest(url, 'GET', options);
  }

  /**
   * Make an HTTP POST request
   */
  async post(url, options = {}) {
    return this._makeRequest(url, 'POST', options);
  }

  /**
   * Make an HTTP PUT request
   */
  async put(url, options = {}) {
    return this._makeRequest(url, 'PUT', options);
  }

  /**
   * Make an HTTP DELETE request
   */
  async delete(url, options = {}) {
    return this._makeRequest(url, 'DELETE', options);
  }

  /**
   * Private method to handle all HTTP requests
   */
  async _makeRequest(url, method, options = {}) {
    const { 
      auth, 
      body, 
      json = true, // Changed default to true since most API calls expect JSON
      qs = {}, 
      simple = true, 
      resolveWithFullResponse = false 
    } = options;

    // Build full URL with query parameters
    const fullUrl = this._buildUrl(url, qs);

    // Set up headers
    const headers = {};
    if (auth?.bearer) {
      headers['Authorization'] = `Bearer ${auth.bearer}`;
    }
    
    // Set JSON headers for all requests when json is true
    if (json) {
      headers['Accept'] = 'application/json';
      
      // Only set Content-Type when sending data
      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        headers['Content-Type'] = 'application/json';
      }
    }
    
    // Build request options
    const fetchOptions = {
      method,
      headers
    };

    // Add request body if needed
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = json ? JSON.stringify(body) : body;
    }

    try {
      // Make the request
      const response = await fetch(fullUrl, fetchOptions);
      
      // Clone the response before consuming it
      // This allows us to use the body in error handling if needed
      const clonedResponse = response.clone();
      
      // Parse response body based on content type - only once
      let responseBody = null;
      if (response.status !== 204) { // No content
        if (json) {
          try {
            responseBody = await response.json();
          } catch (e) {
            // If can't parse JSON, get text
            responseBody = await clonedResponse.text();
          }
        } else {
          responseBody = await response.text();
        }
      }

      // Handle errors if simple mode is enabled
      if (simple && !response.ok) {
        const error = new Error(`Request failed with status code ${response.status}`);
        error.statusCode = response.status;
        error.body = responseBody; // Include the already parsed body
        throw error;
      }

      // Return full response object or just body based on options
      if (resolveWithFullResponse) {
        return {
          statusCode: response.status,
          body: responseBody,
          headers: Object.fromEntries(response.headers.entries())
        };
      }
      
      return responseBody;
    } catch (error) {
      if (!simple) {
        // If simple=false, return error response instead of throwing
        return {
          statusCode: error.statusCode || 500,
          body: error.body || { message: error.message }
        };
      }
      throw error;
    }
  }
  /**
   * Build URL with query parameters
   */
  _buildUrl(url, qs) {
    // Start with base URL
    let fullUrl = this.baseUrl + url;
    
    // Add query parameters
    if (Object.keys(qs).length > 0) {
      const params = new URLSearchParams();
      Object.entries(qs).forEach(([key, value]) => {
        params.append(key, value);
      });
      fullUrl += `?${params.toString()}`;
    }
    
    return fullUrl;
  }
}

/**
 * Create a client with default options
 */
function createClient(defaults = {}) {
  const client = new HttpClient(defaults);
  
  // Return the methods directly for API compatibility
  return {
    get: (url, options) => client.get(url, options),
    post: (url, options) => client.post(url, options),
    put: (url, options) => client.put(url, options),
    delete: (url, options) => client.delete(url, options),
    defaults: client.defaults
  };
}

module.exports = {
  createClient
};