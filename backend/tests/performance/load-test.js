/**
 * K6 Load Test - Simulate Normal Load
 *
 * Tests system under expected load conditions
 * 100 concurrent users over 5 minutes
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const apiCallDuration = new Trend('api_call_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '4m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    errors: ['rate<0.05'], // Less than 5% error rate
    login_duration: ['p(95)<1000'], // Login should be fast
    api_call_duration: ['p(95)<300'], // API calls should be fast
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const users = [
  { email: 'client1@test.com', password: 'Client@123', role: 'CLIENT' },
  { email: 'ca1@test.com', password: 'CA@123', role: 'CA' },
  { email: 'admin@test.com', password: 'Admin@123', role: 'ADMIN' },
];

/**
 * Setup: Run once before the test
 */
export function setup() {
  console.log('Starting load test...');
  return { startTime: new Date().toISOString() };
}

/**
 * Main test scenario
 */
export default function (data) {
  // Pick a random user
  const user = users[Math.floor(Math.random() * users.length)];

  // 1. Login
  const loginStart = Date.now();
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' },
  });

  loginDuration.add(Date.now() - loginStart);

  const loginSuccess = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => r.json('token') !== undefined,
  });

  if (!loginSuccess) {
    errorRate.add(1);
    return;
  }

  const token = loginRes.json('token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  sleep(1);

  // 2. Get user profile
  const profileStart = Date.now();
  const profileRes = http.get(`${BASE_URL}/api/auth/me`, {
    headers,
    tags: { name: 'profile' },
  });

  apiCallDuration.add(Date.now() - profileStart);

  check(profileRes, {
    'profile status is 200': (r) => r.status === 200,
    'profile has email': (r) => r.json('email') === user.email,
  }) || errorRate.add(1);

  sleep(1);

  // 3. Role-specific actions
  if (user.role === 'CLIENT') {
    // Get service requests
    const requestsStart = Date.now();
    const requestsRes = http.get(`${BASE_URL}/api/service-requests`, {
      headers,
      tags: { name: 'service_requests_list' },
    });

    apiCallDuration.add(Date.now() - requestsStart);

    check(requestsRes, {
      'service requests status is 200': (r) => r.status === 200,
      'service requests has data': (r) => r.json('data') !== undefined,
    }) || errorRate.add(1);

    sleep(1);

    // Browse CAs
    const casStart = Date.now();
    const casRes = http.get(`${BASE_URL}/api/cas?page=1&limit=10`, {
      headers,
      tags: { name: 'browse_cas' },
    });

    apiCallDuration.add(Date.now() - casStart);

    check(casRes, {
      'CAs status is 200': (r) => r.status === 200,
      'CAs has data': (r) => r.json('data') !== undefined,
    }) || errorRate.add(1);

  } else if (user.role === 'CA') {
    // Get CA dashboard stats
    const statsStart = Date.now();
    const statsRes = http.get(`${BASE_URL}/api/ca/stats`, {
      headers,
      tags: { name: 'ca_stats' },
    });

    apiCallDuration.add(Date.now() - statsStart);

    check(statsRes, {
      'CA stats status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);

    // Get assigned requests
    const assignedStart = Date.now();
    const assignedRes = http.get(`${BASE_URL}/api/service-requests?status=ACCEPTED`, {
      headers,
      tags: { name: 'assigned_requests' },
    });

    apiCallDuration.add(Date.now() - assignedStart);

    check(assignedRes, {
      'assigned requests status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

  } else if (user.role === 'ADMIN') {
    // Get platform stats
    const platformStatsStart = Date.now();
    const platformStatsRes = http.get(`${BASE_URL}/api/admin/stats`, {
      headers,
      tags: { name: 'platform_stats' },
    });

    apiCallDuration.add(Date.now() - platformStatsStart);

    check(platformStatsRes, {
      'platform stats status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(1);

    // Get all users
    const usersStart = Date.now();
    const usersRes = http.get(`${BASE_URL}/api/admin/users?page=1&limit=20`, {
      headers,
      tags: { name: 'admin_users_list' },
    });

    apiCallDuration.add(Date.now() - usersStart);

    check(usersRes, {
      'users list status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }

  sleep(2);

  // 4. Logout
  const logoutRes = http.post(`${BASE_URL}/api/auth/logout`, null, {
    headers,
    tags: { name: 'logout' },
  });

  check(logoutRes, {
    'logout successful': (r) => r.status === 200 || r.status === 204,
  }) || errorRate.add(1);

  sleep(1);
}

/**
 * Teardown: Run once after the test
 */
export function teardown(data) {
  console.log('Load test completed.');
  console.log(`Started at: ${data.startTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
}
