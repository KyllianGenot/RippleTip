const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ethers } = require('ethers');
const User = require('../models/User');
const { generateFundingLink } = require('../utils/walletUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('connect')
    .setDescription('Connect an existing Ethereum wallet to your Discord account')
    .addStringOption(option => 
      option.setName('address')
        .setDescription('Your Ethereum address (public key)')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('private_key')
        .setDescription('Your Ethereum private key (will be stored securely)')
        .setRequired(true)),
  
  async execute(interaction) {
    try {
      // Get options
      const publicAddress = interaction.options.getString('address');
      const privateKey = interaction.options.getString('private_key');
      
      // Immediately hide the command to protect the private key
      await interaction.reply({ content: "Processing your request...", ephemeral: true });
      
      // Check if the address is valid
      if (!ethers.isAddress(publicAddress)) {
        return interaction.editReply({
          content: "The Ethereum address provided is not valid. Please check and try again.",
          ephemeral: true
        });
      }
      
      // Check if the private key is valid by trying to create a wallet
      try {
        const wallet = new ethers.Wallet(privateKey);
        
        // Check that the address derived from the private key matches the provided address
        if (wallet.address.toLowerCase() !== publicAddress.toLowerCase()) {
          return interaction.editReply({
            content: "The private key does not match the provided address. Please check your information.",
            ephemeral: true
          });
        }
      } catch (error) {
        return interaction.editReply({
          content: "The private key provided is not valid. Please check and try again.",
          ephemeral: true
        });
      }
      
      // Check if the user already has a connected wallet
      const existingUser = await User.findOne({ discordId: interaction.user.id });
      
      if (existingUser) {
        return interaction.editReply({
          content: `You already have a connected wallet: \`${existingUser.walletAddress}\`\nUse \`/disconnect\` to disconnect it first.`,
          ephemeral: true
        });
      }
      
      // Check if the address is already used by another user
      const addressInUse = await User.findOne({ walletAddress: publicAddress.toLowerCase() });
      
      if (addressInUse) {
        return interaction.editReply({
          content: "This address is already connected to another Discord account. Please use a different address.",
          ephemeral: true
        });
      }
      
      // Create a new user in the database
      const newUser = new User({
        discordId: interaction.user.id,
        username: interaction.user.username,
        walletAddress: publicAddress.toLowerCase(),
        privateKey: privateKey, // Store the private key (use with caution)
        balance: 0, // Balance will be updated during verification
        createdAt: new Date()
      });
      
      await newUser.save();
      
      // Generate a link to view the wallet on Etherscan
      const etherscanLink = generateFundingLink(publicAddress);
      
      // Create an embed to confirm the connection
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Ethereum Wallet Connected')
        .setDescription(`Your Ethereum wallet has been successfully connected to your Discord account.`)
        .addFields(
          { name: 'Address', value: `\`${publicAddress}\`` },
          { name: 'View on Etherscan', value: `[Click here](${etherscanLink})` },
          { name: 'Next Steps', value: 'Use `/balance` to check your RLUSD balance.' }
        )
        .setTimestamp();
      
      // Reply to the user
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });
      
      // Log for the server (not visible to the user)
      console.log(`Wallet connected for ${interaction.user.username} (${interaction.user.id}): ${publicAddress}`);
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while connecting your wallet. Please try again later.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while connecting your wallet. Please try again later.',
          ephemeral: true
        });
      }
    }
  }
}; 