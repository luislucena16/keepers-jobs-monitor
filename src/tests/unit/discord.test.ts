import { DiscordService } from '../../../src/services/discord';

interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  fields?: DiscordEmbedField[];
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
}

global.fetch = jest.fn();

describe('DiscordService', () => {
  const webhookUrl = 'https://discord.com/api/webhooks/fake-webhook-url';
  let service: DiscordService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiscordService(webhookUrl);
  });

  describe('sendStalledJobsAlert', () => {
    it('should call sendWithRetry with correct embed message', async () => {
      // We spy on sendWithRetry so as not to make actual calls
      const sendWithRetrySpy = jest.spyOn<any, any>(service as any, 'sendWithRetry').mockResolvedValue(undefined);

      const stalledJobs = [
        { address: '0x123', lastWorkedBlock: 100, isStalled: true, lastChecked: new Date() },
        { address: '0x456', lastWorkedBlock: 101, isStalled: true, lastChecked: new Date() },
      ];
      const totalJobs = 10;
      const currentBlock = 110;

      await service.sendStalledJobsAlert(stalledJobs, totalJobs, currentBlock);

      expect(sendWithRetrySpy).toHaveBeenCalledTimes(1);

      const [messageArg, alertTypeArg] = sendWithRetrySpy.mock.calls[0];
      const discordMessage = messageArg as DiscordMessage;

      expect(alertTypeArg).toBe('stalled jobs alert');
      expect(discordMessage.username).toBe('MakerDAO Monitor');
      expect(discordMessage.embeds).toHaveLength(1);

      const embed = discordMessage.embeds![0];
      expect(embed.title).toContain('🚨 MAKERDAO ALERT - JOBS NOT WORKING');
      expect(embed.color).toBe(0xff0000);

      expect(embed.description).toContain('2 out of 10 jobs');

      expect(embed.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '❌ Stalled Job Addresses', value: expect.stringContaining('0x123') }),
          expect.objectContaining({ name: '❌ Stalled Job Addresses', value: expect.stringContaining('0x456') }),
          expect.objectContaining({ name: '🚨 Action Required' }),
        ])
      );
    });
  });

  describe('sendWithRetry (retry logic)', () => {
    it('should succeed on first try when response.ok is true', async () => {
      const okResponse = { ok: true, status: 200, statusText: 'OK' } as any;
      (global.fetch as jest.Mock).mockResolvedValueOnce(okResponse);

      await (service as any).sendWithRetry({ content: 'hello' }, 'test alert');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on non-2xx and eventually succeed (no explicit backoff for 5xx)', async () => {
      const badResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('server blew up'),
        headers: new Map(),
      } as any;

      const okResponse = { ok: true, status: 200, statusText: 'OK' } as any;

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(badResponse)
        .mockResolvedValueOnce(okResponse);

      const sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await (service as any).sendWithRetry({ content: 'retry me' }, 'retrying alert');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      // For 500, code does not necessarily call sleep before next retry
      expect(sleepSpy).not.toHaveBeenCalled();

      sleepSpy.mockRestore();
    });

    it('should respect 429 retry-after header', async () => {
      const rateLimitedResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: jest.fn().mockResolvedValue('rate limited'),
        headers: { get: (k: string) => (k.toLowerCase() === 'retry-after' ? '2' : null) },
      } as any;

      const okResponse = { ok: true, status: 200, statusText: 'OK' } as any;

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(okResponse);

      const sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await (service as any).sendWithRetry({ content: 'rate limit' }, 'rate');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledWith(2000);

      sleepSpy.mockRestore();
    });

    it('should not retry on 404/401/403 and throw', async () => {
      const notFound = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('missing'),
        headers: new Map(),
      } as any;

      (global.fetch as jest.Mock).mockResolvedValueOnce(notFound);

      await expect(
        (service as any).sendWithRetry({ content: 'no retry' }, 'no-retry')
      ).rejects.toHaveProperty('name', 'DiscordError');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should fall back to simple message after max retries', async () => {
      const badResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('server blew up'),
        headers: new Map(),
      } as any;

      // cause 3 failed attempts, then fallback path, which calls sendSimpleMessage
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(badResponse)
        .mockResolvedValueOnce(badResponse)
        .mockResolvedValueOnce(badResponse);

      const sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
      const simpleSpy = jest
        .spyOn(service as any, 'sendSimpleMessage')
        .mockResolvedValue(undefined);

      await (service as any).sendWithRetry({ content: 'retry 3 times' }, 'triple-fail');

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(simpleSpy).toHaveBeenCalledTimes(1);

      sleepSpy.mockRestore();
      simpleSpy.mockRestore();
    });
  });
});
