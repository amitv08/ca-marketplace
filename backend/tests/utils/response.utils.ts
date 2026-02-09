/**
 * Response Utilities for Test Assertions
 *
 * Helpers to extract error messages from API responses
 * that may have different structures
 */

/**
 * Extract error message from API response
 * Handles various response structures from the API
 */
export function getErrorMessage(response: any): string {
  // Check if message is directly a string
  if (typeof response.body.message === 'string') {
    return response.body.message;
  }

  // Check for nested error.message (most common structure)
  if (response.body.error?.message) {
    return response.body.error.message;
  }

  // Check for data.error
  if (response.body.data?.error) {
    return typeof response.body.data.error === 'string'
      ? response.body.data.error
      : response.body.data.error.message;
  }

  // Check for error as string
  if (typeof response.body.error === 'string') {
    return response.body.error;
  }

  // Fallback to JSON string for pattern matching
  return JSON.stringify(response.body);
}

/**
 * Assert that response contains an error message matching pattern
 */
export function expectErrorMessage(response: any, pattern: RegExp): void {
  const message = getErrorMessage(response);
  expect(message).toMatch(pattern);
}

/**
 * Check if response indicates success
 */
export function isSuccessResponse(response: any): boolean {
  return response.status >= 200 && response.status < 300;
}

/**
 * Check if response indicates error
 */
export function isErrorResponse(response: any): boolean {
  return response.status >= 400;
}

/**
 * Get response data, handling various structures
 */
export function getResponseData(response: any): any {
  if (response.body.data) {
    return response.body.data;
  }

  // If there's a success field and it's true, return the whole body minus metadata
  if (response.body.success === true) {
    const { success, ...data } = response.body;
    return data;
  }

  return response.body;
}
