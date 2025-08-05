export class JobMonitorError extends Error {
    constructor(
      message: string,
      public jobAddress?: string,
      public blockNumber?: number,
      public originalError?: Error
    ) {
      super(message);
      this.name = 'JobMonitorError';
  
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, JobMonitorError);
      }
    }
  }
  
  export class RpcError extends Error {
    constructor(
      message: string,
      public statusCode?: number,
      public rpcUrl?: string
    ) {
      super(message);
      this.name = 'RpcError';
  
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, RpcError);
      }
    }
  }
  
  export class DiscordError extends Error {
    constructor(
      message: string,
      public statusCode?: number,
      public webhookUrl?: string
    ) {
      super(message);
      this.name = 'DiscordError';
  
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, DiscordError);
      }
    }
  }
  
  export class ConfigurationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConfigurationError';
  
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, ConfigurationError);
      }
    }
  }
  