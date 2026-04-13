/**
 * Utility for logging errors without duplicates.
 * Prevents flooding the console with the same error message repeatedly.
 */

class ErrorLogger {
  private seenErrors: Map<string, number> = new Map();
  private readonly COOLDOWN_MS = 5000; // 5 seconds cooldown for the same error

  /**
   * Logs an error if it hasn't been logged recently.
   * @param message The error message or object
   * @param context Optional context (e.g., operation type, path)
   */
  log(message: any, context?: any) {
    const errorKey = this.getErrorKey(message, context);
    const now = Date.now();
    const lastSeen = this.seenErrors.get(errorKey);

    if (!lastSeen || now - lastSeen > this.COOLDOWN_MS) {
      this.seenErrors.set(errorKey, now);
      
      const timestamp = new Date().toISOString();
      console.group(`[ErrorLogger] ${timestamp}`);
      console.error('Message:', message);
      if (context) console.error('Context:', context);
      console.groupEnd();
      
      // Cleanup old entries occasionally
      this.cleanup();
    }
  }

  private getErrorKey(message: any, context?: any): string {
    const msgStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const ctxStr = context ? JSON.stringify(context) : '';
    return `${msgStr}|${ctxStr}`;
  }

  private cleanup() {
    const now = Date.now();
    if (this.seenErrors.size > 100) {
      for (const [key, timestamp] of this.seenErrors.entries()) {
        if (now - timestamp > this.COOLDOWN_MS * 2) {
          this.seenErrors.delete(key);
        }
      }
    }
  }
}

export const logger = new ErrorLogger();
