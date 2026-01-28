import { Injectable, Logger } from '@nestjs/common';

export interface Trace {
  [key: string]: string | number | boolean | null | undefined;
}

export interface LoggerOptions {
  message: string;
  traces?: Trace[];
  serviceName?: string;
  actionName?: string;
}

export interface ErrorLoggerOptions {
  error: any;
  traces?: Trace[];
  serviceName?: string;
  actionName?: string;
}

@Injectable()
export class LoggerService {
  private readonly logger = new Logger();

  private getCallerInfo(): { serviceName?: string; actionName?: string } {
    try {
      const stack = new Error().stack;
      if (!stack) return {};

      const stackLines = stack.split('\n');
      let serviceName: string | undefined;
      let actionName: string | undefined;

      for (let i = 3; i < stackLines.length && i < 15; i++) {
        const line = stackLines[i];

        const classMethodMatch = line.match(/at\s+(?:new\s+)?(\w+Service|\w+Gateway|\w+Controller|\w+Guard|\w+Module)\.(\w+)\s*\(/);
        if (classMethodMatch && classMethodMatch[1] && classMethodMatch[2]) {
          const className = classMethodMatch[1];
          const methodName = classMethodMatch[2];
          if (!serviceName) serviceName = className;
          if (!actionName && this.isValidMethodName(methodName)) {
            actionName = methodName;
            break;
          }
        }

        const classMatch = line.match(/at\s+(?:new\s+)?(\w+Service|\w+Gateway|\w+Controller|\w+Guard|\w+Module)\./);
        if (classMatch && classMatch[1] && !serviceName) {
          serviceName = classMatch[1];
        }

        const methodMatch = line.match(/at\s+(?:new\s+)?(?:\w+\.)?(\w+)\s*\(/);
        if (methodMatch && methodMatch[1] && !actionName) {
          const methodName = methodMatch[1];
          if (this.isValidMethodName(methodName)) {
            actionName = methodName;
            if (serviceName) break;
          }
        }
      }

      return { serviceName, actionName };
    } catch (e) {
      return {};
    }
  }

  private isValidMethodName(name: string): boolean {
    const invalidNames = [
      'LoggerService',
      'log',
      'error',
      'warn',
      'getCallerInfo',
      'formatMessage',
      'formatTraces',
      'getFormattedMessage',
      'isValidMethodName',
      'constructor',
      'Object',
      'Promise',
      'async',
    ];
    return !invalidNames.includes(name) && !name.startsWith('_') && name.length > 0;
  }

  private formatTraces(traces?: Trace[]): string {
    if (!traces || traces.length === 0) return '';

    const traceParts: string[] = [];
    for (const trace of traces) {
      for (const [key, value] of Object.entries(trace)) {
        if (value !== null && value !== undefined) {
          traceParts.push(`${key}:${value}`);
        }
      }
    }

    return traceParts.length > 0 ? ` [${traceParts.join('::')}]` : '';
  }

  private formatMessage(message: any, traces?: Trace[], serviceName?: string, actionName?: string): string {
    if (typeof message === 'object') message = JSON.stringify(message);

    const parts: string[] = [];
    if (serviceName) parts.push(serviceName);
    if (actionName) parts.push(actionName);

    const serviceActionPart = parts.length > 0 ? `[${parts.join(':')}]` : '';
    const tracesPart = this.formatTraces(traces);

    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    return `${yellow}${serviceActionPart}${tracesPart}${reset} ${message}`;
  }

  private getFormattedMessage(message: string, traces?: Trace[], serviceName?: string, actionName?: string): string {
    let finalMessage = this.formatMessage(message, traces, serviceName, actionName);
    const MAX_LOG_LENGTH = 500;
    if (finalMessage.length > MAX_LOG_LENGTH) {
      finalMessage = `${finalMessage.slice(0, MAX_LOG_LENGTH)}...`;
    }
    return finalMessage;
  }

  log(options: LoggerOptions): void {
    const { message, traces, serviceName, actionName } = options;
    const callerInfo = serviceName || actionName ? { serviceName, actionName } : this.getCallerInfo();
    this.logger.log(this.getFormattedMessage(message, traces, serviceName || callerInfo.serviceName, actionName || callerInfo.actionName));
  }

  error(options: ErrorLoggerOptions): void {
    const { error, traces, serviceName, actionName } = options;
    const errorMessage = error?.error || error?.response || error?.data || error?.response?.error || error?.response?.data || error?.message || String(error);
    const callerInfo = serviceName || actionName ? { serviceName, actionName } : this.getCallerInfo();
    this.logger.error(this.getFormattedMessage(errorMessage, traces, serviceName || callerInfo.serviceName, actionName || callerInfo.actionName));
  }

  warn(options: LoggerOptions): void {
    const { message, traces, serviceName, actionName } = options;
    const callerInfo = serviceName || actionName ? { serviceName, actionName } : this.getCallerInfo();
    this.logger.warn(this.getFormattedMessage(message, traces, serviceName || callerInfo.serviceName, actionName || callerInfo.actionName));
  }
}
