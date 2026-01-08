# Comprehensive Monitoring System

This document describes the comprehensive monitoring system implemented for the CA Marketplace application.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [API Endpoints](#api-endpoints)
5. [Metrics](#metrics)
6. [Health Checks](#health-checks)
7. [Alerting](#alerting)
8. [Logging](#logging)
9. [Configuration](#configuration)
10. [Integration with External Services](#integration-with-external-services)
11. [Dashboard](#dashboard)

## Overview

The monitoring system provides comprehensive observability for the CA Marketplace application, including:

- **Application Logging**: Structured logging with Winston and Morgan
- **Health Checks**: Real-time health monitoring for all critical services
- **Metrics Collection**: Prometheus-compatible metrics for performance tracking
- **Alerting**: Configurable alerts for critical issues
- **Dashboard**: Real-time monitoring dashboard with key metrics

## Features

### 1. Application Logging

#### Winston Logger

Structured logging with multiple log levels:
- **error**: Application errors and exceptions
- **warn**: Warning messages
- **info**: Informational messages
- **http**: HTTP request logs
- **debug**: Detailed debugging information

Features:
- Log rotation with daily rotation
- JSON format in production
- Colored console output in development
- Correlation IDs for request tracking
- Error categorization and context

#### Morgan HTTP Logger

HTTP request logging with custom format:
- Request method, URL, and status code
- Response time and content length
- Correlation ID tracking
- User ID and role (if authenticated)
- Integrated with Winston for consistent logging

### 2. Health Checks

Comprehensive health monitoring for:

#### Database (PostgreSQL)
- Connectivity check
- Query latency
- Connection pool statistics
- Active/idle connections

#### Redis
- Connectivity check
- Ping latency
- Connection count

#### Razorpay (Payment Gateway)
- API accessibility check
- Mode detection (test/live)

#### System Resources
- CPU usage and load average
- Memory usage (total, used, free)
- Disk space usage

#### Overall Health Status
- **healthy**: All services operational
- **degraded**: Some services experiencing issues
- **unhealthy**: Critical services down

### 3. Metrics Collection

Prometheus-compatible metrics in `/metrics` format:

#### HTTP Metrics
- `ca_marketplace_http_requests_total`: Total HTTP requests
- `ca_marketplace_http_request_duration_seconds`: Request duration histogram
- `ca_marketplace_http_request_size_bytes`: Request size histogram
- `ca_marketplace_http_response_size_bytes`: Response size histogram

#### Error Metrics
- `ca_marketplace_errors_total`: Total errors
- `ca_marketplace_errors_by_category`: Errors by category and code

#### Business Metrics
- `ca_marketplace_user_registrations_total`: User registrations by role
- `ca_marketplace_service_requests_total`: Service requests by type and status
- `ca_marketplace_payments_processed_total`: Payments by status
- `ca_marketplace_payment_amount_total`: Total payment amount

#### Database Metrics
- `ca_marketplace_database_connections`: Active/idle connections
- `ca_marketplace_database_query_duration_seconds`: Query duration histogram
- `ca_marketplace_database_errors_total`: Database errors

#### Redis Metrics
- `ca_marketplace_redis_connections`: Connection count
- `ca_marketplace_redis_command_duration_seconds`: Command duration histogram
- `ca_marketplace_redis_errors_total`: Redis errors

#### System Metrics
- `ca_marketplace_cpu_usage_percent`: CPU usage
- `ca_marketplace_memory_usage_bytes`: Memory usage
- `ca_marketplace_active_requests`: Current active requests

### 4. Alerting System

Configurable alerts with thresholds:

#### Error Rate Alerts
- **Warning**: Error rate > 5%
- **Critical**: Error rate > 10%
- Window: 5 minutes (configurable)

#### Response Time Alerts
- **Warning**: Response time > 2000ms
- **Critical**: Response time > 5000ms

#### Database Connection Alerts
- **Warning**: Connection usage > 80%
- **Critical**: Connection usage > 90%

#### System Resource Alerts
- **CPU Warning**: CPU usage > 80%
- **CPU Critical**: CPU usage > 90%
- **Memory Warning**: Memory usage > 85%
- **Memory Critical**: Memory usage > 95%
- **Disk Warning**: Disk usage > 85%
- **Disk Critical**: Disk usage > 95%

Alert features:
- Active alert tracking
- Alert history
- Automatic alert resolution
- Integration-ready for external services (Sentry, Slack, email)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Express Middleware                       │
├─────────────────────────────────────────────────────────────┤
│  Correlation ID → HTTP Logger → Metrics Tracker             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Services                       │
├──────────────────┬──────────────────┬──────────────────────┤
│  Logger Service  │  Metrics Service │  Alert Service       │
│  (Winston)       │  (Prometheus)    │  (Thresholds)        │
└──────────────────┴──────────────────┴──────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Health Checks                            │
├──────────────────┬──────────────────┬──────────────────────┤
│  Database        │  Redis           │  External APIs       │
│  System          │  Disk            │                      │
└──────────────────┴──────────────────┴──────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Dashboard                      │
│  Real-time metrics, alerts, and health status               │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

All monitoring endpoints are under `/api/monitoring`:

### Health Endpoints

#### GET `/api/monitoring/health`
Comprehensive health check for all services.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-08T10:30:00.000Z",
    "uptime": 3600.5,
    "checks": {
      "database": {
        "status": "up",
        "latency": 5,
        "details": {
          "activeConnections": 2,
          "idleConnections": 3,
          "totalConnections": 5
        }
      },
      "redis": {
        "status": "up",
        "latency": 2,
        "details": {
          "connections": 1
        }
      },
      "razorpay": {
        "status": "up",
        "details": {
          "mode": "test"
        }
      },
      "system": {
        "status": "healthy",
        "cpu": {
          "usage": 25.5,
          "loadAverage": [1.2, 1.5, 1.8],
          "cores": 4
        },
        "memory": {
          "total": 8589934592,
          "free": 4294967296,
          "used": 4294967296,
          "usagePercent": 50.0
        }
      },
      "disk": {
        "status": "healthy",
        "usage": {
          "total": 500000000000,
          "free": 250000000000,
          "used": 250000000000,
          "usagePercent": 50.0
        }
      }
    }
  }
}
```

#### GET `/api/monitoring/health/quick`
Quick health check (lightweight).

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "message": "All critical services operational"
  }
}
```

### Metrics Endpoints

#### GET `/api/monitoring/metrics`
Prometheus-format metrics.

**Response:** Plain text Prometheus format
```
# HELP ca_marketplace_http_requests_total Total number of HTTP requests
# TYPE ca_marketplace_http_requests_total counter
ca_marketplace_http_requests_total{method="GET",route="/api/users",status_code="200"} 1234

# HELP ca_marketplace_http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE ca_marketplace_http_request_duration_seconds histogram
ca_marketplace_http_request_duration_seconds_bucket{method="GET",route="/api/users",status_code="200",le="0.05"} 1000
...
```

#### GET `/api/monitoring/metrics/json`
Metrics in JSON format.

**Response:**
```json
{
  "success": true,
  "data": {
    "ca_marketplace_http_requests_total": {
      "help": "Total number of HTTP requests",
      "type": "counter",
      "values": [...]
    },
    ...
  }
}
```

### Alert Endpoints

#### GET `/api/monitoring/alerts`
Get active alerts and statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "active": [
      {
        "id": "error_rate_warning",
        "severity": "warning",
        "category": "error_rate",
        "message": "High error rate: 6.5% (threshold: 5%)",
        "details": {
          "errorRate": 6.5,
          "errorCount": 13,
          "totalRequests": 200
        },
        "timestamp": "2024-01-08T10:30:00.000Z",
        "resolved": false
      }
    ],
    "stats": {
      "totalRequests": 1500,
      "totalErrors": 30,
      "errorRate": 2.0,
      "averageResponseTime": 150.5,
      "databaseFailures": 0,
      "paymentFailures": 0
    }
  }
}
```

#### GET `/api/monitoring/alerts/history`
Get alert history.

**Query Parameters:**
- `limit` (optional): Number of alerts to return (default: 50)

#### GET `/api/monitoring/alerts/thresholds`
Get current alert thresholds.

**Response:**
```json
{
  "success": true,
  "data": {
    "errorRate": {
      "warningPercent": 5,
      "criticalPercent": 10,
      "windowMinutes": 5
    },
    "responseTime": {
      "warningMs": 2000,
      "criticalMs": 5000
    },
    "database": {
      "connectionWarningPercent": 80,
      "connectionCriticalPercent": 90,
      "queryTimeoutMs": 30000
    },
    "system": {
      "cpuWarningPercent": 80,
      "cpuCriticalPercent": 90,
      "memoryWarningPercent": 85,
      "memoryCriticalPercent": 95,
      "diskWarningPercent": 85,
      "diskCriticalPercent": 95
    }
  }
}
```

#### PUT `/api/monitoring/alerts/thresholds`
Update alert thresholds.

**Request Body:**
```json
{
  "errorRate": {
    "warningPercent": 8,
    "criticalPercent": 15
  }
}
```

### Dashboard Endpoint

#### GET `/api/monitoring/dashboard`
Comprehensive monitoring dashboard with all key metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-08T10:30:00.000Z",
    "uptime": 3600.5,
    "status": "healthy",
    "services": {
      "database": {
        "status": "up",
        "latency": 5,
        "connections": {
          "active": 2,
          "idle": 3,
          "total": 5,
          "max": 10,
          "utilizationPercent": 20.0
        }
      },
      "redis": { ... },
      "razorpay": { ... }
    },
    "system": {
      "status": "healthy",
      "cpu": { ... },
      "memory": { ... },
      "disk": { ... }
    },
    "requests": {
      "total": 1500,
      "errors": 30,
      "errorRate": 2.0,
      "averageResponseTime": 150.5
    },
    "business": {
      "users": {
        "total": 1000,
        "clients": 800,
        "charteredAccountants": 200,
        "recentRegistrations": 50
      },
      "serviceRequests": {
        "total": 500,
        "pending": 50,
        "completed": 400,
        "completionRate": 80.0,
        "recentRequests": 25
      },
      "payments": {
        "total": 300,
        "totalRevenue": 500000,
        "averagePayment": 1666.67,
        "recentPayments": 15
      }
    },
    "alerts": {
      "active": 1,
      "critical": 0,
      "warnings": 1,
      "list": [...]
    },
    "healthScore": 95
  }
}
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Monitoring & Logging
LOG_LEVEL=info                    # Log level: error, warn, info, http, debug
ENABLE_METRICS=true               # Enable metrics collection
ENABLE_ALERTING=true              # Enable alerting system

# External Services (Optional)
SENTRY_DSN=                       # Sentry DSN for error tracking
LOGGLY_TOKEN=                     # Loggly token for log aggregation
LOGGLY_SUBDOMAIN=                 # Loggly subdomain
```

### Log Levels

- **production**: `info` or higher
- **development**: `debug` (all logs)
- **test**: `error` only

### Alert Threshold Customization

Update thresholds via API:

```bash
curl -X PUT http://localhost:5000/api/monitoring/alerts/thresholds \
  -H "Content-Type: application/json" \
  -d '{
    "errorRate": {
      "warningPercent": 8,
      "criticalPercent": 15,
      "windowMinutes": 10
    },
    "responseTime": {
      "warningMs": 3000,
      "criticalMs": 10000
    }
  }'
```

## Integration with External Services

### Prometheus & Grafana

1. Configure Prometheus to scrape metrics:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ca-marketplace'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/api/monitoring/metrics'
    scrape_interval: 15s
```

2. Import Grafana dashboard with pre-configured panels for all metrics

### Sentry (Error Tracking)

```bash
# Add to .env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

The logger will automatically send errors to Sentry when configured.

### Loggly (Log Aggregation)

```bash
# Add to .env
LOGGLY_TOKEN=your-loggly-token
LOGGLY_SUBDOMAIN=your-subdomain
```

### Alert Notifications

Extend `AlertService.triggerAlert()` to integrate with:
- **Email**: SendGrid, AWS SES
- **Slack**: Slack Webhooks
- **PagerDuty**: For on-call alerts
- **SMS**: Twilio

Example integration:
```typescript
// In alert.service.ts
private static async sendAlertNotification(alert: Alert): Promise<void> {
  // Send email
  await emailService.send({
    to: 'ops@company.com',
    subject: `[${alert.severity.toUpperCase()}] ${alert.message}`,
    body: JSON.stringify(alert.details, null, 2)
  });

  // Send Slack message
  if (alert.severity === 'critical') {
    await slackService.postMessage({
      channel: '#alerts',
      text: alert.message,
      attachments: [{ text: JSON.stringify(alert.details, null, 2) }]
    });
  }
}
```

## Dashboard

The monitoring dashboard (`/api/monitoring/dashboard`) provides:

1. **Overall Health**: System-wide health status and score (0-100)
2. **Service Status**: Real-time status of all services
3. **Request Metrics**: Request count, error rate, response times
4. **Business Metrics**: User registrations, service requests, payments
5. **Active Alerts**: List of current alerts with severity
6. **System Resources**: CPU, memory, and disk usage

### Health Score Calculation

The health score (0-100) is calculated based on:
- Overall system status (healthy/degraded/unhealthy)
- Individual service health
- System resource usage
- Error rates
- Active alerts

## Best Practices

### 1. Regular Monitoring

- Check dashboard at least once daily
- Review alert history weekly
- Analyze metrics trends monthly

### 2. Alert Response

- **Critical alerts**: Respond within 15 minutes
- **Warning alerts**: Respond within 1 hour
- Document resolutions in alert history

### 3. Log Management

- Logs are rotated daily in production
- Kept for 14 days by default
- Archive important logs for compliance

### 4. Metrics Analysis

- Monitor error rates and trends
- Track response time percentiles
- Review business metrics for growth patterns
- Identify slow database queries

### 5. Capacity Planning

- Monitor connection pool usage
- Track memory and CPU trends
- Plan scaling based on metrics

## Troubleshooting

### High Error Rate

1. Check active alerts for details
2. Review error logs with correlation IDs
3. Check database and Redis health
4. Verify external API status (Razorpay)

### Slow Response Times

1. Check database query performance
2. Review cache hit rates
3. Check system resource usage
4. Analyze slow query logs

### Database Connection Issues

1. Check connection pool statistics
2. Review active/idle connection ratio
3. Verify database server health
4. Check for connection leaks

### Memory Issues

1. Monitor heap usage trends
2. Check for memory leaks
3. Review garbage collection logs
4. Consider increasing heap size

## API Testing

Test the monitoring system:

```bash
# Health check
curl http://localhost:5000/api/monitoring/health

# Quick health check
curl http://localhost:5000/api/monitoring/health/quick

# Metrics (Prometheus format)
curl http://localhost:5000/api/monitoring/metrics

# Dashboard
curl http://localhost:5000/api/monitoring/dashboard

# Active alerts
curl http://localhost:5000/api/monitoring/alerts

# Alert history
curl http://localhost:5000/api/monitoring/alerts/history?limit=20
```

## Future Enhancements

1. **Distributed Tracing**: OpenTelemetry integration
2. **APM Integration**: New Relic, DataDog
3. **Custom Dashboards**: Build custom visualization dashboards
4. **Anomaly Detection**: ML-based anomaly detection
5. **Predictive Alerting**: Alert before issues occur
6. **Mobile App**: Mobile monitoring app

## Support

For issues or questions about the monitoring system:
- Check logs in `logs/` directory
- Review active alerts in dashboard
- Contact DevOps team
