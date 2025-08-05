export interface Config {
    ETHEREUM_RPC_URL: string;
    SEQUENCER_ADDRESS: string;
    DISCORD_WEBHOOK_URL: string;
    BLOCKS_TO_CHECK: number;
    BATCH_SIZE: number;
    CACHE_TTL_MINUTES: number;
  }
  
  export function loadConfig(): Config {
    const required = ['ETHEREUM_RPC_URL', 'SEQUENCER_ADDRESS', 'DISCORD_WEBHOOK_URL'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  
    // Validate Ethereum address format
    const sequencerAddress = process.env.SEQUENCER_ADDRESS!;
    if (!/^0x[a-fA-F0-9]{40}$/.test(sequencerAddress)) {
      throw new Error('SEQUENCER_ADDRESS must be a valid Ethereum address');
    }
  
    return {
      ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL!,
      SEQUENCER_ADDRESS: sequencerAddress,
      DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL!,
      BLOCKS_TO_CHECK: parseInt(process.env.BLOCKS_TO_CHECK || '10'),
      BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '10'),
      CACHE_TTL_MINUTES: parseInt(process.env.CACHE_TTL_MINUTES || '5'),
    };
  }