# 💰 RippleTip - Discord Tipping Bot for RLUSD

RippleTip is a Discord bot that allows users to send and receive RLUSD (Ripple USD) tokens on the Ethereum Sepolia testnet. The bot provides a seamless experience for tipping other users, managing wallets, and participating in a lottery system.

## 🚀 Driving RLUSD Adoption

RippleTip directly aligns with Ripple's mission to drive RLUSD adoption by making it easy for users to send and receive RLUSD on Discord, one of the largest online communities.

- **✅ MVP Live on Testnet**: RippleTip is already functional on Sepolia, allowing users to transact RLUSD via Discord commands.
- **⛽ Solves Gas Fee Barrier**: By integrating a pre-solution paymaster, users can send RLUSD without needing ETH for gas fees, making transactions seamless.
- **📈 Boosts RLUSD Adoption**: RippleTip simplifies peer-to-peer payments, enabling microtransactions, tipping, and rewards all powered by RLUSD.
- **🔄 Easy Onboarding & UX**: No complex DeFi tools needed. Users create or connect their wallet and start transacting RLUSD in a familiar environment.

With a working MVP and clear adoption potential, RippleTip is positioned to expand RLUSD usage beyond traditional DeFi, bringing stablecoin-powered payments to millions of Discord users.

![RippleTip Logo](logo_rippletip.png)

## ✨ Features

### 🏦 Wallet Management
- Create new Ethereum wallets directly from Discord
- Connect existing wallets using private keys
- View your RLUSD balance
- Disconnect wallets when needed

### 💸 Transactions
- Send RLUSD tips to Discord users or Ethereum addresses
- View transaction history
- Automatic fee calculation based on transaction amount

### 🔗 User Relations
- Map Ethereum addresses to Discord accounts
- View and manage address associations
- Easily send tokens to mapped addresses

### 🎮 Lottery System
- Buy lottery tickets with RLUSD
- Participate in lottery draws
- Win the accumulated prize pool

### 📊 Statistics
- View leaderboard of users by RLUSD balance
- Track your ranking in the community

## 🤖 Commands

### 🔰 Basic Commands
- `/create-wallet` - Create a new wallet
- `/connect` - Connect an existing wallet
- `/disconnect` - Disconnect your wallet
- `/balance` - Check your RLUSD balance

### 💸 Transactions
- `/tip` - Send RLUSD to a user or address
- `/history` - View your transaction history

### 🔗 Relations
- `/map` - Associate an Ethereum address with your Discord account
- `/unmap` - Remove the association between your Discord account and an address
- `/relations` - View the associations between addresses and users

### 🎮 Lottery
- `/buy-lottery-ticket` - Purchase a lottery ticket with RLUSD
- `/draw-lottery` - Draw the lottery and select a winner

### 📊 Statistics
- `/leaderboard` - View the ranking of users by RLUSD balance

### ❓ Help
- `/help` - Display general help or help for a specific command

## 💰 Fee Structure

### Transaction Fees
RippleTip uses a PayMaster contract to process transactions with a fee structure based on the amount sent:

| Amount Range (RLUSD) | Fee |
|----------------------|-----|
| 1 - 4.99             | 10% |
| 5 - 9.99             | 8%  |
| 10 - 24.99           | 6%  |
| 25 - 49.99           | 4%  |
| 50 - 99.99           | 2%  |
| 100+                 | 1%  |

### 🎟️ Lottery Fees
Each lottery ticket costs 1 RLUSD, with a 10% fee applied to each ticket purchase:
- Ticket cost: 1 RLUSD
- Fee per ticket: 0.1 RLUSD (10%)
- Amount added to prize pool per ticket: 0.9 RLUSD

When the lottery is drawn, the winner receives the entire prize pool. The accumulated fees are used to maintain the bot and provide liquidity for the RLUSD token.

## 🛠️ Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB
- Discord Bot Token
- Ethereum Sepolia RPC URL

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/RippleTip.git
   cd RippleTip
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a .env file**
   ```
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_APPLICATION_ID=your_application_id
   DISCORD_PUBLIC_KEY=your_public_key
   
   # MongoDB Configuration
   MONGODB_URI=your_mongodb_connection_string
   
   # Ethereum Configuration
   ETHEREUM_RPC_URL=your_sepolia_rpc_url
   RLUSD_CONTRACT_ADDRESS=0x1c7d4b196cb0c7b01d743fbc6116a902379c7238
   PAYMASTER_CONTRACT_ADDRESS=0xf77De6d2AD0E954AF262bb5798002Dd5582376Cd
   LOTTERY_ADDRESS=0x769a939dF7819Cc590B7DC1391ce060a4780E182
   
   # Admin Configuration
   ADMIN_WALLET=your_admin_wallet_address
   ADMIN_PRIVATE_KEY=your_admin_wallet_private_key
   ```
4. **Load the .env file**
   ```bash
   source .env
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

6. **Invite the bot to your server**
   - Go to the Discord Developer Portal
   - Navigate to your application's OAuth2 URL Generator
   - Select the `bot` and `applications.commands` scopes
   - Select the necessary bot permissions
   - Use the generated URL to invite the bot to your server

## 👨‍💻 Development

### Project Structure
- `src/commands/` - Discord slash commands
- `src/models/` - MongoDB models
- `src/utils/` - Utility functions
- `src/contracts/` - Smart contract interfaces
- `src/config/` - Configuration files
- `src/scripts/` - Utility scripts

### Adding New Commands
1. Create a new file in the `src/commands/` directory
2. Implement the command following the Discord.js structure
3. The command will be automatically loaded on startup

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer
This bot uses the Sepolia blockchain (Ethereum testnet). RLUSD tokens are test tokens and have no real value.