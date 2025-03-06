const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ethers = require('ethers');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy-lottery-ticket')
    .setDescription('Buy tickets for the RLUSD lottery (1 RLUSD per ticket)')
    .addIntegerOption(option =>
      option
        .setName('ticket-amount')
        .setDescription('Number of tickets to buy')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const user = await User.findOne({ discordId: interaction.user.id });
      if (!user || !user.privateKey) {
        return interaction.editReply({ content: '❌ Connect a wallet first using /connect-wallet.' });
      }

      const ticketAmount = interaction.options.getInteger('ticket-amount');
      const totalCost = ticketAmount; // In RLUSD (1 RLUSD per ticket)

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Confirm Ticket Purchase')
        .setDescription(`Are you sure you want to buy ${ticketAmount} lottery ticket${ticketAmount > 1 ? 's' : ''} for ${totalCost} RLUSD?`)
        .setTimestamp()
        .setFooter({ text: `Ticket Amount: ${ticketAmount}` });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_buy_ticket_${ticketAmount}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('cancel_buy_ticket')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });
    } catch (error) {
      console.error('Error in execute:', error);
      await interaction.editReply({ content: '❌ Error initiating ticket purchase: ' + error.message });
    }
  },

  async handleButton(interaction, customId) {
    if (customId.startsWith('confirm_buy_ticket_')) {
      await interaction.deferUpdate();

      const ticketAmount = parseInt(customId.split('_')[3], 10);
      const totalCost = ethers.parseEther(ticketAmount.toString());

      const loadingEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⏳ Processing Purchase...')
        .setDescription(`Please wait while your ${ticketAmount} ticket${ticketAmount > 1 ? 's are' : ' is'} being purchased.`)
        .setTimestamp();

      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm_buy_ticket_${ticketAmount}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('cancel_buy_ticket')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await interaction.editReply({ embeds: [loadingEmbed], components: [disabledRow] });

      try {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user || !user.privateKey) {
          return interaction.editReply({
            content: '❌ You need to connect a wallet first using /connect-wallet.',
            embeds: [],
            components: []
          });
        }

        const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_PROVIDER_URL);
        const wallet = new ethers.Wallet(user.privateKey, provider);

        // Check user's ETH balance
        const ethBalance = await provider.getBalance(wallet.address);
        console.log('User ETH balance:', ethers.formatEther(ethBalance));
        
        // Check if user has less than 0.005 ETH
        const MIN_ETH_THRESHOLD = ethers.parseEther("0.005");
        let ethSent = false;
        let ethTransactionUrl = null;
        
        if (ethBalance < MIN_ETH_THRESHOLD) {
          console.log('Insufficient ETH balance. Automatically sending 0.015 ETH from admin wallet...');
          
          // Import sendEthFromAdmin function
          const { sendEthFromAdmin } = require('../utils/walletUtils');
          
          // Send 0.015 ETH from admin wallet
          const ethSendResult = await sendEthFromAdmin(wallet.address, "0.015");
          
          if (!ethSendResult.success) {
            console.error('Failed to send ETH from admin wallet:', ethSendResult.error);
            return interaction.editReply({
              content: `❌ Error: Unable to send ETH to cover transaction fees. Please try again later.`,
              embeds: [],
              components: []
            });
          }
          
          console.log('ETH sent successfully. Transaction hash:', ethSendResult.transactionHash);
          
          // Wait a bit for the transaction to be confirmed and the balance updated
          console.log('Waiting for ETH balance update...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          
          // Check the new ETH balance
          const newEthBalance = await provider.getBalance(wallet.address);
          console.log('New ETH balance after funding:', ethers.formatEther(newEthBalance));
          
          // Store information about the ETH transfer
          ethSent = true;
          ethTransactionUrl = `https://sepolia.etherscan.io/tx/${ethSendResult.transactionHash}`;
        }

        const rlusdAddress = process.env.RLUSD_CONTRACT_ADDRESS || '0xe101fb315a64cda9944e570a7bffafe60b994b1d';
        const lotteryAddress = process.env.LOTTERY_ADDRESS;

        if (!lotteryAddress) {
          throw new Error('LOTTERY_ADDRESS is not defined in the environment variables.');
        }

        const rlusdABI = [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function balanceOf(address account) view returns (uint256)'
        ];
        const lotteryABI = [
          'function buyTicket(uint256 ticketAmount)'
        ];

        const rlusdContract = new ethers.Contract(rlusdAddress, rlusdABI, wallet);
        const lotteryContract = new ethers.Contract(lotteryAddress, lotteryABI, wallet);

        const balance = await rlusdContract.balanceOf(wallet.address);
        if (BigInt(balance) < BigInt(totalCost)) {
          return interaction.editReply({
            content: `❌ Insufficient RLUSD. You need ${ticketAmount} RLUSD.`,
            embeds: [],
            components: []
          });
        }

        const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timed out')), ms));

        const approveTx = await rlusdContract.approve(lotteryAddress, totalCost);
        console.log('Approve transaction sent:', approveTx.hash);
        await Promise.race([approveTx.wait(), timeout(60000)]);

        const buyTx = await lotteryContract.buyTicket(ticketAmount);
        console.log('Buy transaction sent:', buyTx.hash);
        const txReceipt = await Promise.race([buyTx.wait(), timeout(60000)]);
        const transactionHash = buyTx.hash;
        const transactionUrl = `https://sepolia.etherscan.io/tx/${transactionHash}`;

        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Tickets Purchased')
          .setDescription(`You have successfully bought ${ticketAmount} lottery ticket${ticketAmount > 1 ? 's' : ''}.`)
          .addFields(
            { name: 'Transaction', value: `[View on Etherscan](${transactionUrl})`, inline: true }
          )
          .setTimestamp();

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setURL(transactionUrl)
              .setLabel('View Transaction')
              .setStyle(ButtonStyle.Link)
          );

        await interaction.editReply({
          content: '',
          embeds: [embed],
          components: [row]
        });
      } catch (error) {
        console.error('Error in buy-lottery-ticket:', error);
        await interaction.editReply({
          content: `❌ Error buying tickets: ${error.message || 'Unknown error'}`,
          embeds: [],
          components: []
        });
      }
    } else if (customId === 'cancel_buy_ticket') {
      await interaction.update({
        content: '❌ Ticket purchase cancelled.',
        embeds: [],
        components: [],
        ephemeral: true
      });
    }
  }
}; 