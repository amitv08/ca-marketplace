/**
 * K6 API Performance Test - Test Specific API Endpoints
 *
 * Focused testing of critical API endpoints
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Custom metrics per endpoint
const authLoginTime = new Trend('auth_login_duration');
const caListTime = new Trend('ca_list_duration');
const serviceRequestTime = new Trend('service_request_duration');
const searchTime = new Trend('search_duration');
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'auth_login_duration': ['p(95)<800'],
    'ca_list_duration': ['p(95)<300'],
    'service_request_duration': ['p(95)<500'],
    'search_duration': ['p(95)<400'],
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_USER = {
  email: 'client1@test.com',
  password: 'ClientTestPass@68!',
};

let authToken = '';

export function setup() {
  // Get auth token for authenticated requests
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(TEST_USER), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 200) {
    authToken = res.json('token');
  }

  return { token: authToken };
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Authentication
  group('Authentication Endpoints', () => {
    const start = Date.now();
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(TEST_USER), {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth_login' },
    });

    authLoginTime.add(Date.now() - start);

    check(loginRes, {
      'login successful': (r) => r.status === 200,
      'has token': (r) => r.json('token') !== undefined,
      'login < 800ms': (r) => r.timings.duration < 800,
    }) || errorRate.add(1);

    sleep(1);
  });

  // Test 2: CA Listing
  group('CA Listing', () => {
    const start = Date.now();
    const listRes = http.get(`${BASE_URL}/api/cas?page=1&limit=20`, {
      headers,
      tags: { endpoint: 'ca_list' },
    });

    caListTime.add(Date.now() - start);

    check(listRes, {
      'list successful': (r) => r.status === 200,
      'has pagination': (r) => r.json('pagination') !== undefined,
      'list < 300ms': (r) => r.timings.duration < 300,
    }) || errorRate.add(1);

    sleep(1);
  });

  // Test 3: CA Search
  group('CA Search', () => {
    const searchTerms = ['tax', 'audit', 'gst', 'accounting'];
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const start = Date.now();
    const searchRes = http.get(`${BASE_URL}/api/cas/search?q=${term}`, {
      headers,
      tags: { endpoint: 'ca_search' },
    });

    searchTime.add(Date.now() - start);

    check(searchRes, {
      'search successful': (r) => r.status === 200,
      'has results': (r) => r.json('data') !== undefined,
      'search < 400ms': (r) => r.timings.duration < 400,
    }) || errorRate.add(1);

    sleep(1);
  });

  // Test 4: Service Requests
  group('Service Requests', () => {
    const start = Date.now();
    const requestsRes = http.get(`${BASE_URL}/api/service-requests?page=1&limit=10`, {
      headers,
      tags: { endpoint: 'service_requests' },
    });

    serviceRequestTime.add(Date.now() - start);

    check(requestsRes, {
      'requests successful': (r) => r.status === 200,
      'has data': (r) => r.json('data') !== undefined,
      'requests < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    sleep(1);
  });

  // Test 5: CA Details
  group('CA Details', () => {
    // First get list to get CA IDs
    const listRes = http.get(`${BASE_URL}/api/cas?page=1&limit=1`, {
      headers,
    });

    if (listRes.status === 200 && listRes.json('data.0.id')) {
      const caId = listRes.json('data.0.id');

      const detailsRes = http.get(`${BASE_URL}/api/cas/${caId}`, {
        headers,
        tags: { endpoint: 'ca_details' },
      });

      check(detailsRes, {
        'details successful': (r) => r.status === 200,
        'has CA data': (r) => r.json('id') === caId,
        'details < 200ms': (r) => r.timings.duration < 200,
      }) || errorRate.add(1);
    }

    sleep(1);
  });

  // Test 6: Filters and Pagination
  group('Filtering and Pagination', () => {
    const filters = [
      '?experienceYears=5',
      '?hourlyRate=1000,2000',
      '?specialization=Tax',
      '?verificationStatus=VERIFIED',
    ];

    const filter = filters[Math.floor(Math.random() * filters.length)];

    const filterRes = http.get(`${BASE_URL}/api/cas${filter}`, {
      headers,
      tags: { endpoint: 'ca_filter' },
    });

    check(filterRes, {
      'filter successful': (r) => r.status === 200,
      'filter < 400ms': (r) => r.timings.duration < 400,
    }) || errorRate.add(1);

    sleep(1);
  });

  // Test 7: Batch Operations
  group('Batch Operations', () => {
    const batchPayload = [
      { id: '1', resource: 'ca', operation: 'list', params: { limit: 5 } },
      { id: '2', resource: 'serviceRequest', operation: 'list', params: { limit: 5 } },
    ];

    const batchRes = http.post(`${BASE_URL}/api/batch`, JSON.stringify(batchPayload), {
      headers,
      tags: { endpoint: 'batch' },
    });

    check(batchRes, {
      'batch successful': (r) => r.status === 200,
      'batch < 600ms': (r) => r.timings.duration < 600,
    }) || errorRate.add(1);

    sleep(1);
  });

  sleep(2);
}

export function handleSummary(data) {
  console.log('\n=== API Performance Test Results ===\n');

  const metrics = {
    'Auth Login': data.metrics.auth_login_duration,
    'CA List': data.metrics.ca_list_duration,
    'Service Requests': data.metrics.service_request_duration,
    'Search': data.metrics.search_duration,
  };

  for (const [name, metric] of Object.entries(metrics)) {
    if (metric && metric.values) {
      console.log(`${name}:`);
      console.log(`  Avg: ${metric.values.avg.toFixed(2)}ms`);
      console.log(`  P95: ${metric.values['p(95)'].toFixed(2)}ms`);
      console.log(`  P99: ${metric.values['p(99)'].toFixed(2)}ms`);
      console.log('');
    }
  }

  return {
    'api-performance-results.json': JSON.stringify(data, null, 2),
    'api-performance-summary.txt': generateTextSummary(data),
  };
}

function generateTextSummary(data) {
  let summary = '=== API Performance Test Summary ===\n\n';

  if (data.metrics.http_req_duration) {
    summary += `Overall Response Time:\n`;
    summary += `  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `  P95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `  P99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  }

  if (data.metrics.errors) {
    summary += `Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n`;
  }

  return summary;
}
