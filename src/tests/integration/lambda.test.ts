import { handler } from '../../handlers/lambda-handler';
import { ScheduledEvent, Context } from 'aws-lambda';

// --- Mock of services ---

const mockJobMonitorService = {
  getCurrentBlock: jest.fn(),
  checkJobsEfficiently: jest.fn()
};

const mockSequencerService = {
  getAllJobs: jest.fn()
};

const mockDiscordService = {
  sendStalledJobsAlert: jest.fn(),
  sendHealthyStatusUpdate: jest.fn(),
  sendSystemErrorAlert: jest.fn()
};

// Mock of services
jest.mock('../../services/job-monitor', () => ({
  JobMonitorService: jest.fn().mockImplementation(() => mockJobMonitorService),
}));

jest.mock('../../services/sequencer', () => ({
  SequencerService: jest.fn().mockImplementation(() => mockSequencerService),
}));

jest.mock('../../services/discord', () => ({
  DiscordService: jest.fn().mockImplementation(() => mockDiscordService),
}));

// Mock de ethers
jest.mock('ethers', () => {
  const mockProvider = {
    getBlockNumber: jest.fn().mockResolvedValue(123456),
    getLogs: jest.fn().mockResolvedValue([]),
    getBlockWithTransactions: jest.fn().mockResolvedValue({
      transactions: [],
      number: 123456,
      timestamp: Date.now() / 1000
    }),
    getNetwork: jest.fn().mockResolvedValue({ name: 'homestead', chainId: 1 }),
  };

  return {
    providers: {
      JsonRpcProvider: jest.fn().mockImplementation(() => mockProvider),
    },
    Contract: jest.fn().mockImplementation(() => ({
      queryFilter: jest.fn().mockResolvedValue([]),
    })),
  };
});

// --- Event y context mocks ---

const mockEvent: ScheduledEvent = {
  id: 'test-event',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: '2024-01-01T00:00:00Z',
  region: 'us-east-1',
  detail: {},
  version: '0',
  resources: []
};

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: '2024/01/01/test',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn()
};

// --- Tests ---

describe('Lambda Handler Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.ETHEREUM_RPC_URL = 'http://test-rpc';
    process.env.SEQUENCER_ADDRESS = '0x1234567890123456789012345678901234567890';
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';

    mockJobMonitorService.getCurrentBlock.mockResolvedValue(123456);

    mockSequencerService.getAllJobs.mockResolvedValue([
      { id: 1, status: 'active' },
      { id: 2, status: 'active' }
    ]);

    mockDiscordService.sendStalledJobsAlert.mockResolvedValue(true);
    mockDiscordService.sendHealthyStatusUpdate.mockResolvedValue(true);
    mockDiscordService.sendSystemErrorAlert.mockResolvedValue(true);
  });

  it('✅ should handle successful execution with healthy jobs', async () => {
    mockJobMonitorService.checkJobsEfficiently.mockResolvedValue([
      { id: 1, isStalled: false },
      { id: 2, isStalled: false }
    ]);

    const result = await handler(mockEvent, mockContext);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.summary).toHaveProperty('totalJobs', 2);
    expect(body.summary).toHaveProperty('stalledJobs', 0);
    expect(body.summary).toHaveProperty('healthyJobs', 2);
    expect(mockDiscordService.sendHealthyStatusUpdate).toHaveBeenCalledWith(2, 123456);
  });

  it('⚠️ should send alert when there are stalled jobs', async () => {
    mockJobMonitorService.checkJobsEfficiently.mockResolvedValue([
      { id: 1, isStalled: true },
      { id: 2, isStalled: false }
    ]);

    const result = await handler(mockEvent, mockContext);
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.summary.stalledJobs).toBe(1);
    expect(mockDiscordService.sendStalledJobsAlert).toHaveBeenCalledWith(
      [{ id: 1, isStalled: true }],
      2,
      123456
    );
  });

  it('❌ should handle JobMonitorService errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  
    mockJobMonitorService.getCurrentBlock.mockRejectedValue(new Error('RPC failure'));
  
    const result = await handler(mockEvent, mockContext);
    const body = JSON.parse(result.body);
  
    expect(result.statusCode).toBe(500);
    expect(body.success).toBe(false);
    expect(mockDiscordService.sendSystemErrorAlert).toHaveBeenCalled();
  
    consoleErrorSpy.mockRestore();
  });
  
});
