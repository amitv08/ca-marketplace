/**
 * K6 Stress Test - Push System to Limits
 *
 * Gradually increase load to find breaking point
 * Ramps up to 500 users
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const requests = new Counter('requests');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100
    { duration: '5m', target: 200 },  // Ramp up to 200
    { duration: '5m', target: 300 },  // Ramp up to 300
    { duration: '5m', target: 400 },  // Ramp up to 400
    { duration: '5m', target: 500 },  // Ramp up to 500
    { duration: '5m', target: 500 },  // Stay at 500
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // More lenient for stress test
    http_req_failed: ['rate<0.1'], // Allow 10% failure
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const endpoints = [
    '/api/cas',
    '/api/service-requests',
    '/api/public/stats',
  ];

  // Test random endpoint
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(`${BASE_URL}${endpoint}`, {
    tags: { name: endpoint },
  });

  requests.add(1);

  const success = check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  if (!success) {
    errorRate.add(1);
  }

  sleep(0.5);
}

export function handleSummary(data) {
  console.log('Stress Test Summary:');
  console.log(`Total Requests: ${data.metrics.requests.values.count}`);
  console.log(`Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`);
  console.log(`Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);

  return {
    'stress-test-results.json': JSON.stringify(data),
  };
}
