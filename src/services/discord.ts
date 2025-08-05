// Configs .env
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL!;

// Interface for Discord messages
interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
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

// Send a plain text message to Discord using a webhook
// Useful for simple notifications or as a fallback if embeds fail
export async function sendDiscordMessage(message: string): Promise<void> {
  try {
    console.log('🚀 Sending message to Discord...');
    console.log('📝 Message preview:', message.substring(0, 100) + '...');
    
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
      }),
    });

    console.log('📊 Discord API Response:', {
      status: response.status,
      statusText: response.statusText
    });

    if (response.ok) {
      console.log('✅ Discord message sent successfully!');
    } else {
      const errorText = await response.text();
      throw new Error(`Discord API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Error sending Discord message:', error);
    throw error;
  }
}

// Send a rich format alert for stalled jobs
export async function sendStallAlert(
  stalledJobs: string[], 
  totalJobs: number, 
  currentBlock: number
): Promise<void> {
  const embedMessage: DiscordMessage = {
    embeds: [{
      title: "🚨 MAKERDAO ALERT - JOBS NOT WORKING",
      description: `**${stalledJobs.length} out of ${totalJobs} jobs** haven't been worked in the last 10 blocks!`,
      color: 0xFF0000, // Red color
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: "📊 Summary",
          value: `• Stalled jobs: **${stalledJobs.length}**\n• Total jobs: **${totalJobs}**\n• Current block: **${currentBlock}**`,
          inline: false
        },
        {
          name: "🔍 Checked Range",
          value: `Blocks: **${currentBlock - 10}** - **${currentBlock - 1}**`,
          inline: true
        },
        {
          name: "⏰ Time",
          value: new Date().toISOString(),
          inline: true
        },
        {
          name: "❌ Stalled Job Addresses",
          value: stalledJobs.slice(0, 10).map((job, index) => `\`${index + 1}. ${job}\``).join('\n') + 
                (stalledJobs.length > 10 ? `\n... and ${stalledJobs.length - 10} more` : ''),
          inline: false
        },
        {
          name: "🚨 Action Required",
          value: "These jobs need **immediate attention**!",
          inline: false
        }
      ]
    }]
  };

  try {
    console.log('🚨 Sending stall alert to Discord...');
    
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(embedMessage),
    });

    if (response.ok) {
      console.log('✅ Stall alert sent successfully!');
    } else {
      const errorText = await response.text();
      throw new Error(`Discord API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Error sending stall alert:', error);
    // Fallback: send simple message
    const simpleMessage = `🚨 **MAKERDAO ALERT** 🚨\n❌ **${stalledJobs.length} out of ${totalJobs} jobs** haven't been worked!\n**Time:** ${new Date().toISOString()}`;
    await sendDiscordMessage(simpleMessage);
  }
}

// Send a critical error alert
export async function sendErrorAlert(error: any): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const embedMessage: DiscordMessage = {
    embeds: [{
      title: "🔥 MAKERDAO MONITOR ERROR",
      description: "❌ **Lambda execution failed!**",
      color: 0xFF4500, // Orange-red color
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: "❌ Error",
          value: `\`\`\`${errorMessage}\`\`\``,
          inline: false
        },
        {
          name: "⏰ Time",
          value: new Date().toISOString(),
          inline: true
        },
        {
          name: "🚨 Action Required",
          value: "Check **CloudWatch logs** immediately!",
          inline: false
        }
      ]
    }]
  };

  if (stack && stack.length < 1000) {
    embedMessage.embeds![0].fields!.push({
      name: "📋 Stack Trace",
      value: `\`\`\`${stack.substring(0, 1000)}\`\`\``,
      inline: false
    });
  }

  try {
    console.log('🔥 Sending error alert to Discord...');
    
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(embedMessage),
    });

    if (response.ok) {
      console.log('✅ Error alert sent successfully!');
    } else {
      throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
    }
  } catch (discordError) {
    console.error('❌ Error sending error alert:', discordError);
    // Fallback: send simple message
    const simpleMessage = `🔥 **MAKERDAO MONITOR ERROR** 🔥\n❌ **Lambda execution failed!**\n**Error:** ${errorMessage}\n**Time:** ${new Date().toISOString()}`;
    await sendDiscordMessage(simpleMessage);
  }
}

// Send a success message when everything works correctly
export async function sendSuccessMessage(totalJobs: number, currentBlock: number): Promise<void> {
  const embedMessage: DiscordMessage = {
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
          name: "⏰ Last Check",
          value: new Date().toISOString(),
          inline: true
        }
      ]
    }]
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(embedMessage),
    });
    console.log('✅ Success message sent to Discord!');
  } catch (error) {
    console.error('❌ Error sending success message:', error);
  }
}