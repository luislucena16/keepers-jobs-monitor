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
});
