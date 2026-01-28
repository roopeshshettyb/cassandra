class LoggerService {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  getCallerInfo() {
    try {
      const stack = new Error().stack;
      if (!stack) return {};

      const stackLines = stack.split('\n');
      let serviceName;
      let actionName;

      for (let i = 3; i < stackLines.length && i < 15; i++) {
        const line = stackLines[i];

        const classMethodMatch = line.match(/at\s+(?:new\s+)?(\w+Service|\w+Component|\w+Page|\w+Helper|\w+Utils)\.(\w+)\s*\(/);
        if (classMethodMatch && classMethodMatch[1] && classMethodMatch[2]) {
          const className = classMethodMatch[1];
          const methodName = classMethodMatch[2];
          if (!serviceName) serviceName = className;
          if (!actionName && this.isValidMethodName(methodName)) {
            actionName = methodName;
            break;
          }
        }

        const classMatch = line.match(/at\s+(?:new\s+)?(\w+Service|\w+Component|\w+Page|\w+Helper|\w+Utils)\./);
        if (classMatch && classMatch[1] && !serviceName) {
          serviceName = classMatch[1];
        }

        const functionMatch = line.match(/at\s+(?:new\s+)?(?:\w+\.)?(\w+)\s*\(/);
        if (functionMatch && functionMatch[1] && !actionName) {
          const methodName = functionMatch[1];
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

  isValidMethodName(name) {
    const invalidNames = [
      'LoggerService',
      'log',
      'error',
      'warn',
      'getCallerInfo',
      'isValidMethodName',
      'getFormattedMessage',
      'formatTraces',
      'Object',
      'Array',
      'Promise',
      'then',
      'catch',
      'finally',
      'useEffect',
      'useState',
      'useCallback',
      'useMemo',
      'render',
      'constructor',
    ];
    return !invalidNames.includes(name);
  }

  formatTraces(traces) {
    if (!traces || traces.length === 0) return '';
    const traceArray = traces.map((trace) => {
      const key = Object.keys(trace)[0];
      const value = trace[key];
      return `${key}:${value}`;
    });
    return traceArray.join('::');
  }

  getFormattedMessage(message, traces, serviceName, actionName) {
    const traceString = this.formatTraces(traces);
    const tracePart = traceString ? ` [${traceString}]` : '';
    const servicePart = serviceName ? serviceName : 'Unknown';
    const actionPart = actionName ? actionName : 'Unknown';
    return `[${servicePart}:${actionPart}]${tracePart} ${message}`;
  }

  log({ message, traces, serviceName, actionName }) {
    const callerInfo = serviceName || actionName ? { serviceName, actionName } : this.getCallerInfo();
    const formattedMessage = this.getFormattedMessage(message, traces, serviceName || callerInfo.serviceName, actionName || callerInfo.actionName);
    console.log(formattedMessage);
  }

  error({ error, traces, serviceName, actionName, message }) {
    const callerInfo = serviceName || actionName ? { serviceName, actionName } : this.getCallerInfo();
    const errorMessage = error?.error || error?.response || error?.data || error?.response?.error || error?.response?.data || error?.message || message || String(error);
    const formattedMessage = this.getFormattedMessage(errorMessage, traces, serviceName || callerInfo.serviceName, actionName || callerInfo.actionName);
    console.error(formattedMessage, error);
  }

  warn({ message, traces, serviceName, actionName }) {
    const callerInfo = serviceName || actionName ? { serviceName, actionName } : this.getCallerInfo();
    const formattedMessage = this.getFormattedMessage(message, traces, serviceName || callerInfo.serviceName, actionName || callerInfo.actionName);
    console.warn(formattedMessage);
  }
}

const loggerService = new LoggerService();

export default loggerService;
