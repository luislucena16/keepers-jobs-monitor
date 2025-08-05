const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

export async function sendDiscordAlert(message: string): Promise<void> {
    if (!DISCORD_WEBHOOK_URL) {
        console.error("❌ Discord webhook URL no está configurada.");
        console.error("❌ Verifica que la variable DISCORD_WEBHOOK_URL esté definida en tu .env");
        return;
    }

    if (!DISCORD_WEBHOOK_URL.includes("discord.com/api/webhooks")) {
        console.error("❌ El webhook URL no parece ser válido");
        console.error("❌ URL actual:", DISCORD_WEBHOOK_URL.substring(0, 50) + "...");
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
                    console.error("❌ El webhook fue eliminado o la URL es incorrecta");
                    break;
                case 401:
                case 403:
                    console.error("❌ Sin permisos para usar este webhook");
                    break;
                case 429:
                    console.error("❌ Rate limit alcanzado (máx 30 msgs/min)");
                    break;
                default:
                    console.error("❌ Error desconocido del servidor de Discord");
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
                console.error("❌ Fetch not available. Make sure to use Node 18+ or install node-fetch");
            }
        } else {
            console.error("❌ Unknown error:", error);
        }
        
        throw error;
    }
}
