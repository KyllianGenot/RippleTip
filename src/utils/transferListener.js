const { rlusdContract, provider } = require('./ethereumUtils');
const User = require('../models/User');
const { Client, EmbedBuilder } = require('discord.js');
const { ethers } = require('ethers');
const mongoose = require('mongoose');

/**
 * Initializes the transfer event listener
 * @param {Client} client - Discord Client
 */
function initTransferListener(client) {
  console.log('Initializing RLUSD transfer event listener...');
  
  // Check if MongoDB is connected
  const mongoStatus = mongoose.connection.readyState;
  
  if (mongoStatus === 0) {
    console.log('MongoDB not connected. Transfer listener will work without data persistence.');
    setupTransferListener(client, false);
    
    // Try to reconnect to MongoDB
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected after attempt. Reinitializing transfer listener with persistence...');
      setupTransferListener(client, true);
    });
  } else if (mongoStatus === 1) {
    console.log('MongoDB connected. Transfer listener will work with data persistence.');
    setupTransferListener(client, true);
  } else if (mongoStatus === 2) {
    console.log('MongoDB connection in progress. Waiting before initializing transfer listener...');
    mongoose.connection.once('connected', () => {
      console.log('MongoDB connected. Initializing transfer listener with persistence...');
      setupTransferListener(client, true);
    });
  } else {
    console.log(`Unknown MongoDB connection state (${mongoStatus}). Transfer listener will work without persistence.`);
    setupTransferListener(client, false);
  }
  
  // Handle connection errors
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error in transfer listener:', err.message);
  });
  
  // Handle disconnections
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Transfer listener will work without data persistence.');
  });
}

/**
 * Sets up the transfer event listener
 * @param {Client} client - Discord Client
 * @param {boolean} withMongoDB - Indicates if MongoDB is available
 */
function setupTransferListener(client, withMongoDB = true) {
  // Listen for Transfer events
  rlusdContract.on('Transfer', async (from, to, value, event) => {
    try {
      console.log(`Transfer detected: ${from} -> ${to}, ${value} RLUSD`);
      
      // Get transaction details
      const txHash = event.log.transactionHash;
      
      // Convert value to readable number
      const decimals = await rlusdContract.decimals();
      const formattedValue = ethers.formatUnits(value, decimals);
      
      // Variables to store user information
      let fromUser = null;
      let toUser = null;
      
      // Look for users matching the addresses if MongoDB is available
      if (withMongoDB && mongoose.connection.readyState === 1) {
        try {
          fromUser = await User.findOne({ walletAddress: from.toLowerCase() });
          toUser = await User.findOne({ walletAddress: to.toLowerCase() });
        } catch (dbError) {
          console.error('Error searching for users in MongoDB:', dbError.message);
        }
      }
      
      // If both users are in our database, send a notification
      if (fromUser && toUser) {
        // Find a channel to send the notification
        const guilds = client.guilds.cache.values();
        for (const guild of guilds) {
          // Look for an appropriate channel (for example, a channel named "transactions")
          const channel = guild.channels.cache.find(ch => 
            ch.name.includes('transaction') || ch.name.includes('transfer') || 
            ch.name.includes('bot') || ch.name.includes('general')
          );
          
          if (channel && channel.isTextBased()) {
            try {
              // Create an embed for the notification
              const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('💸 RLUSD Transfer')
                .setDescription(`A RLUSD transfer has been made between two server members.`)
                .addFields(
                  { name: 'From', value: `<@${fromUser.discordId}> (${from})` },
                  { name: 'To', value: `<@${toUser.discordId}> (${to})` },
                  { name: 'Amount', value: `${formattedValue} RLUSD` },
                  { name: 'Transaction', value: `[View on Etherscan](https://sepolia.etherscan.io/tx/${txHash})` }
                )
                .setTimestamp();
              
              // Send the notification
              await channel.send({ embeds: [embed] });
              
              // Also send a private message to the users involved
              try {
                const fromDiscordUser = await client.users.fetch(fromUser.discordId);
                const toDiscordUser = await client.users.fetch(toUser.discordId);
                
                // Message to the sender
                const fromEmbed = new EmbedBuilder()
                  .setColor(0xFF0000)
                  .setTitle('💸 RLUSD Transfer Sent')
                  .setDescription(`You have sent RLUSD to ${toUser.username}.`)
                  .addFields(
                    { name: 'To', value: `${toUser.username} (${to})` },
                    { name: 'Amount', value: `${formattedValue} RLUSD` },
                    { name: 'Transaction', value: `[View on Etherscan](https://sepolia.etherscan.io/tx/${txHash})` }
                  )
                  .setTimestamp();
                
                await fromDiscordUser.send({ embeds: [fromEmbed] }).catch(err => 
                  console.log(`Unable to send a message to user ${fromUser.username}: ${err.message}`)
                );
                
                // Message to the recipient
                const toEmbed = new EmbedBuilder()
                  .setColor(0x00FF00)
                  .setTitle('💰 RLUSD Transfer Received')
                  .setDescription(`You have received RLUSD from ${fromUser.username}.`)
                  .addFields(
                    { name: 'From', value: `${fromUser.username} (${from})` },
                    { name: 'Amount', value: `${formattedValue} RLUSD` },
                    { name: 'Transaction', value: `[View on Etherscan](https://sepolia.etherscan.io/tx/${txHash})` }
                  )
                  .setTimestamp();
                
                await toDiscordUser.send({ embeds: [toEmbed] }).catch(err => 
                  console.log(`Unable to send a message to user ${toUser.username}: ${err.message}`)
                );
              } catch (dmError) {
                console.error('Error sending private messages:', dmError.message);
              }
              
              // Exit the loop once a notification has been sent
              break;
            } catch (channelError) {
              console.error(`Error sending to channel ${channel.name}:`, channelError.message);
            }
          }
        }
      } else {
        console.log('Transfer detected but users are not in our database or MongoDB is not available.');
      }
    } catch (error) {
      console.error('Error processing transfer event:', error.message);
    }
  });
  
  console.log('RLUSD transfer event listener successfully initialized.');
}

module.exports = { initTransferListener }; 