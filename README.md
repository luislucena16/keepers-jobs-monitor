# MakerDAO Job Monitor

A serverless monitoring system for MakerDAO jobs that alerts via Discord when jobs haven't been executed recently.

## 🎯 What it does

This system monitors MakerDAO jobs by:
- Checking if jobs have executed `work()` calls in recent blocks
- Identifying stalled jobs that haven't been worked
- Sending real-time alerts to Discord
- Providing detailed monitoring reports

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured
- Serverless Framework
- Discord webhook URL

### Installation
```bash
npm install
```

- Add the .env:
```shell
cp .env.example .env
# Configure your .env file (Add your Discord webhook)
```

- Build project

```shell
npm run build
```

- Run the project Locally:
```
npm run start
```

- Run the project in the Lambda:
```shell
npx serverless offline
```

## Configuration
```bash
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
SEQUENCER_ADDRESS=0x1234567890123456789012345678901234567890
DISCORD_WEBHOOK_URL=add_your_webhook_here
```

## 🏗️ Architecture
```shell
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Lambda Cron   │───▶│   Job Monitor    │───▶│   Discord Bot   │
│   (Scheduler)   │    │   Service        │    │   (Alerts)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Ethereum RPC   │
                       │   (Web3 Data)    │
                       └──────────────────┘
```

## 🔧 Development
**Running Tests**
```bash
npm test ->                 # Integration and unit tests
```

## 📊 Performance Optimizations

- RPC Call Reduction: Uses event logs instead of full block scanning
- Intelligent Caching: LRU cache for blocks and job statuses
- Parallel Processing: Batch processing of multiple jobs
- Fallback Strategy: Graceful degradation when RPC is slow

## 🚨 Monitoring & Alerts
**Alert Types**

- 🚨 Critical: Stalled jobs detected
- ✅ Healthy: All jobs working normally
- 🔥 Error: System errors and failures

**Metrics Tracked**

- Job execution frequency
- RPC response times
- System error rates
- Alert delivery success

## 📖 API Documentation
**JobMonitorService**
```shell
class JobMonitorService {
  async checkJobsEfficiently(
    jobAddresses: string[],
    fromBlock: number,
    toBlock: number
  ): Promise<JobStatus[]>
}
```

**Configuration Options**
- `BLOCKS_TO_CHECK`: 10 -> Number of recent blocks to scan
- `BATCH_SIZE`: 10 -> Jobs processed in parallel
- `CACHE_TTL_MINUTES`: 5 -> Cache expiration time

## 🤝 Contributing

- i) Fork the repository
- ii) Create a feature branch
- iii) Add tests for new functionality
- iv) Ensure all tests pass
- v) Submit a pull request

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**⭐ If this template is useful to you, consider giving the repository a star!**

---

**Made with ❤️ by Luis Lucena**