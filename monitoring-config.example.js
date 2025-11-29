/**
 * Monitoring Configuration Example
 * Copy this to your environment and configure the services you want to use
 */

module.exports = {
  // Enable/disable monitoring
  enabled: process.env.NODE_ENV === 'production',

  // Log level
  logLevel: process.env.LOG_LEVEL || 'info',

  // Sentry Configuration (Error Tracking)
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RELEASE_VERSION,
    // Additional Sentry options
    tracesSampleRate: 0.1,
    integrations: []
  },

  // DataDog Configuration (Metrics & APM)
  datadog: {
    apiKey: process.env.DD_API_KEY,
    appKey: process.env.DD_APP_KEY,
    service: process.env.DD_SERVICE || 'ai-chef',
    env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
    // Additional DataDog options
    version: process.env.RELEASE_VERSION,
    tags: ['service:ai-chef', 'team:ai']
  },

  // New Relic Configuration (Application Performance)
  newRelic: {
    licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
    appName: process.env.NEW_RELIC_APP_NAME || 'AI Chef',
    // Additional New Relic options
    distributedTracing: true,
    logging: {
      level: 'info'
    }
  },

  // Prometheus Configuration (Metrics)
  prometheus: {
    pushGateway: process.env.PROMETHEUS_PUSH_GATEWAY,
    jobName: process.env.PROMETHEUS_JOB_NAME || 'ai-chef',
    // Additional Prometheus options
    pushInterval: 15000, // 15 seconds
    labels: {
      environment: process.env.NODE_ENV || 'development'
    }
  },

  // Custom metrics configuration
  customMetrics: {
    // API metrics
    api: {
      responseTimeThreshold: 500, // ms
      errorRateThreshold: 0.05, // 5%
    },

    // Voice interaction metrics
    voice: {
      processingTimeThreshold: 2000, // ms
      accuracyThreshold: 0.8, // 80%
    },

    // Payment metrics
    payment: {
      successRateThreshold: 0.95, // 95%
      processingTimeThreshold: 30000, // 30 seconds
    },

    // Performance metrics
    performance: {
      memoryUsageThreshold: 512 * 1024 * 1024, // 512MB
      cpuUsageThreshold: 80, // 80%
      eventLoopLagThreshold: 100 // ms
    }
  },

  // Alerting configuration
  alerts: {
    // Slack webhook for notifications
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channels: {
        errors: '#errors',
        performance: '#performance',
        deployments: '#deployments'
      }
    },

    // Email alerts
    email: {
      enabled: true,
      recipients: ['admin@cook.windexs.ru'],
      thresholds: {
        errorRate: 0.1, // 10% error rate
        responseTime: 2000, // 2 seconds average response time
        downtime: 300 // 5 minutes downtime
      }
    }
  }
};
