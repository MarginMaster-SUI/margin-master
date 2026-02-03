# MarginMaster

**The Social Margin Trading Platform on Sui Network**

MarginMaster is a decentralized application (dApp) that enables social margin trading on the Sui blockchain, leveraging the DeepBook Margin protocol. It allows users to copy the trades of top-performing traders, bringing the eToro experience to DeFi.

## 📂 Repository Structure

This monorepo contains the following packages:

| Package | Description | Path |
|---------|-------------|------|
| **contracts** | Sui Move Smart Contracts | [`packages/contracts`](./packages/contracts) |
| **frontend** | React + TypeScript Web Application | [`packages/frontend`](./packages/frontend) |
| **backend** | Node.js Backend & API Services | [`packages/backend`](./packages/backend) |
| **indexer** | Data Indexing Service | [`packages/indexer`](./packages/indexer) |

## 🚀 Getting Started

### Prerequisites
- Node.js v20+
- pnpm v8+
- Sui CLI

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## 📖 Documentation

- [Architecture Overview](./docs/MarginMaster_Architecture.md)
- [Smart Contracts](./docs/MarginMaster_Smart_Contracts.md)
- [Frontend Guide](./docs/MarginMaster_Frontend.md)
- [Backend Guide](./docs/MarginMaster_Backend.md)
- [Development Plan](./docs/MarginMaster_Development_Plan.md)

## 🛠 Tech Stack

- **Blockchain**: Sui Network, Move
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, BullMQ, Redis, PostgreSQL
- **DeFi Protocol**: DeepBook Margin

## 📄 License

MIT
