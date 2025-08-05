import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);

// Minimal ABI to get the selector of the `work(bytes32,bytes)` function
const JOB_ABI = ["function work(bytes32,bytes)"];
const iface = new ethers.utils.Interface(JOB_ABI);
const WORK_SELECTOR = iface.getSighash("work"); // e.g. 0x1d2ab000

export async function getLastWorkedBlock(
  jobAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<number | null> {
  console.log(`      🔍 Searching for work() calls to ${jobAddress} in blocks ${fromBlock}-${toBlock}`);
  
  try {
    // Optimized method: search for transactions directly
    return await getLastWorkedBlockByTransactions(jobAddress, fromBlock, toBlock);
  } catch (error) {
    console.error(`      ❌ Error in optimized search for ${jobAddress}:`, error);
    
    // Fallback to original method but with timeouts and limits
    console.log(`      🔄 Falling back to block-by-block search (slower)...`);
    return await getLastWorkedBlockFallback(jobAddress, fromBlock, toBlock);
  }
}

// Optimized method that searches for transactions directly
async function getLastWorkedBlockByTransactions(
  jobAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<number | null> {
  // Limit the range to avoid timeouts in public RPCs
  const maxBlocks = 10;
  const actualToBlock = Math.min(toBlock, fromBlock + maxBlocks - 1);
  
  console.log(`      📡 Scanning ${actualToBlock - fromBlock + 1} blocks for transactions...`);
  
  // Search from the most recent block backwards
  for (let blockNumber = actualToBlock; blockNumber >= fromBlock; blockNumber--) {
    try {
      console.log(`      🔎 Checking block ${blockNumber}...`);
      
      // Timeout of 8 seconds per block
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Block fetch timeout')), 8000)
      );

      const blockPromise = provider.getBlockWithTransactions(blockNumber);
      const block = await Promise.race([blockPromise, timeoutPromise]) as any;

      // Check all transactions in the block
      for (const tx of block.transactions) {
        if (
          tx.to?.toLowerCase() === jobAddress.toLowerCase() &&
          tx.data.startsWith(WORK_SELECTOR)
        ) {
          console.log(`      ✅ Found work() transaction ${tx.hash} in block ${blockNumber}`);
          return blockNumber;
        }
      }
    } catch (err) {
      console.error(`      ❌ Error checking block ${blockNumber}:`, err instanceof Error ? err.message : String(err));
      // Continue with the next block
      continue;
    }
  }

  console.log(`      ❌ No work() calls found in blocks ${fromBlock}-${actualToBlock}`);
  return null;
}

// Improved fallback method with timeouts and limits
async function getLastWorkedBlockFallback(
  jobAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<number | null> {
  let lastWorkedBlock: number | null = null;
  const maxBlocksToCheck = 5; // Limit to avoid timeouts
  const blocksToCheck = Math.min(maxBlocksToCheck, toBlock - fromBlock + 1);
  
  console.log(`      ⚠️  Checking only last ${blocksToCheck} blocks to avoid timeout`);

  for (let i = 0; i < blocksToCheck; i++) {
    const blockNumber = toBlock - i;
    
    try {
      console.log(`      🔎 Checking block ${blockNumber}...`);
      
      // Timeout of 10 seconds per block
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Block fetch timeout')), 10000)
      );

      const blockPromise = provider.getBlockWithTransactions(blockNumber);
      const block = await Promise.race([blockPromise, timeoutPromise]) as any;

      for (const tx of block.transactions) {
        if (
          tx.to?.toLowerCase() === jobAddress.toLowerCase() &&
          tx.data.startsWith(WORK_SELECTOR)
        ) {
          console.log(`      ✅ Found work() transaction in block ${blockNumber}`);
          return blockNumber;
        }
      }
    } catch (err) {
      console.error(`      ❌ Error checking block ${blockNumber}:`, err instanceof Error ? err.message : String(err));
      // Continue with the next block
      continue;
    }
  }

  return lastWorkedBlock;
}