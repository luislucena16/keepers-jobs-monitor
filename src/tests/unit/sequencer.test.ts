import * as ethersModule from 'ethers';
import { SequencerService } from '../../../src/services/sequencer';

jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    Contract: jest.fn(),
  };
});

const MockContract = (ethersModule.Contract as unknown) as jest.Mock;

describe('sequencer module', () => {
  const mockContractMethods = {
    numJobs: jest.fn(),
    jobAt: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockContract.mockImplementation(() => mockContractMethods);
  });

  describe('SequencerService class', () => {
    const rpcUrl = 'https://rpc.fake';
    const sequencerAddress = '0xsequencer';

    let service: SequencerService;

    beforeEach(() => {
      service = new SequencerService(rpcUrl, sequencerAddress);
      // We replaced the internal contract with the mock.
      (service as any).contract = mockContractMethods;
      // Clean cache
      (service as any).jobsCache.clear();
    });

    describe('getNumJobs', () => {
      it('should return the number of jobs', async () => {
        mockContractMethods.numJobs.mockResolvedValue({ toNumber: () => 5 });

        const num = await service.getNumJobs();

        expect(mockContractMethods.numJobs).toHaveBeenCalled();
        expect(num).toBe(5);
      });
    });

    describe('getJobAt', () => {
      it('should return job address at index', async () => {
        mockContractMethods.jobAt.mockResolvedValue('0xjob1');

        const job = await service.getJobAt(0);

        expect(mockContractMethods.jobAt).toHaveBeenCalledWith(0);
        expect(job).toBe('0xjob1');
      });
    });

    describe('getAllJobs', () => {
      it('should fetch all jobs batching in groups of 20 and cache the result', async () => {
        mockContractMethods.numJobs.mockResolvedValue({ toNumber: () => 25 });
        mockContractMethods.jobAt.mockImplementation((index: number) =>
          Promise.resolve(`0xjob${index}`)
        );

        const jobs = await service.getAllJobs();

        expect(mockContractMethods.numJobs).toHaveBeenCalled();
        expect(mockContractMethods.jobAt).toHaveBeenCalledTimes(25);
        expect(jobs).toHaveLength(25);
        expect(jobs[0]).toBe('0xjob0');
        expect(jobs[24]).toBe('0xjob24');

        // We verify that the cache is being used and does not call again.
        mockContractMethods.jobAt.mockClear();

        const jobsCached = await service.getAllJobs();

        expect(jobsCached).toEqual(jobs);
        expect(mockContractMethods.jobAt).not.toHaveBeenCalled();
      });
    });

    describe('getAllJobsOptimized', () => {
      it('should fetch all jobs in parallel and cache the result', async () => {
        mockContractMethods.numJobs.mockResolvedValue({ toNumber: () => 3 });
        mockContractMethods.jobAt
          .mockResolvedValueOnce('0xjob0')
          .mockResolvedValueOnce('0xjob1')
          .mockResolvedValueOnce('0xjob2');

        const jobs = await service.getAllJobsOptimized();

        expect(mockContractMethods.numJobs).toHaveBeenCalled();
        expect(mockContractMethods.jobAt).toHaveBeenCalledTimes(3);
        expect(jobs).toEqual(['0xjob0', '0xjob1', '0xjob2']);

        // Cache hit
        mockContractMethods.jobAt.mockClear();
        const jobsCached = await service.getAllJobsOptimized();
        expect(jobsCached).toEqual(jobs);
        expect(mockContractMethods.jobAt).not.toHaveBeenCalled();
      });

      it('should handle rejected promises gracefully', async () => {
        mockContractMethods.numJobs.mockResolvedValue({ toNumber: () => 3 });
        mockContractMethods.jobAt
          .mockResolvedValueOnce('0xjob0')
          .mockRejectedValueOnce(new Error('fail at 1'))
          .mockResolvedValueOnce('0xjob2');

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const jobs = await service.getAllJobsOptimized();

        expect(jobs).toEqual(['0xjob0', '0xjob2']);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('❌ Failed to get job at index 1:'),
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });
    });
  });
});
