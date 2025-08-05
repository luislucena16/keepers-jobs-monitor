import { Context, ScheduledEvent } from 'aws-lambda';
import { JobMonitorService } from '../services/job-monitor';
import { SequencerService } from '../services/sequencer';
import { DiscordService } from '../services/discord';
import { loadConfig } from '../config';
import { JobMonitorError, RpcError, DiscordError } from '../types/errors';

export const handler = async (event: ScheduledEvent, context: Context) => {
  const startTime = Date.now();
  
  console.log('🚀 MakerDAO Job Monitor Lambda Starting...');
  console.log(`📅 Event ID: ${event.id}`);
  console.log(`⚙️ Request ID: ${context.awsRequestId}`);

  try {
    // Load and validate configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded successfully');

    // Initialize services
    const jobMonitor = new JobMonitorService();
    const sequencer = new SequencerService(config.ETHEREUM_RPC_URL, config.SEQUENCER_ADDRESS);
    const discord = new DiscordService(config.DISCORD_WEBHOOK_URL);

    // Get current block info
    const currentBlock = await jobMonitor.getCurrentBlock();
    const fromBlock = currentBlock - config.BLOCKS_TO_CHECK;
    
    console.log(`⛓️ Current block: ${currentBlock}, checking from: ${fromBlock}`);

    // Get all jobs efficiently
    const allJobs = await sequencer.getAllJobs();
    console.log(`📊 Found ${allJobs.length} jobs to monitor`);

    // Check jobs in parallel with batching
    const jobStatuses = await jobMonitor.checkJobsEfficiently(
      allJobs, fromBlock, currentBlock
    );

    // Analyze results
    const stalledJobs = jobStatuses.filter(job => job.isStalled);
    const healthyJobs = jobStatuses.filter(job => !job.isStalled);

    console.log(`📊 Results: ${stalledJobs.length} stalled, ${healthyJobs.length} healthy`);

    // Send appropriate alert
    if (stalledJobs.length > 0) {
      await discord.sendStalledJobsAlert(stalledJobs, allJobs.length, currentBlock);
    } else {
      await discord.sendHealthyStatusUpdate(allJobs.length, currentBlock);
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ Lambda completed successfully in ${executionTime}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        executionTimeMs: executionTime,
        summary: {
          totalJobs: allJobs.length,
          stalledJobs: stalledJobs.length,
          healthyJobs: healthyJobs.length,
          currentBlock,
          checkedBlocks: `${fromBlock}-${currentBlock}`
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Lambda execution failed:', error);

    // Structured error handling
    let errorDetails = {
      type: 'Unknown',
      message: 'An unexpected error occurred',
      statusCode: 500
    };

    if (error instanceof JobMonitorError) {
      errorDetails = {
        type: 'JobMonitor',
        message: error.message,
        statusCode: 500
      };
    } else if (error instanceof RpcError) {
      errorDetails = {
        type: 'RPC',
        message: error.message,
        statusCode: 502
      };
    } else if (error instanceof DiscordError) {
      errorDetails = {
        type: 'Discord',
        message: error.message,
        statusCode: 503
      };
    }

    // Try to send error alert (best effort)
    try {
      const config = loadConfig();
      const discord = new DiscordService(config.DISCORD_WEBHOOK_URL);
      await discord.sendSystemErrorAlert(error, context.awsRequestId);
    } catch (alertError) {
      console.error('❌ Failed to send error alert:', alertError);
    }

    return {
      statusCode: errorDetails.statusCode,
      body: JSON.stringify({
        success: false,
        error: errorDetails,
        executionTimeMs: executionTime,
        requestId: context.awsRequestId,
        timestamp: new Date().toISOString()
      })
    };
  }
};