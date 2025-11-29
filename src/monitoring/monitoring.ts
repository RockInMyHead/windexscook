/**
 * Comprehensive monitoring system for AI Chef application
 * Integrates with multiple monitoring services and provides application metrics
 */

import { performance, PerformanceObserver } from 'perf_hooks';

export interface MonitoringConfig {
  enabled: boolean;
  sentry?: {
    dsn: string;
    environment: string;
    release?: string;
  };
  datadog?: {
    apiKey: string;
    appKey: string;
    service: string;
    env: string;
  };
  newRelic?: {
    licenseKey: string;
    appName: string;
  };
  prometheus?: {
    pushGateway: string;
    jobName: string;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class MonitoringService {
  private static instance: MonitoringService;
  private config: MonitoringConfig;
  private performanceObserver: PerformanceObserver;
  private metrics: Map<string, any> = new Map();

  private constructor(config: MonitoringConfig) {
    this.config = config;
    this.setupPerformanceMonitoring();
    this.setupErrorTracking();
    this.setupMetricsCollection();
  }

  static getInstance(config?: MonitoringConfig): MonitoringService {
    if (!MonitoringService.instance) {
      const defaultConfig: MonitoringConfig = {
        enabled: process.env.NODE_ENV === 'production',
        logLevel: (process.env.LOG_LEVEL as any) || 'info',
        sentry: process.env.SENTRY_DSN ? {
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV || 'development'
        } : undefined,
        datadog: process.env.DD_API_KEY ? {
          apiKey: process.env.DD_API_KEY,
          appKey: process.env.DD_APP_KEY || '',
          service: 'ai-chef',
          env: process.env.NODE_ENV || 'development'
        } : undefined,
        newRelic: process.env.NEW_RELIC_LICENSE_KEY ? {
          licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
          appName: 'AI Chef'
        } : undefined,
        prometheus: process.env.PROMETHEUS_PUSH_GATEWAY ? {
          pushGateway: process.env.PROMETHEUS_PUSH_GATEWAY,
          jobName: 'ai-chef'
        } : undefined
      };

      MonitoringService.instance = new MonitoringService(config || defaultConfig);
    }
    return MonitoringService.instance;
  }

  private setupPerformanceMonitoring() {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.recordMetric(`performance.${entry.name}`, entry.duration, {
          type: entry.entryType,
          startTime: entry.startTime
        });

        // Send to monitoring services
        this.sendToMonitoringServices('performance', {
          name: entry.name,
          duration: entry.duration,
          type: entry.entryType
        });
      });
    });

    this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
  }

  private setupErrorTracking() {
    if (this.config.sentry) {
      // Dynamic import to avoid bundling Sentry in development
      import('@sentry/node').then((Sentry) => {
        Sentry.init({
          dsn: this.config.sentry!.dsn,
          environment: this.config.sentry!.environment,
          release: this.config.sentry!.release,
          integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Console(),
            new Sentry.Integrations.OnUncaughtException(),
            new Sentry.Integrations.OnUnhandledRejection()
          ],
          tracesSampleRate: 0.1
        });
      }).catch(err => {
        console.warn('Failed to initialize Sentry:', err);
      });
    }

    // Global error handler
    process.on('uncaughtException', (error) => {
      this.captureError(error, { type: 'uncaughtException' });
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.captureError(reason as Error, { type: 'unhandledRejection', promise });
    });
  }

  private setupMetricsCollection() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Collect application metrics every 10 seconds
    setInterval(() => {
      this.collectApplicationMetrics();
    }, 10000);
  }

  private collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.recordMetric('system.memory.heapUsed', memUsage.heapUsed);
    this.recordMetric('system.memory.heapTotal', memUsage.heapTotal);
    this.recordMetric('system.memory.external', memUsage.external);
    this.recordMetric('system.cpu.user', cpuUsage.user);
    this.recordMetric('system.cpu.system', cpuUsage.system);

    // Send to monitoring services
    this.sendToMonitoringServices('system', {
      memory: memUsage,
      cpu: cpuUsage,
      uptime: process.uptime()
    });
  }

  private collectApplicationMetrics() {
    // Application-specific metrics
    const eventLoopLag = this.measureEventLoopLag();
    this.recordMetric('application.eventLoopLag', eventLoopLag);

    // Database connection pool metrics (if available)
    // Cache hit rates
    // API response times
    // Error rates

    this.sendToMonitoringServices('application', {
      eventLoopLag,
      activeConnections: this.getActiveConnections(),
      timestamp: Date.now()
    });
  }

  private measureEventLoopLag(): number {
    const start = process.hrtime.bigint();
    return new Promise<number>((resolve) => {
      setImmediate(() => {
        const end = process.hrtime.bigint();
        resolve(Number(end - start) / 1000000); // Convert to milliseconds
      });
    });
  }

  private getActiveConnections(): number {
    // This would be implemented based on your server setup
    // For Express, you might track active connections
    return 0; // Placeholder
  }

  // Public API methods

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any) {
    if (this.shouldLog(level)) {
      const logEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        meta
      };

      console[level](JSON.stringify(logEntry));

      this.sendToMonitoringServices('log', logEntry);
    }
  }

  recordMetric(name: string, value: number, tags?: Record<string, any>) {
    const metric = {
      name,
      value,
      timestamp: Date.now(),
      tags: tags || {}
    };

    this.metrics.set(name, metric);
    this.sendToMonitoringServices('metric', metric);
  }

  incrementCounter(name: string, value: number = 1, tags?: Record<string, any>) {
    const currentValue = this.metrics.get(`${name}_counter`) || 0;
    this.recordMetric(`${name}_counter`, currentValue + value, tags);
  }

  captureError(error: Error, context?: any) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString()
    };

    this.log('error', `Error captured: ${error.message}`, errorData);
    this.sendToMonitoringServices('error', errorData);
  }

  startTransaction(name: string, op: string): Transaction {
    return new Transaction(name, op, this);
  }

  // Integration methods

  private sendToMonitoringServices(type: string, data: any) {
    if (!this.config.enabled) return;

    // DataDog integration
    if (this.config.datadog) {
      this.sendToDataDog(type, data);
    }

    // New Relic integration
    if (this.config.newRelic) {
      this.sendToNewRelic(type, data);
    }

    // Prometheus integration
    if (this.config.prometheus) {
      this.sendToPrometheus(type, data);
    }
  }

  private async sendToDataDog(type: string, data: any) {
    if (!this.config.datadog) return;

    try {
      const tags = `service:${this.config.datadog.service},env:${this.config.datadog.env}`;

      let metricName: string;
      let metricValue: number;

      switch (type) {
        case 'metric':
          metricName = data.name;
          metricValue = data.value;
          break;
        case 'performance':
          metricName = `performance.${data.name}`;
          metricValue = data.duration;
          break;
        case 'error':
          metricName = 'errors.count';
          metricValue = 1;
          break;
        default:
          return;
      }

      const response = await fetch(`https://api.datadoghq.com/api/v1/series`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.config.datadog.apiKey
        },
        body: JSON.stringify({
          series: [{
            metric: metricName,
            points: [[Math.floor(Date.now() / 1000), metricValue]],
            tags: [tags]
          }]
        })
      });

      if (!response.ok) {
        console.warn('Failed to send metric to DataDog:', response.statusText);
      }
    } catch (error) {
      console.warn('DataDog integration error:', error);
    }
  }

  private sendToNewRelic(type: string, data: any) {
    if (!this.config.newRelic || typeof window !== 'undefined') return;

    try {
      // New Relic browser agent is automatically configured
      // Server-side metrics would be sent via New Relic agent
      if (type === 'error' && window.newrelic) {
        window.newrelic.noticeError(data);
      }
    } catch (error) {
      console.warn('New Relic integration error:', error);
    }
  }

  private async sendToPrometheus(type: string, data: any) {
    if (!this.config.prometheus) return;

    try {
      let prometheusData = '';

      switch (type) {
        case 'metric':
          prometheusData = `# HELP ${data.name} ${data.name}\n# TYPE ${data.name} gauge\n${data.name} ${data.value}\n`;
          break;
        case 'performance':
          const perfName = `performance_${data.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          prometheusData = `# HELP ${perfName} Performance metric\n# TYPE ${perfName} gauge\n${perfName} ${data.duration}\n`;
          break;
        default:
          return;
      }

      const response = await fetch(`${this.config.prometheus.pushGateway}/metrics/job/${this.config.prometheus.jobName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: prometheusData
      });

      if (!response.ok) {
        console.warn('Failed to send metric to Prometheus:', response.statusText);
      }
    } catch (error) {
      console.warn('Prometheus integration error:', error);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  // Cleanup
  destroy() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    MonitoringService.instance = null as any;
  }
}

export class Transaction {
  private name: string;
  private op: string;
  private startTime: number;
  private monitoring: MonitoringService;

  constructor(name: string, op: string, monitoring: MonitoringService) {
    this.name = name;
    this.op = op;
    this.startTime = performance.now();
    this.monitoring = monitoring;
  }

  finish() {
    const duration = performance.now() - this.startTime;
    performance.measure(this.name, { start: this.startTime, end: performance.now() });

    this.monitoring.recordMetric(`transaction.${this.name}`, duration, {
      operation: this.op
    });
  }

  setTag(key: string, value: any) {
    // Store tags for when transaction finishes
    this.monitoring.recordMetric(`transaction.${this.name}.tag.${key}`, typeof value === 'number' ? value : 1, {
      value: String(value)
    });
  }
}

// Global error boundary for React components
export const withMonitoring = (Component: React.ComponentType<any>) => {
  return (props: any) => {
    const monitoring = MonitoringService.getInstance();

    React.useEffect(() => {
      const transaction = monitoring.startTransaction('component_render', Component.name);

      return () => {
        transaction.finish();
      };
    }, []);

    try {
      return <Component {...props} />;
    } catch (error) {
      monitoring.captureError(error as Error, {
        component: Component.name,
        props
      });
      throw error;
    }
  };
};

// Performance monitoring hook for React
export const usePerformanceMonitoring = (componentName: string) => {
  const monitoring = MonitoringService.getInstance();

  React.useEffect(() => {
    const transaction = monitoring.startTransaction(`${componentName}_mount`, 'component_lifecycle');

    return () => {
      transaction.finish();
    };
  }, [componentName]);

  return {
    log: (message: string, meta?: any) => monitoring.log('info', message, { component: componentName, ...meta }),
    error: (error: Error, context?: any) => monitoring.captureError(error, { component: componentName, ...context }),
    metric: (name: string, value: number) => monitoring.recordMetric(`component.${componentName}.${name}`, value)
  };
};

// Export singleton instance
export const monitoring = MonitoringService.getInstance();
