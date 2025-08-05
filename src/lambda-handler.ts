import { Context, ScheduledEvent } from 'aws-lambda';
import { ethers } from 'ethers';
import { getLastWorkedBlock } from './job-monitor';
import { sendStallAlert, sendErrorAlert } from './discord-service';

// Configs .env
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL!;
const SEQUENCER_ADDRESS = process.env.SEQUENCER_ADDRESS!;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL!;

const provider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC_URL);

// ABI of the sequencer to obtain the jobs
const SEQUENCER_ABI = [
  "function numJobs() view returns (uint256)",
  "function jobAt(uint256) view returns (address)"
];

// Lambda main handler
export const handler = async (event: ScheduledEvent, context: Context) => {
  console.log('🚀 ========================================');
  console.log('🚀 MAKERDAO JOB MONITOR LAMBDA STARTING...');
  console.log('🚀 ========================================');
  console.log('📅 Event:', JSON.stringify(event, null, 2));
  console.log('⚙️ Context:', JSON.stringify(context, null, 2));

  try {
    // Verify environment variables
    if (!ETHEREUM_RPC_URL || !SEQUENCER_ADDRESS || !DISCORD_WEBHOOK_URL) {
      throw new Error('Missing required environment variables');
    }

    console.log('🔧 Environment check:');
    console.log('   - ETHEREUM_RPC_URL: ✅ Configured');
    console.log('   - SEQUENCER_ADDRESS: ✅ Configured');  
    console.log('   - DISCORD_WEBHOOK_URL: ✅ Configured');

    // Connecting to Ethereum
    console.log('🔗 Connecting to Ethereum...');
    const currentBlock = await provider.getBlockNumber();
    console.log(`⛓️  Current block: ${currentBlock}`);

    // Define block range (last 10 blocks)
    const fromBlock = currentBlock - 10;
    const toBlock = currentBlock - 1;
    console.log(`🔍 Checking from block ${fromBlock} to ${toBlock}`);

    // Get list of jobs
    console.log('📊 Getting jobs count...');
    const sequencerContract = new ethers.Contract(SEQUENCER_ADDRESS, SEQUENCER_ABI, provider);
    const numJobs = await sequencerContract.numJobs();
    console.log(`📊 Total jobs found: ${numJobs}`);

    // Check each job in parallel to optimise time
    const stalledJobs: string[] = [];
    const jobPromises: Promise<{address: string, isStalled: boolean}>[] = [];

    for (let i = 0; i < numJobs; i++) {
      const jobAddress = await sequencerContract.jobAt(i);
      
      // Create a promise for each job
      const jobPromise = checkSingleJob(jobAddress, fromBlock, toBlock, i, Number(numJobs) - 1);
      jobPromises.push(jobPromise);
    }

    // Process all jobs in parallel
    console.log('🔄 Processing all jobs in parallel...');
    const results = await Promise.allSettled(jobPromises);

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.isStalled) {
          stalledJobs.push(result.value.address);
        }
      } else {
        console.error(`❌ Job ${index} failed:`, result.reason);
      }
    });

    // Send alert if there are stalled jobs
    console.log(`📊 Summary: ${stalledJobs.length} stalled jobs out of ${numJobs} total jobs`);
    
    if (stalledJobs.length > 0) {
      console.log('🚨 STALLED JOBS DETECTED:');
      stalledJobs.forEach((job, index) => {
        console.log(`   ${index + 1}. ${job}`);
      });
      await sendStallAlert(stalledJobs, Number(numJobs), currentBlock);
    } else {
      console.log('✅ All jobs are working correctly!');
    }

    console.log('🚀 Lambda execution completed successfully!');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Job monitoring completed',
        stalledJobs: stalledJobs.length,
        totalJobs: Number(numJobs),
        currentBlock,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Lambda execution failed:', error);
    
    // Send critical error alert
    await sendErrorAlert(error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Auxiliary function for checking an individual job
async function checkSingleJob(
  jobAddress: string, 
  fromBlock: number, 
  toBlock: number, 
  index: number, 
  total: number
): Promise<{address: string, isStalled: boolean}> {
  console.log(`🔎 Checking job ${index}/${total}...`);
  console.log(`   Job address: ${jobAddress}`);

  try {
    const lastWorkedBlock = await getLastWorkedBlock(jobAddress, fromBlock, toBlock);
    
    if (lastWorkedBlock === null) {
      console.log(`⚠️  Job ${jobAddress} has NOT been worked in last 10 blocks`);
      return { address: jobAddress, isStalled: true };
    } else {
      console.log(`✅ Job ${jobAddress} was last worked at block ${lastWorkedBlock}`);
      return { address: jobAddress, isStalled: false };
    }
  } catch (error) {
    console.error(`❌ Error checking job ${jobAddress}:`, error);
    // In case of error, we assume that it is stalled for greater security
    return { address: jobAddress, isStalled: true };
  }
}