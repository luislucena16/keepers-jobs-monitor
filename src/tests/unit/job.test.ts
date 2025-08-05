import { JobMonitorService } from '../../../src/services/job-monitor';

describe('JobMonitorService', () => {
  let service: JobMonitorService;

  beforeEach(() => {
    service = new JobMonitorService();
  });

  describe('getCurrentBlock', () => {
    it('should increment and return the current block number', async () => {
      const block1 = await service.getCurrentBlock();
      const block2 = await service.getCurrentBlock();
      expect(block2).toBeGreaterThan(block1);
    });
  });

  describe('checkJobsEfficiently', () => {
    it('should return an array of JobStatus objects with correct addresses', async () => {
      const jobs = ['0x1', '0x2', '0x3'];
      const fromBlock = 10;
      const toBlock = 20;

      const statuses = await service.checkJobsEfficiently(jobs, fromBlock, toBlock);

      expect(statuses).toHaveLength(jobs.length);

      statuses.forEach((status, i) => {
        expect(status.address).toBe(jobs[i]);
        expect(typeof status.isStalled).toBe('boolean');
        expect(status.lastChecked).toBeInstanceOf(Date);
        if (!status.isStalled) {
          expect(status.lastWorkedBlock).toBeGreaterThanOrEqual(fromBlock);
          expect(status.lastWorkedBlock).toBeLessThanOrEqual(toBlock);
        } else {
          expect(status.lastWorkedBlock).toBeNull();
        }
      });
    });
  });

  describe('checkSingleJobOptimized', () => {
    it('should cache and return the same result for repeated calls with same parameters', async () => {
      // We use any to access the private method.
      const jobAddress = '0xabc';
      const fromBlock = 100;
      const toBlock = 200;

      const firstCall = await (service as any).checkSingleJobOptimized(jobAddress, fromBlock, toBlock);
      const secondCall = await (service as any).checkSingleJobOptimized(jobAddress, fromBlock, toBlock);

      expect(secondCall).toEqual(firstCall);
    });
  });

  describe('clearCaches', () => {
    it('should clear both caches', () => {
      // We insert data into the cache for testing purposes
      (service as any).jobStatusCache.set('key', { address: '0x1', lastWorkedBlock: 10, isStalled: false, lastChecked: new Date() });
      (service as any).blockCache.set(1, { blockNumber: 1, timestamp: Date.now(), hash: '0xhash', transactions: [] });

      expect((service as any).jobStatusCache.size).toBe(1);
      expect((service as any).blockCache.size).toBe(1);

      service.clearCaches();

      expect((service as any).jobStatusCache.size).toBe(0);
      expect((service as any).blockCache.size).toBe(0);
    });
  });
});
