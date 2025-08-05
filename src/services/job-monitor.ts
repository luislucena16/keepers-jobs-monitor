import { ethers } from 'ethers';

const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL!;
const provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);

// ABI for detecting calls work()
const JOB_ABI = ["function work(bytes32,bytes)"];
const iface = new ethers.utils.Interface(JOB_ABI);

// Most direct method for obtaining the selector
const WORK_SELECTOR = "0x" + ethers.utils.keccak256(ethers.utils.toUtf8Bytes("work(bytes32,bytes)")).slice(2, 10);


// Search for the last work() call for a specific job in a range of blocks
export async function getLastWorkedBlock(
  jobAddress: string,
  fromBlock: number,
  toBlock: number
): Promise<number | null> {
  console.log(`      🔍 Searching for work() calls to ${jobAddress} in blocks ${fromBlock}-${toBlock}`);
  
  try {
    // Search for transactions in the latest blocks (starting with the most recent)
    for (let blockNumber = toBlock; blockNumber >= fromBlock; blockNumber--) {
      try {
        const block = await provider.getBlockWithTransactions(blockNumber);
        
        if (!block || !block.transactions) {
          continue;
        }

        // Verify each transaction in the block
        for (const tx of block.transactions) {
          if (
            tx.to?.toLowerCase() === jobAddress.toLowerCase() &&
            tx.data.startsWith(WORK_SELECTOR)
          ) {
            console.log(`      ✅ Found work() transaction ${tx.hash} in block ${blockNumber}`);
            return blockNumber;
          }
        }
      } catch (blockError) {
        console.error(`      ⚠️  Error checking block ${blockNumber}:`, blockError);
        continue;
      }
    }
    
    console.log(`      ❌ No work() calls found in blocks ${fromBlock}-${toBlock}`);
    return null;
    
  } catch (error) {
    console.error(`      ❌ Error in getLastWorkedBlock for ${jobAddress}:`, error);
    return null;
  }
}


// Obtains detailed information about a job (can be expanded as needed)
export async function getJobInfo(jobAddress: string): Promise<{
  address: string;
  isValid: boolean;
  lastChecked: Date;
}> {
  try {
    // Verify that the address is valid
    const code = await provider.getCode(jobAddress);
    const isValid = code !== '0x';
    
    return {
      address: jobAddress,
      isValid,
      lastChecked: new Date()
    };
  } catch (error) {
    console.error(`Error getting job info for ${jobAddress}:`, error);
    return {
      address: jobAddress,
      isValid: false,
      lastChecked: new Date()
    };
  }
}

// Check multiple jobs in parallel
export async function checkMultipleJobs(
  jobAddresses: string[],
  fromBlock: number,
  toBlock: number
): Promise<Array<{address: string, lastWorkedBlock: number | null, isStalled: boolean}>> {
  console.log(`🔄 Checking ${jobAddresses.length} jobs in parallel...`);
  
  const promises = jobAddresses.map(async (address, index) => {
    console.log(`   Processing job ${index + 1}/${jobAddresses.length}: ${address}`);
    
    const lastWorkedBlock = await getLastWorkedBlock(address, fromBlock, toBlock);
    const isStalled = lastWorkedBlock === null;
    
    return {
      address,
      lastWorkedBlock,
      isStalled
    };
  });
  
  const results = await Promise.allSettled(promises);
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`❌ Failed to check job ${jobAddresses[index]}:`, result.reason);
      return {
        address: jobAddresses[index],
        lastWorkedBlock: null,
        isStalled: true // Assume stalled in case of error
      };
    }
  });
}