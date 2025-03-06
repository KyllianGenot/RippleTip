const Tip = require('../models/Tip');
const { getDisplayNameForAddress } = require('./relationUtils');
const { transferViaPaymaster, calculateFees } = require('./paymasterUtils');
const User = require('../models/User');
const { ethers } = require('ethers');

/**
 * Get the transaction URL on Etherscan
 * @param {string} txHash - Transaction hash
 * @returns {string} - Etherscan URL
 */
function getTransactionUrl(txHash) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

/**
 * Get the address URL on Etherscan
 * @param {string} address - Ethereum address
 * @returns {string} - Etherscan URL
 */
function getAddressUrl(address) {
  return `https://sepolia.etherscan.io/address/${address}`;
}

/**
 * Send a tip from one user to another
 * @param {string} senderId - Discord ID of the sender
 * @param {string} recipientAddress - Ethereum address of the recipient
 * @param {string|number} amount - Amount of RLUSD to send
 * @param {string} message - Optional message with the tip
 * @returns {Promise<Object>} - Result of the operation
 */
async function sendTip(senderId, recipientAddress, amount, message = '') {
  try {
    console.log('sendTip called with:', { 
      senderId, 
      recipientAddress, 
      amount, 
      amountType: typeof amount,
      message 
    });

    // Find the sender's user record
    const sender = await User.findOne({ discordId: senderId });
    if (!sender) {
      return { 
        success: false, 
        message: 'You need to create a wallet first. Use /create-wallet to get started.' 
      };
    }

    // Validate the amount
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return { success: false, message: 'Amount must be greater than 0' };
    }

    // Ensure amount is a clean string (remove any non-numeric characters except decimal point)
    console.log('Original amount:', amount, 'Type:', typeof amount);
    
    // Convert to string and replace commas with dots
    let cleanAmount = amount.toString().replace(',', '.');
    
    // Remove all non-numeric characters except decimal point
    cleanAmount = cleanAmount.replace(/[^0-9.]/g, '');
    
    // Ensure there's only one decimal point
    const parts = cleanAmount.split('.');
    if (parts.length > 2) {
      cleanAmount = parts[0] + '.' + parts.slice(1).join('');
    }
    
    console.log('Clean amount for transfer:', cleanAmount);

    // Check if the cleaned amount is a valid number
    if (isNaN(parseFloat(cleanAmount)) || !isFinite(parseFloat(cleanAmount))) {
      return { 
        success: false, 
        message: 'The amount is not a valid number after cleaning.' 
      };
    }

    // Calculate fees before transfer
    const feeDetails = calculateFees(cleanAmount);
    
    // Check if the amount is too low
    if (feeDetails.error) {
      return { 
        success: false, 
        message: feeDetails.error
      };
    }
    
    console.log('Fee details:', feeDetails);

    // Send the transaction via PayMaster
    const result = await transferViaPaymaster(sender.privateKey, recipientAddress, cleanAmount);
    console.log('Transfer result:', result);

    if (!result.success) {
      return { 
        success: false, 
        message: `Failed to send tip: ${result.error}`,
        code: result.code
      };
    }

    // Store the tip in the database
    const newTip = new Tip({
      senderId: sender.discordId,
      senderAddress: sender.address,
      recipientAddress,
      amount: cleanAmount,
      amountAfterFee: feeDetails.amountAfterFee, // Store amount after fees
      fee: feeDetails.fee,
      feePercentage: feeDetails.feePercentage,
      message,
      transactionHash: result.transactionHash,
      timestamp: new Date(),
      ethSent: result.ethSent || false,
      ethTransactionHash: result.ethSent ? result.ethTransactionUrl : null
    });

    await newTip.save();
    console.log('Tip saved to database');

    // Include ETH sending information if applicable
    return {
      success: true,
      transactionHash: result.transactionHash,
      transactionUrl: getTransactionUrl(result.transactionHash),
      amount: cleanAmount,
      amountAfterFee: feeDetails.amountAfterFee,
      fee: feeDetails.fee,
      feePercentage: feeDetails.feePercentage,
      ethSent: result.ethSent || false,
      ethTransactionUrl: result.ethSent ? result.ethTransactionUrl : null
    };
  } catch (error) {
    console.error('Error sending tip:', error);
    return { 
      success: false, 
      message: 'Error sending tip: ' + (error.message || 'Unknown error')
    };
  }
}

/**
 * Get tip history for a user
 * @param {string} userId - Discord ID of the user
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of tips per page
 * @returns {Promise<Object>} - Tip history with pagination info
 */
async function getUserTipHistory(userId, page = 1, limit = 5) {
  try {
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get sent tips
    const sentTips = await Tip.find({ senderId: userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count of sent tips
    const totalSentTips = await Tip.countDocuments({ senderId: userId });

    // Get received tips (need to find user's address first)
    const user = await User.findOne({ discordId: userId });
    let receivedTips = [];
    let totalReceivedTips = 0;

    if (user) {
      receivedTips = await Tip.find({ recipientAddress: user.walletAddress.toLowerCase() })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);

      totalReceivedTips = await Tip.countDocuments({ 
        recipientAddress: user.walletAddress.toLowerCase() 
      });
    }

    // Enhance the tips with display names
    const enhancedSentTips = await Promise.all(sentTips.map(async tip => {
      const displayName = await getDisplayNameForAddress(tip.recipientAddress);
      return {
        ...tip.toObject(),
        recipientDisplay: displayName
      };
    }));

    const enhancedReceivedTips = await Promise.all(receivedTips.map(async tip => {
      // Use the stored username if available, otherwise fetch it
      let senderDisplay = tip.senderUsername;
      if (!senderDisplay) {
        const senderUser = await User.findOne({ discordId: tip.senderId });
        senderDisplay = senderUser ? senderUser.username : 'Unknown User';
      }
      
      return {
        ...tip.toObject(),
        senderDisplay: senderDisplay
      };
    }));

    return {
      sent: {
        tips: enhancedSentTips,
        total: totalSentTips,
        page,
        limit,
        totalPages: Math.ceil(totalSentTips / limit)
      },
      received: {
        tips: enhancedReceivedTips,
        total: totalReceivedTips,
        page,
        limit,
        totalPages: Math.ceil(totalReceivedTips / limit)
      }
    };
  } catch (error) {
    console.error('Error getting user tip history:', error);
    return {
      sent: { tips: [], total: 0, page, limit, totalPages: 0 },
      received: { tips: [], total: 0, page, limit, totalPages: 0 }
    };
  }
}

/**
 * Get leaderboard data
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of users per page
 * @returns {Promise<Object>} - Leaderboard data with pagination info
 */
async function getLeaderboard(page = 1, limit = 5) {
  try {
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Aggregate to get top senders
    const topSenders = await Tip.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: {
          _id: '$senderId',
          totalSent: { $sum: '$amount' },
          count: { $sum: 1 },
          username: { $first: '$senderUsername' }
        }
      },
      { $sort: { totalSent: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    // Get total counts for pagination
    const totalSenders = await Tip.aggregate([
      { $group: { _id: '$senderId' } },
      { $count: 'total' }
    ]);

    // Enhance the data with user information
    const enhancedSenders = await Promise.all(topSenders.map(async sender => {
      // Use the stored username if available, otherwise fetch it
      let username = sender.username;
      if (!username) {
        const user = await User.findOne({ discordId: sender._id });
        username = user ? user.username : 'Unknown User';
      }
      
      return {
        ...sender,
        username: username,
        discordId: sender._id
      };
    }));

    // For receivers, we'll first retrieve all transactions
    const allTips = await Tip.find({ status: 'confirmed' });
    
    // Create a map to store information by display name
    const receiversByDisplayName = new Map();
    
    // Process each transaction to group by display name
    await Promise.all(allTips.map(async tip => {
      const displayName = await getDisplayNameForAddress(tip.recipientAddress);
      
      if (!receiversByDisplayName.has(displayName)) {
        receiversByDisplayName.set(displayName, {
          displayName,
          totalReceived: 0,
          count: 0,
          addresses: new Set()
        });
      }
      
      const receiver = receiversByDisplayName.get(displayName);
      receiver.totalReceived += tip.amount;
      receiver.count += 1;
      receiver.addresses.add(tip.recipientAddress);
    }));
    
    // Convert map to array and sort by total amount received
    let topReceivers = Array.from(receiversByDisplayName.values())
      .sort((a, b) => b.totalReceived - a.totalReceived)
      .slice(skip, skip + limit)
      .map(receiver => ({
        _id: Array.from(receiver.addresses)[0], // Use the first address as ID
        displayName: receiver.displayName,
        totalReceived: receiver.totalReceived,
        count: receiver.count,
        addresses: Array.from(receiver.addresses)
      }));
    
    // Calculer le nombre total de receveurs uniques pour la pagination
    const totalReceivers = receiversByDisplayName.size;

    return {
      senders: {
        data: enhancedSenders,
        total: totalSenders.length > 0 ? totalSenders[0].total : 0,
        page,
        limit,
        totalPages: Math.ceil((totalSenders.length > 0 ? totalSenders[0].total : 0) / limit)
      },
      receivers: {
        data: topReceivers,
        total: totalReceivers,
        page,
        limit,
        totalPages: Math.ceil(totalReceivers / limit)
      }
    };
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return {
      senders: { data: [], total: 0, page, limit, totalPages: 0 },
      receivers: { data: [], total: 0, page, limit, totalPages: 0 }
    };
  }
}

module.exports = {
  getTransactionUrl,
  getAddressUrl,
  sendTip,
  getUserTipHistory,
  getLeaderboard
}; 