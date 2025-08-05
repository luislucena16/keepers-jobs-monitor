import { DiscordError } from '../types/errors';

// Interface for Discord messages
interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

interface JobStatus {
  address: string;
  lastWorkedBlock: number | null;
  isStalled: boolean;
  lastChecked: Date;
}

export class DiscordService {
  private webhookUrl: string;
  private readonly USERNAME = 'MakerDAO Monitor';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(webhookUrl: string) {
    if (!webhookUrl) {
      throw new DiscordError('Discord webhook URL is required');
    }
    
    if (!webhookUrl.includes('discord.com/api/webhooks')) {
      throw new DiscordError('Invalid Discord webhook URL format');
    }
    
    this.webhookUrl = webhookUrl;
  }

  // Send stalled jobs alert using rich embeds
  async sendStalledJobsAlert(
    stalledJobs: JobStatus[],
    totalJobs: number,
    currentBlock: number
  ): Promise<void> {
    const stalledAddresses = stalledJobs.map(job => job.address);
    const stalledPercentage = ((stalledJobs.length / totalJobs) * 100).toFixed(1);

    const embedMessage: DiscordMessage = {
      username: this.USERNAME,
      embeds: [{
        title: "🚨 MAKERDAO ALERT - JOBS NOT WORKING",
        description: `**${stalledJobs.length} out of ${totalJobs} jobs** haven't been worked in the last 10 blocks! (${stalledPercentage}%)`,
        color: 0xFF0000, // Red color
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: "📊 Summary",
            value: `• Stalled jobs: **${stalledJobs.length}**\n• Total jobs: **${totalJobs}**\n• Current block: **${currentBlock}**\n• Percentage affected: **${stalledPercentage}%**`,
            inline: false
          },
          {
            name: "🔍 Checked Range",
            value: `Blocks: **${currentBlock - 10}** - **${currentBlock - 1}**`,
            inline: true
          },
          {
            name: "⏰ Time",
            value: new Date().toLocaleString(),
            inline: true
          },
          {
            name: "❌ Stalled Job Addresses",
            value: this.formatJobAddresses(stalledAddresses),
            inline: false
          },
          {
            name: "🚨 Action Required",
            value: "These jobs need **immediate attention**! Check keepers and gas prices.",
            inline: false
          }
        ]
      }]
    };

    console.log('🚨 Sending stalled jobs alert to Discord...');
    await this.sendWithRetry(embedMessage, 'stalled jobs alert');
  }

  // Send healthy status update
  async sendHealthyStatusUpdate(totalJobs: number, currentBlock: number): Promise<void> {
    const embedMessage: DiscordMessage = {
      username: this.USERNAME,
      embeds: [{
        title: "✅ MAKERDAO JOBS - ALL HEALTHY",
        description: "All jobs are working correctly!",
        color: 0x00FF00, // Green color
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: "📊 Summary",
            value: `• Total jobs checked: **${totalJobs}**\n• Stalled jobs: **0**\n• Current block: **${currentBlock}**`,
            inline: false
          },
          {
            name: "🔍 Checked Range",
            value: `Blocks: **${currentBlock - 10}** - **${currentBlock - 1}**`,
            inline: true
          },
          {
            name: "⏰ Last Check",
            value: new Date().toLocaleString(),
            inline: true
          },
          {
            name: "✅ Status",
            value: "All systems operational. No action required.",
            inline: false
          }
        ]
      }]
    };

    console.log('✅ Sending healthy status update to Discord...');
    await this.sendWithRetry(embedMessage, 'healthy status update');
  }

  // Send system error alert
  async sendSystemErrorAlert(error: unknown, requestId?: string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const embedMessage: DiscordMessage = {
      username: this.USERNAME,
      embeds: [{
        title: "🔥 MAKERDAO MONITOR ERROR",
        description: "❌ **System execution failed!**",
        color: 0xFF4500, // Orange-red color
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: "❌ Error Message",
            value: `\`\`\`${errorMessage.substring(0, 1000)}\`\`\``,
            inline: false
          },
          {
            name: "🆔 Request ID",
            value: requestId || 'Unknown',
            inline: true
          },
          {
            name: "⏰ Time",
            value: new Date().toLocaleString(),
            inline: true
          },
          {
            name: "🚨 Action Required",
            value: "Check **CloudWatch logs** and system health immediately!",
            inline: false
          }
        ]
      }]
    };

    // Add stack trace if available and not too long
    if (stack && stack.length < 1000) {
      embedMessage.embeds![0].fields!.splice(-1, 0, {
        name: "📋 Stack Trace",
        value: `\`\`\`${stack.substring(0, 1000)}\`\`\``,
        inline: false
      });
    }

    console.log('🔥 Sending system error alert to Discord...');
    await this.sendWithRetry(embedMessage, 'system error alert');
  }

  // Send configuration error alert
  async sendConfigErrorAlert(missingVars: string[]): Promise<void> {
    const embedMessage: DiscordMessage = {
      username: this.USERNAME,
      embeds: [{
        title: "⚙️ MAKERDAO CONFIG ERROR",
        description: "❌ **Configuration validation failed!**",
        color: 0xFFA500, // Orange color
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: "❌ Missing Variables",
            value: missingVars.map(v => `• \`${v}\``).join('\n'),
            inline: false
          },
          {
            name: "⏰ Time",
            value: new Date().toLocaleString(),
            inline: true
          },
          {
            name: "🚨 Action Required",
            value: "Update environment configuration and redeploy!",
            inline: false
          }
        ]
      }]
    };

    console.log('⚙️ Sending config error alert to Discord...');
    await this.sendWithRetry(embedMessage, 'config error alert');
  }

  // Send RPC connection error alert
  async sendRpcErrorAlert(rpcUrl: string, error: string): Promise<void> {
    const embedMessage: DiscordMessage = {
      username: this.USERNAME,
      embeds: [{
        title: "🌐 RPC CONNECTION ERROR",
        description: "❌ **Unable to connect to Ethereum RPC!**",
        color: 0xFF6B35, // Red-orange color
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: "🔗 RPC URL",
            value: `\`${rpcUrl}\``,
            inline: false
          },
          {
            name: "❌ Error",
            value: `\`\`\`${error.substring(0, 1000)}\`\`\``,
            inline: false
          },
          {
            name: "⏰ Time",
            value: new Date().toLocaleString(),
            inline: true
          },
          {
            name: "🚨 Action Required",
            value: "Check RPC endpoint health and network connectivity!",
            inline: false
          }
        ]
      }]
    };

    console.log('🌐 Sending RPC error alert to Discord...');
    await this.sendWithRetry(embedMessage, 'RPC error alert');
  }

  // Send periodic status report (for scheduled health checks)
  async sendPeriodicStatusReport(
    totalJobs: number,
    activeJobs: number,
    stalledJobs: number,
    currentBlock: number,
    uptime: string
  ): Promise<void> {
    const healthPercentage = ((activeJobs / totalJobs) * 100).toFixed(1);
    const isHealthy = stalledJobs === 0;

    const embedMessage: DiscordMessage = {
      username: this.USERNAME,
      embeds: [{
        title: "📊 MAKERDAO PERIODIC STATUS REPORT",
        description: `System health: **${healthPercentage}%** | Uptime: **${uptime}**`,
        color: isHealthy ? 0x00FF00 : (stalledJobs <= 3 ? 0xFFFF00 : 0xFF0000),
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: "📈 Job Statistics",
            value: `• Total jobs: **${totalJobs}**\n• Active jobs: **${activeJobs}**\n• Stalled jobs: **${stalledJobs}**\n• Health: **${healthPercentage}%**`,
            inline: true
          },
          {
            name: "🏗️ Blockchain Info",
            value: `• Current block: **${currentBlock}**\n• Checked range: **${currentBlock - 10}** - **${currentBlock - 1}**`,
            inline: true
          },
          {
            name: "⏱️ System Info",
            value: `• Uptime: **${uptime}**\n• Last check: **${new Date().toLocaleString()}**`,
            inline: false
          },
          {
            name: isHealthy ? "✅ Status" : "⚠️ Status",
            value: isHealthy 
              ? "All systems operational"
              : `**${stalledJobs}** jobs require attention`,
            inline: false
          }
        ]
      }]
    };

    console.log('📊 Sending periodic status report to Discord...');
    await this.sendWithRetry(embedMessage, 'periodic status report');
  }

  // Send simple text message (fallback method)
  async sendSimpleMessage(message: string): Promise<void> {
    const simpleMessage: DiscordMessage = {
      content: message,
      username: this.USERNAME
    };

    console.log('📝 Sending simple message to Discord...');
    await this.sendWithRetry(simpleMessage, 'simple message');
  }

  // Private method to send with retry logic
  private async sendWithRetry(message: DiscordMessage, alertType: string): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`📤 Sending ${alertType} (attempt ${attempt}/${this.MAX_RETRIES})...`);
        
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MakerDAO-Monitor/2.0'
          },
          body: JSON.stringify(message),
        });

        console.log(`📊 Discord API Response: ${response.status} ${response.statusText}`);

        if (response.ok) {
          console.log(`✅ ${alertType} sent successfully!`);
          return;
        }

        // Handle specific Discord API errors
        const errorText = await response.text();
        const error = new DiscordError(
          `Discord API error: ${response.status} ${response.statusText} - ${errorText}`,
          response.status,
          this.webhookUrl
        );

        // Don't retry on certain errors
        if (response.status === 404 || response.status === 401 || response.status === 403) {
          throw error;
        }

        // Rate limit handling
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.RETRY_DELAY;
          console.log(`⏳ Rate limited. Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }

        lastError = error;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Attempt ${attempt} failed:`, lastError.message);

        // Don't retry on certain errors
        if (error instanceof DiscordError && [404, 401, 403].includes(error.statusCode || 0)) {
          throw error;
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * attempt; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    // If all retries failed, try fallback message
    if (lastError) {
      console.error(`❌ All ${this.MAX_RETRIES} attempts failed. Trying fallback...`);
      await this.sendFallbackMessage(alertType, lastError.message);
    }
  }

  // Fallback to simple message when embeds fail
  private async sendFallbackMessage(originalType: string, errorMessage: string): Promise<void> {
    try {
      const fallbackMessage = `🚨 **MAKERDAO ALERT** 🚨\n\n` +
                             `Failed to send ${originalType}.\n` +
                             `Error: ${errorMessage}\n\n` +
                             `Time: ${new Date().toISOString()}\n\n` +
                             `⚠️ Check system logs for details.`;

      await this.sendSimpleMessage(fallbackMessage);
    } catch (fallbackError) {
      console.error('❌ Even fallback message failed:', fallbackError);
      throw new DiscordError(
        `All Discord communication methods failed. Original: ${errorMessage}`,
        500,
        this.webhookUrl
      );
    }
  }

  // Helper method to format job addresses for Discord
  private formatJobAddresses(addresses: string[]): string {
    const maxVisible = 10;
    
    if (addresses.length === 0) {
      return 'None';
    }

    const visibleJobs = addresses.slice(0, maxVisible)
      .map((address, index) => `\`${index + 1}. ${address}\``)
      .join('\n');

    if (addresses.length > maxVisible) {
      return visibleJobs + `\n\`... and ${addresses.length - maxVisible} more\``;
    }

    return visibleJobs;
  }

  // Helper method for delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test the Discord webhook connection
  async testConnection(): Promise<boolean> {
    try {
      const testMessage: DiscordMessage = {
        username: this.USERNAME,
        embeds: [{
          title: "🧪 CONNECTION TEST",
          description: "Discord webhook is working correctly!",
          color: 0x00BFFF, // Deep sky blue
          timestamp: new Date().toISOString(),
          fields: [
            {
              name: "✅ Status",
              value: "Connection successful",
              inline: true
            },
            {
              name: "⏰ Time",
              value: new Date().toLocaleString(),
              inline: true
            }
          ]
        }]
      };

      await this.sendWithRetry(testMessage, 'connection test');
      return true;
    } catch (error) {
      console.error('❌ Discord connection test failed:', error);
      return false;
    }
  }

  // Get webhook health status
  public getHealthStatus(): {
    webhookUrl: string;
    username: string;
    maxRetries: number;
    retryDelay: number;
  } {
    return {
      webhookUrl: this.webhookUrl.replace(/\/[^/]+$/, '/***'), // Hide webhook token
      username: this.USERNAME,
      maxRetries: this.MAX_RETRIES,
      retryDelay: this.RETRY_DELAY
    };
  }
}