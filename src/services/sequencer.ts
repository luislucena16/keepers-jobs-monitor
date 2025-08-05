import { ethers } from 'ethers';
import { LRUCache } from 'lru-cache';

// Original functions for backward compatibility
const sequencerAbi = [
  "function numJobs() view returns (uint256)",
  "function jobAt(uint256) view returns (address)"
];

export async function numJobs(provider: ethers.providers.Provider, sequencerAddress: string): Promise<number> {
  const contract = new ethers.Contract(sequencerAddress, sequencerAbi, provider);
  const jobsBN = await contract.numJobs();
  return jobsBN.toNumber(); // convert BigNumber to number JS
}

export async function jobAt(
  provider: ethers.providers.Provider,
  sequencerAddress: string,
  index: number
): Promise<string> {
  const contract = new ethers.Contract(sequencerAddress, sequencerAbi, provider);
  return contract.jobAt(index);
}

// New optimized class for future use
export class SequencerService {
  private provider: ethers.providers.JsonRpcProvider;
  private contract: ethers.Contract;
  private jobsCache: LRUCache<string, string[]>;

  constructor(rpcUrl: string, sequencerAddress: string) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(
      sequencerAddress,
      sequencerAbi,
      this.provider
    );
    this.jobsCache = new LRUCache({ max: 10, ttl: 1000 * 60 * 10 }); // 10 min cache
  }

  async getNumJobs(): Promise<number> {
    const jobsBN = await this.contract.numJobs();
    return jobsBN.toNumber();
  }

  async getJobAt(index: number): Promise<string> {
    return this.contract.jobAt(index);
  }

  async getAllJobs(): Promise<string[]> {
    const cacheKey = 'all-jobs';
    const cached = this.jobsCache.get(cacheKey);
    if (cached) {
      console.log('💾 Using cached jobs list');
      return cached;
    }

    const numJobs = await this.contract.numJobs();
    const jobCount = numJobs.toNumber();
    
    // Batch the jobAt calls for efficiency
    const batchSize = 20;
    const allJobs: string[] = [];
    
    for (let i = 0; i < jobCount; i += batchSize) {
      const batch = [];
      const end = Math.min(i + batchSize, jobCount);
      
      for (let j = i; j < end; j++) {
        batch.push(this.contract.jobAt(j));
      }
      
      const batchResults = await Promise.all(batch);
      allJobs.push(...batchResults);
    }
    
    this.jobsCache.set(cacheKey, allJobs);
    return allJobs;
  }

  // Helper method to get all jobs with parallel processing
  async getAllJobsOptimized(): Promise<string[]> {
    const cacheKey = 'all-jobs-optimized';
    const cached = this.jobsCache.get(cacheKey);
    if (cached) {
      console.log('💾 Using cached jobs list (optimized)');
      return cached;
    }

    const numJobs = await this.getNumJobs();
    console.log(`📊 Total jobs to fetch: ${numJobs}`);
    
    if (numJobs === 0) {
      return [];
    }

    // Create array of promises for parallel execution
    const jobPromises: Promise<string>[] = [];
    for (let i = 0; i < numJobs; i++) {
      jobPromises.push(this.getJobAt(i));
    }

    // Execute all promises in parallel with error handling
    const results = await Promise.allSettled(jobPromises);
    const allJobs: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allJobs.push(result.value);
      } else {
        console.error(`❌ Failed to get job at index ${index}:`, result.reason);
      }
    });

    this.jobsCache.set(cacheKey, allJobs);
    console.log(`✅ Successfully fetched ${allJobs.length}/${numJobs} jobs`);
    
    return allJobs;
  }
}