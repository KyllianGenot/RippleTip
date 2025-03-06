const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ethers } = require('ethers');
const User = require('../models/User');
const { generateRandomWallet, generateFundingLink } = require('../utils/walletUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-wallet')
    .setDescription('Create an Ethereum wallet for your Discord account'),
  
  async execute(interaction) {
    try {
      // Check if the user already has a connected wallet
      const existingUser = await User.findOne({ discordId: interaction.user.id });
      
      if (existingUser) {
        return interaction.reply({
          content: `You already have a connected wallet: \`${existingUser.walletAddress}\`\nUse \`/disconnect\` to disconnect it first.`,
          ephemeral: true
        });
      }
      
      // Inform the user that we are creating their wallet
      await interaction.reply({ content: "Creating your wallet...", ephemeral: true });
      
      // Generate a new wallet for the user
      const wallet = generateRandomWallet();
      
      // Create a new user in the database
      const newUser = new User({
        discordId: interaction.user.id,
        username: interaction.user.username,
        walletAddress: wallet.address.toLowerCase(),
        privateKey: wallet.privateKey, // Store the private key (use with caution)
        balance: 5000000000000000000, // 5 RLUSD pre-funded
        createdAt: new Date()
      });
      
      await newUser.save();
      
      // Generate a link to pre-fund the wallet
      const fundingLink = generateFundingLink(wallet.address);
      
      // Create an embed to display wallet information
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Ethereum Wallet Created')
        .setDescription(`Your Ethereum wallet has been successfully created.`)
        .addFields(
          { name: 'Address', value: `\`${wallet.address}\`` },
          { name: 'Private Key', value: `\`${wallet.privateKey}\`` },
          { name: '⚠️ WARNING', value: 'Keep your private key in a safe place. Do not share it with anyone!' }
        )
        .setTimestamp();
      
      // Reply to the user with their new wallet information
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });
      
      // Log for the server (not visible to the user)
      console.log(`New wallet created for ${interaction.user.username} (${interaction.user.id}): ${wallet.address}`);
      
    } catch (error) {
      console.error('Error creating wallet:', error);
      
      // If a response has already been deferred
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while creating your wallet. Please try again later.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while creating your wallet. Please try again later.',
          ephemeral: true
        });
      }
    }
  }
}; 