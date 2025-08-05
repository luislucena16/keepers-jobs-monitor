import { ethers } from "ethers";
import { LRUCache } from "lru-cache";

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL!;
const provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);

// ABI and interface of the contract (if you want to decode)
const JOB_ABI = ["function work(bytes32,bytes)"];
const iface = new ethers.utils.Interface(JOB_ABI);

// Correct calculation of the function selector "work(bytes32,bytes)"
const WORK_SELECTOR = ethers.utils.id("work(bytes32,bytes)").slice(0, 10); 
// ethers.utils.id generates keccak256 hash, slice(0,10) takes the first 4 bytes (8 hex + '0x')

// Interfaces
interface JobStatus {
  address: string;
  lastWorkedBlock: number | null;
  isStalled: boolean;
  lastChecked: Date;
}

interface BlockCache {
  blockNumber: number;
  timestamp: number;
  hash: string;
  transactions: ethers.providers.TransactionResponse[];
}

export class JobMonitorService {
  private blockCache: LRUCache<number, BlockCache>;
  private jobStatusCache: LRUCache<string, JobStatus>;

  constructor() {
    this.blockCache = new LRUCache({ max: 50, ttl: 1000 * 60 * 5 }); // 5 min cache for blocks
    this.jobStatusCache = new LRUCache({ max: 1000, ttl: 1000 * 60 * 2 }); // 2 min cache for jobs
  }

  async getCurrentBlock(): Promise<number> {
    return provider.getBlockNumber();
  }

  // Fetch a block with transactions, caching results to reduce RPC calls
  private async getBlockWithTransactions(blockNumber: number): Promise<BlockCache | null> {
    const cached = this.blockCache.get(blockNumber);
    if (cached) return cached;

    try {
      const block = await provider.getBlockWithTransactions(blockNumber);
      if (!block) return null;

      const blockCacheData: BlockCache = {
        blockNumber: block.number,
        timestamp: block.timestamp,
        hash: block.hash,
        transactions: block.transactions,
      };

      this.blockCache.set(blockNumber, blockCacheData);
      return blockCacheData;
    } catch (error) {
      console.error(`Error fetching block ${blockNumber}:`, error);
      return null;
    }
  }

  // Search backwards from toBlock to fromBlock for last work() tx for jobAddress
  public async getLastWorkedBlock(
    jobAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<number | null> {
    // Check cache first
    const cachedStatus = this.jobStatusCache.get(jobAddress);
    if (
      cachedStatus &&
      cachedStatus.lastWorkedBlock !== null &&
      cachedStatus.lastChecked > new Date(Date.now() - 2 * 60 * 1000)
    ) {
      return cachedStatus.lastWorkedBlock;
    }

    for (let blockNumber = toBlock; blockNumber >= fromBlock; blockNumber--) {
      const block = await this.getBlockWithTransactions(blockNumber);
      if (!block) continue;

      for (const tx of block.transactions) {
        if (
          tx.to?.toLowerCase() === jobAddress.toLowerCase() &&
          tx.data.startsWith(WORK_SELECTOR)
        ) {
          // Cache the result
          this.jobStatusCache.set(jobAddress, {
            address: jobAddress,
            lastWorkedBlock: blockNumber,
            isStalled: false,
            lastChecked: new Date(),
          });
          return blockNumber;
        }
      }
    }

    // If none found, cache as stalled
    this.jobStatusCache.set(jobAddress, {
      address: jobAddress,
      lastWorkedBlock: null,
      isStalled: true,
      lastChecked: new Date(),
    });
    return null;
  }

  // Check multiple jobs in parallel
  public async checkJobsEfficiently(
    jobAddresses: string[],
    fromBlock: number,
    toBlock: number
  ): Promise<JobStatus[]> {
    const results = await Promise.all(
      jobAddresses.map(async (address) => {
        const lastWorkedBlock = await this.getLastWorkedBlock(address, fromBlock, toBlock);
        return {
          address,
          lastWorkedBlock,
          isStalled: lastWorkedBlock === null,
          lastChecked: new Date(),
        };
      })
    );
    return results;
  }

  // Clear both caches
  public clearCaches(): void {
    this.blockCache.clear();
    this.jobStatusCache.clear();
    console.log("🧹 Caches cleared");
  }

  // Return cache statistics
  public getCacheStats() {
    return {
      blockCache: { size: this.blockCache.size, max: 50 },
      jobStatusCache: { size: this.jobStatusCache.size, max: 1000 },
    };
  }
}
