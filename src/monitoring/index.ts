// Monitoring exports
export { MonitoringService, monitoring, withMonitoring, usePerformanceMonitoring } from './monitoring';

// Initialize monitoring in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Client-side initialization
  import('./monitoring').then(({ monitoring }) => {
    // Monitor page load performance
    window.addEventListener('load', () => {
      monitoring.recordMetric('page.load_time', performance.now());
    });

    // Monitor user interactions
    let interactionCount = 0;
    document.addEventListener('click', () => {
      interactionCount++;
      if (interactionCount % 10 === 0) { // Every 10 interactions
        monitoring.recordMetric('user.interactions', interactionCount);
      }
    });

    // Monitor errors
    window.addEventListener('error', (event) => {
      monitoring.captureError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Monitor unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      monitoring.captureError(new Error(event.reason), {
        type: 'unhandledrejection'
      });
    });
  });
}
