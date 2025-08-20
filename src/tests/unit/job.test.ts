import { ethers } from "ethers";
import { JobMonitorService } from "../../../src/services/job-monitor";

describe("JobMonitorService", () => {
  let jobMonitor: JobMonitorService;
  let mockProvider: jest.Mocked<ethers.providers.JsonRpcProvider>;

  beforeEach(() => {
    mockProvider = {
      getBlockNumber: jest.fn(),
      getBlockWithTransactions: jest.fn(),
    } as any;

    jobMonitor = new JobMonitorService(mockProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return null and mark stalled if no work() tx found", async () => {
    const jobAddress = "0x000111111231";
    const fromBlock = 10;
    const toBlock = 12;

    mockProvider.getBlockWithTransactions.mockImplementation(
      async (blockTag: ethers.providers.BlockTag | Promise<ethers.providers.BlockTag>) => {
        const resolvedBlockTag = await blockTag;
        const blockNumber =
          typeof resolvedBlockTag === "number"
            ? resolvedBlockTag
            : parseInt(resolvedBlockTag) || 0;

        return {
          // @ts-ignore
          number: blockNumber,
          hash: "0xblockhash",
          parentHash: "0xparenthash",
          nonce: 0,
          difficulty: 1,
          _difficulty: 1,
          extraData: "0x",
          gasLimit: ethers.BigNumber.from("10000000"),
          gasUsed: ethers.BigNumber.from("5000000"),
          miner: "0x0000000000000000000000000000000000000000",
          timestamp: 123456,
          transactions: [{
            from: "0x123",
            to: jobAddress,
            hash: "0xtxhash",
            data: "0x12345678", 
            value: ethers.BigNumber.from("0"),
            nonce: 1,
            gasLimit: ethers.BigNumber.from("21000"),
            gasPrice: ethers.BigNumber.from("1000000000"),
            chainId: 1,
            confirmations: 1,
            wait: jest.fn(),
          },
        ],
       } as any;
      }
    );

    const lastWorkedBlock = await jobMonitor.getLastWorkedBlock(jobAddress, fromBlock, toBlock);

    expect(lastWorkedBlock).toBeNull();

    const cached = (jobMonitor as any).jobStatusCache.get(jobAddress);
    expect(cached?.isStalled).toBe(true);
  });

  describe("getCurrentBlock", () => {
    it("should return current block number from provider", async () => {
      mockProvider.getBlockNumber.mockResolvedValueOnce(100).mockResolvedValueOnce(101);

      const block1 = await jobMonitor.getCurrentBlock();
      const block2 = await jobMonitor.getCurrentBlock();

      expect(block1).toBe(100);
      expect(block2).toBe(101);
      expect(block2).toBeGreaterThan(block1);
    });
  });

  describe("getLastWorkedBlock (positive path)", () => {
    it("should detect last worked block when work() tx is present and cache result", async () => {
      const jobAddress = "0xAbCDEF1234567890abcdef1234567890ABCDEF12";
      const fromBlock = 10;
      const toBlock = 12;

      const WORK_SELECTOR = ethers.utils.id("work(bytes32,bytes)").slice(0, 10);

      // Return different blocks depending on requested number
      mockProvider.getBlockWithTransactions.mockImplementation(
        async (
          blockTag: ethers.providers.BlockTag | Promise<ethers.providers.BlockTag>
        ) => {
          const resolvedBlockTag = await blockTag as any;
          const blockNumber =
            typeof resolvedBlockTag === "number"
              ? resolvedBlockTag
              : parseInt(resolvedBlockTag as any) || 0;
          if (blockNumber === 12) {
            return {
              number: 12,
              hash: "0xblock12",
              parentHash: "0xparent",
              timestamp: 1000,
              // No matching tx here
              transactions: [
                {
                  to: "0x0000000000000000000000000000000000000000",
                  data: "0xdeadbeef",
                } as any,
              ],
            } as any;
          }
          if (blockNumber === 11) {
            return {
              number: 11,
              hash: "0xblock11",
              parentHash: "0xparent",
              timestamp: 999,
              // Matching work() transaction to the target job
              transactions: [
                {
                  to: jobAddress,
                  data: `${WORK_SELECTOR}00`,
                } as any,
              ],
            } as any;
          }
          // Default for any other block
          return {
            number: blockNumber,
            hash: "0xblock",
            parentHash: "0xparent",
            timestamp: 998,
            transactions: [],
          } as any;
        }
      );

      const lastWorkedBlock = await jobMonitor.getLastWorkedBlock(
        jobAddress,
        fromBlock,
        toBlock
      );

      expect(lastWorkedBlock).toBe(11);

      // Verify cached status is set and not stalled
      const cached = (jobMonitor as any).jobStatusCache.get(jobAddress);
      expect(cached?.isStalled).toBe(false);
      expect(cached?.lastWorkedBlock).toBe(11);

      // Subsequent call should hit cache and avoid further provider calls
      mockProvider.getBlockWithTransactions.mockClear();
      const cachedResult = await jobMonitor.getLastWorkedBlock(
        jobAddress,
        fromBlock,
        toBlock
      );
      expect(cachedResult).toBe(11);
      expect(mockProvider.getBlockWithTransactions).not.toHaveBeenCalled();
    });
  });

  describe("checkJobsEfficiently", () => {
    it("should return an array of JobStatus objects with correct addresses", async () => {
      const jobs = ["0x1", "0x2", "0x3"];
      const fromBlock = 10;
      const toBlock = 20;

      // Mock getLastWorkedBlock to return null (stalled) for all jobs
      jest.spyOn(jobMonitor, "getLastWorkedBlock").mockImplementation(async () => null);

      const statuses = await jobMonitor.checkJobsEfficiently(jobs, fromBlock, toBlock);

      expect(statuses).toHaveLength(jobs.length);

      statuses.forEach((status, i) => {
        expect(status.address).toBe(jobs[i]);
        expect(typeof status.isStalled).toBe("boolean");
        expect(status.lastChecked).toBeInstanceOf(Date);
        expect(status.lastWorkedBlock).toBeNull();
        expect(status.isStalled).toBe(true);
      });
    });
  });

  describe("clearCaches", () => {
    it("should clear both caches", () => {
      // @ts-ignore
      jobMonitor.jobStatusCache.set("key", {
        address: "0x1",
        lastWorkedBlock: 10,
        isStalled: false,
        lastChecked: new Date(),
      });
      (jobMonitor as any).blockCache.set(1, {
        blockNumber: 1,
        timestamp: Date.now(),
        hash: "0xhash",
        transactions: [],
      });

      // @ts-ignore
      expect(jobMonitor.jobStatusCache.size).toBe(1);
      // @ts-ignore
      expect(jobMonitor.blockCache.size).toBe(1);

      jobMonitor.clearCaches();

      // @ts-ignore
      expect(jobMonitor.jobStatusCache.size).toBe(0);
      // @ts-ignore
      expect(jobMonitor.blockCache.size).toBe(0);
    });
  });
});
