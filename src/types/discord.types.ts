const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

export async function sendDiscordAlert(message: string): Promise<void> {
    if (!DISCORD_WEBHOOK_URL) {
        console.error("❌ Discord webhook URL is not configured");
        console.error("❌ Verify that the DISCORD_WEBHOOK_URL variable is defined in your .env file");
        return;
    }

    if (!DISCORD_WEBHOOK_URL.includes("discord.com/api/webhooks")) {
        console.error("❌ The webhook URL does not appear to be valid");
        console.error("❌ Current URL:", DISCORD_WEBHOOK_URL.substring(0, 50) + "...");
        return;
    }

    console.log("🚀 Sending message to Discord...");
    console.log("📝 Message:", message.substring(0, 100) + (message.length > 100 ? "..." : ""));

    const payload = { 
        content: message,
        username: "MakerDAO Monitor"
    };

    try {
        console.log("📤 Making a request to Discord...");
        
        // Use native fetch (Node 18+)
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "MakerDAO-Monitor/1.0"
            },
            body: JSON.stringify(payload),
        });

        console.log("📊 Response status:", response.status);
        console.log("📊 Response statusText:", response.statusText);

        if (!response.ok) {
            const responseBody = await response.text();
            console.error(`❌ Error en webhook Discord:`);
            console.error(`   Status: ${response.status} ${response.statusText}`);
            console.error(`   Body: ${responseBody}`);
            
            // Specific error messages for common error codes
            switch (response.status) {
                case 404:
                    console.error("❌ The webhook was deleted or the URL is incorrect.");
                    break;
                case 401:
                case 403:
                    console.error("❌ No permissions to use this webhook");
                    break;
                case 429:
                    console.error("❌ Rate limit reached (max 30 messages/min)");
                    break;
                default:
                    console.error("❌ Unknown Discord server error");
            }
            
            throw new Error(`Discord webhook error ${response.status}: ${responseBody}`);
        }

        const responseBody = await response.text();
        console.log("📊 Response body:", responseBody || "(empty)");
        console.log("✅ Discord alert sent successfully!");
        
    } catch (error) {
        console.error("❌ Error sending alert:");
        
        if (error instanceof Error) {
            console.error("❌ Error name:", error.name);
            console.error("❌ Error message:", error.message);
            
            if (error.message.includes('fetch is not defined')) {
                console.error("❌ Fetch not available. Make sure to use Node 18+");
            }
        } else {
            console.error("❌ Unknown error:", error);
        }
        
        throw error;
    }
}
