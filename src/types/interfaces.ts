// Represents the status of a monitored job
export interface JobStatus {
    address: string;
    lastWorkedBlock: number | null;
    isStalled: boolean;
    lastChecked: Date;
    error?: string;
  }
  
  // Cache for blocks with their transactions and timestamps
  export interface BlockCache {
    block: any; // You can use ethers.Block if you import the type from ethers
    transactions: any[]; // ethers.TransactionResponse[]
    timestamp: number;
  }
  
  // Monitor settings
  export interface MonitorConfig {
    rpcUrl: string;
    blocksToCheck: number;
    batchSize: number;
    cacheConfig: {
      blockCacheSize: number;
      blockCacheTtl: number;
      jobCacheSize: number;
      jobCacheTtl: number;
    };
  }
  