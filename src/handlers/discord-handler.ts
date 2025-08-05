import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { numJobs, jobAt } from "../services/sequencer";
import { getLastWorkedBlock } from "../types/job.types";
import { sendDiscordAlert } from "../types/discord.types";

console.log("🚀 ========================================");
console.log("🚀 MAKERDAO JOB MONITOR STARTING...");
console.log("🚀 ========================================");

const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
const sequencerAddress = process.env.SEQUENCER_ADDRESS ?? "";

export const handler = async (): Promise<void> => {
    console.log("🚀 Handler function called!");
    console.log("🔧 Environment check:");
    console.log("   - ETHEREUM_RPC_URL:", process.env.ETHEREUM_RPC_URL ? "✅ Configurado" : "❌ FALTANTE");
    console.log("   - SEQUENCER_ADDRESS:", process.env.SEQUENCER_ADDRESS ? "✅ Configurado" : "❌ FALTANTE");
    console.log("   - DISCORD_WEBHOOK_URL:", process.env.DISCORD_WEBHOOK_URL ? "✅ Configurado" : "❌ FALTANTE");

    // Verify critical variables
    if (!process.env.ETHEREUM_RPC_URL) {
        console.error("❌ ETHEREUM_RPC_URL no está configurada!");
        return;
    }
    if (!process.env.SEQUENCER_ADDRESS) {
        console.error("❌ SEQUENCER_ADDRESS no está configurada!");
        return;
    }
    if (!process.env.DISCORD_WEBHOOK_URL) {
        console.error("❌ DISCORD_WEBHOOK_URL no está configurada!");
        return;
    }

    try {
        console.log("🔗 Connecting to Ethereum...");
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 10;

        console.log(`⛓️  Current block: ${currentBlock}`);
        console.log(`🔍 Checking from block ${fromBlock} to ${currentBlock}`);

        console.log("📊 Getting jobs count...");
        const jobsCount = await numJobs(provider, sequencerAddress);
        console.log(`📊 Total jobs found: ${jobsCount}`);

        const stalledJobs: string[] = [];

        for (let i = 0; i < jobsCount; i++) {
            console.log(`🔎 Checking job ${i}/${jobsCount - 1}...`);
            const jobAddress = await jobAt(provider, sequencerAddress, i);
            console.log(`   Job address: ${jobAddress}`);

            const lastWorkedBlock = await getLastWorkedBlock(jobAddress, fromBlock, currentBlock);

            if (lastWorkedBlock === null || lastWorkedBlock < fromBlock) {
                console.warn(`⚠️  Job ${jobAddress} has NOT been worked in last 10 blocks`);
                stalledJobs.push(jobAddress);
            } else {
                console.log(`✅ Job ${jobAddress} was worked at block ${lastWorkedBlock}`);
            }
        }

        console.log(`📊 Summary: ${stalledJobs.length} stalled jobs out of ${jobsCount} total jobs`);
        
        if (stalledJobs.length > 0) {
            console.log("🚨 STALLED JOBS DETECTED:");
            stalledJobs.forEach((job, index) => {
                console.log(`   ${index + 1}. ${job}`);
            });
        } else {
            console.log("✅ All jobs are working properly!");
        }

        let alertMessage: string;
        let alertType: string;

        if (stalledJobs.length > 0) {
            alertMessage = `🚨 **MAKERDAO ALERT - JOBS NOT WORKING** 🚨\n\n` +
                          `❌ **${stalledJobs.length} out of ${jobsCount} jobs** haven't been worked in the last 10 blocks!\n\n` +
                          `**Stalled Job Addresses:**\n` +
                          stalledJobs.map(job => `• \`${job}\``).join("\n") + "\n\n" +
                          `**Details:**\n` +
                          `• Current block: ${currentBlock}\n` +
                          `• Checked blocks: ${fromBlock} - ${currentBlock}\n` +
                          `• Time: ${new Date().toISOString()}\n\n` +
                          `⚠️ **Action required:** These jobs need immediate attention!`;
            alertType = "CRITICAL";
        } else {
            alertMessage = `✅ **MakerDAO Status - All Jobs Working** ✅\n\n` +
                          `All **${jobsCount} jobs** have been worked recently!\n\n` +
                          `**Details:**\n` +
                          `• Current block: ${currentBlock}\n` +
                          `• Checked blocks: ${fromBlock} - ${currentBlock}\n` +
                          `• Time: ${new Date().toISOString()}`;
            alertType = "OK";
        }

        console.log(`🚨 Sending ${alertType} alert to Discord...`);
        console.log(`📝 Alert message preview: ${alertMessage.substring(0, 100)}...`);
        
        try {
            await sendDiscordAlert(alertMessage);
            console.log("✅ Alert sent successfully!");
        } catch (alertError) {
            console.error("❌ Failed to send alert to Discord:", alertError);
        }

    } catch (error) {
        console.error("❌ Error en handler:", error);
        
        if (error instanceof Error) {
            console.error("❌ Error stack:", error.stack);
        }
        
        try {
            console.log("🚨 Sending error alert to Discord...");
            const errorMessage = error instanceof Error ? error.message : String(error);
            const alertMessage = `🚨 **MAKERDAO SYSTEM ERROR** 🚨\n\n` +
                                `❌ **Job checker encountered an error:**\n\`\`\`\n${errorMessage}\n\`\`\`\n\n` +
                                `**Details:**\n` +
                                `• Time: ${new Date().toISOString()}\n` +
                                `• Sequencer: ${sequencerAddress}\n` +
                                `• RPC: ${process.env.ETHEREUM_RPC_URL ? 'Connected' : 'Not configured'}\n\n` +
                                `⚠️ **Action required:** Check system logs and restart monitoring!`;
            await sendDiscordAlert(alertMessage);
            console.log("✅ Error alert sent successfully.");
        } catch (alertError) {
            console.error("❌ Failed to send error alert to Discord:", alertError);
            if (alertError instanceof Error) {
                console.error("❌ Alert error stack:", alertError.stack);
            }
        }
    }

    console.log("🚀 Handler execution completed!");
};