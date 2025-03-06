const { ethers } = require('ethers');
const { provider, RLUSD_CONTRACT_ADDRESS, PAYMASTER_CONTRACT_ADDRESS, rlusdContract } = require('./ethereumUtils');
const rlusdPaymasterABI = require('../contracts/rlusdPaymasterABI.json');
require('dotenv').config();

// Initialization of the PayMaster contract
const paymasterContract = new ethers.Contract(
  PAYMASTER_CONTRACT_ADDRESS,
  rlusdPaymasterABI,
  provider
);

/**
 * Calculate fees for a given RLUSD amount
 * @param {string|number} amount - RLUSD amount
 * @returns {Object} - Fee details
 */
function calculateFees(amount) {
  // Convert to number for calculations
  const amountNum = parseFloat(amount);
  
  // Define fee tiers
  let feePercentage = 0;
  
  if (amountNum < 1) {
    // Minimum required amount
    return {
      originalAmount: amountNum,
      fee: 0,
      amountAfterFee: 0,
      feePercentage: 0,
      error: "The minimum amount is 1 RLUSD"
    };
  } else if (amountNum < 5) {
    feePercentage = 10;
  } else if (amountNum < 10) {
    feePercentage = 8;
  } else if (amountNum < 25) {
    feePercentage = 6;
  } else if (amountNum < 50) {
    feePercentage = 4;
  } else if (amountNum < 100) {
    feePercentage = 2;
  } else {
    feePercentage = 1;
  }
  
  // Calculate fees
  const fee = (amountNum * feePercentage) / 100;
  const amountAfterFee = amountNum - fee;
  
  return {
    originalAmount: amountNum,
    fee: fee,
    amountAfterFee: amountAfterFee,
    feePercentage: feePercentage
  };
}

/**
 * Transfer RLUSD via the PayMaster contract
 * @param {string} privateKey - Sender's private key
 * @param {string} toAddress - Recipient's address
 * @param {string|number} amount - Amount of RLUSD to send
 * @returns {Promise<Object>} - Transaction details
 */
async function transferViaPaymaster(privateKey, toAddress, amount) {
  try {
    console.log('transferViaPaymaster called with amount:', amount, 'type:', typeof amount);
    
    // Create a wallet with the private key
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log('Wallet address:', wallet.address);
    
    // Check ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    console.log('ETH balance:', ethers.formatEther(ethBalance));
    
    // Check if user has less than 0.01 ETH
    const MIN_ETH_THRESHOLD = ethers.parseEther("0.01");
    if (ethBalance < MIN_ETH_THRESHOLD) {
      console.log('Insufficient ETH balance. Automatically sending 0.015 ETH from admin wallet...');
      
      // Import sendEthFromAdmin function
      const { sendEthFromAdmin } = require('./walletUtils');
      
      // Send 0.015 ETH from admin wallet
      const ethSendResult = await sendEthFromAdmin(wallet.address, "0.015");
      
      if (!ethSendResult.success) {
        console.error('Failed to send ETH from admin wallet:', ethSendResult.error);
        return {
          success: false,
          error: "Unable to send ETH to cover transaction fees. Please try again later.",
          code: "ETH_FUNDING_FAILED"
        };
      }
      
      console.log('ETH sent successfully. Transaction hash:', ethSendResult.transactionHash);
      
      // Wait a bit for the transaction to be confirmed and balance to be updated
      console.log('Waiting for ETH balance update...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Check new ETH balance
      const newEthBalance = await provider.getBalance(wallet.address);
      console.log('New ETH balance after funding:', ethers.formatEther(newEthBalance));
      
      // Store ETH sending information for inclusion in final result
      var ethSent = true;
      var ethTransactionUrl = `https://sepolia.etherscan.io/tx/${ethSendResult.transactionHash}`;
    } else {
      var ethSent = false;
      var ethTransactionUrl = null;
    }
    
    // Use admin wallet with RLUSD and ETH
    const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
    console.log('Admin wallet address:', adminWallet.address);
    
    // Clean and validate amount
    let amountStr = amount.toString().trim();
    console.log('Amount after toString().trim():', amountStr);
    
    // Replace commas with dots (for European formats)
    amountStr = amountStr.replace(',', '.');
    console.log('Amount after replacing comma:', amountStr);
    
    // Ensure there's only one decimal point
    const parts = amountStr.split('.');
    if (parts.length > 2) {
      amountStr = parts[0] + '.' + parts.slice(1).join('');
    }
    console.log('Amount after correcting multiple points:', amountStr);
    
    // Check if amount is a valid number
    if (isNaN(parseFloat(amountStr)) || !isFinite(parseFloat(amountStr))) {
      console.error('Invalid amount after cleaning:', amountStr);
      return {
        success: false,
        error: "The amount is not a valid number. Please use only digits and one decimal point (ex: 10.5).",
        code: "INVALID_AMOUNT"
      };
    }
    
    console.log('Amount for parseUnits:', amountStr);
    
    try {
      // Ensure format is correct for parseUnits (no special characters)
      // Convert to number then to string to normalize format
      const normalizedAmount = parseFloat(amountStr).toString();
      console.log('Normalized amount:', normalizedAmount);
      
      // Check if normalized amount is valid
      if (isNaN(parseFloat(normalizedAmount)) || !isFinite(parseFloat(normalizedAmount))) {
        console.error('Invalid normalized amount:', normalizedAmount);
        return {
          success: false,
          error: "Error normalizing amount. Please try with a simple amount (ex: 10).",
          code: "NORMALIZATION_ERROR"
        };
      }
      
      // Convert amount to units with decimals (18 for RLUSD)
      let amountToSend;
      try {
        amountToSend = ethers.parseUnits(normalizedAmount, 18);
        console.log('Amount to send (in wei):', amountToSend.toString());
      } catch (parseUnitsError) {
        console.error('Error in parseUnits:', parseUnitsError);
        return {
          success: false,
          error: "Error in amount conversion. Please use a simple format (ex: 10).",
          code: "PARSE_UNITS_ERROR",
          details: parseUnitsError.message
        };
      }
      
      // Check if amount is valid for the contract
      try {
        const feeEstimate = await paymasterContract.calculateFee(amountToSend);
        console.log('Fee estimation:', ethers.formatUnits(feeEstimate, 18));
        
        // Check if amount is sufficient (at least 1 RLUSD)
        if (amountToSend < ethers.parseUnits("1", 18)) {
          return {
            success: false,
            error: "Amount too low. Minimum amount is 1 RLUSD.",
            code: "AMOUNT_TOO_LOW"
          };
        }
      } catch (estimateError) {
        console.error('Error in fee estimation:', estimateError);
      }
      
      // Check RLUSD balance of user
      const userRlusdBalance = await rlusdContract.balanceOf(wallet.address);
      console.log('RLUSD balance of user:', ethers.formatUnits(userRlusdBalance, 18));
      
      // Check if RLUSD balance of user is sufficient
      if (userRlusdBalance < amountToSend) {
        return {
          success: false,
          error: "Insufficient RLUSD balance for this transfer. Get RLUSD test on https://tryrlusd.com/",
          code: "INSUFFICIENT_USER_RLUSD"
        };
      }
      
      // Connect RLUSD contract with user wallet
      const rlusdWithUserSigner = rlusdContract.connect(wallet);
      
      // Check user allowance for PayMaster contract
      const userAllowance = await rlusdContract.allowance(wallet.address, PAYMASTER_CONTRACT_ADDRESS);
      console.log('User allowance:', ethers.formatUnits(userAllowance, 18));
      
      // If allowance is insufficient, approve first contract
      if (userAllowance < amountToSend) {
        console.log('Approval necessary for user. Sending approval transaction...');
        
        // Approve a high amount to avoid future approvals
        const approveTx = await rlusdWithUserSigner.approve(
          PAYMASTER_CONTRACT_ADDRESS,
          ethers.parseUnits("1000000", 18),
          {
            gasLimit: 100000 // Fixed gas limit for approval
          }
        );
        
        console.log('Approved transaction sent:', approveTx.hash);
        
        // Wait for approval confirmation
        console.log('Waiting for approval confirmation...');
        const approveReceipt = await approveTx.wait();
        console.log('Approval confirmed:', approveReceipt.hash);
        
        // Check allowance again after approval
        const newUserAllowance = await rlusdContract.allowance(wallet.address, PAYMASTER_CONTRACT_ADDRESS);
        console.log('New user allowance after approval:', ethers.formatUnits(newUserAllowance, 18));
        
        if (newUserAllowance < amountToSend) {
          return {
            success: false,
            error: "Contract approval failed. Please try again.",
            code: "APPROVAL_FAILED"
          };
        }
      }
      
      // Connect PayMaster contract with user wallet
      const paymasterWithUserSigner = paymasterContract.connect(wallet);
      
      // Check ETH balance again before executing transaction
      const currentEthBalance = await provider.getBalance(wallet.address);
      console.log('Current ETH balance before transaction:', ethers.formatEther(currentEthBalance));
      
      // Estimate gas cost of transaction
      const gasEstimate = await paymasterWithUserSigner.transferRLUSD.estimateGas(
        toAddress,
        amountToSend
      ).catch(() => ethers.parseUnits("300000", "wei")); // Use 300000 as fallback
      
      const gasPrice = await provider.getFeeData();
      const estimatedGasCost = gasEstimate * gasPrice.gasPrice;
      console.log('Estimated gas cost:', ethers.formatEther(estimatedGasCost));
      
      // Check if ETH balance is sufficient to cover gas fees
      if (currentEthBalance < estimatedGasCost) {
        console.log('ETH balance still insufficient to cover gas fees.');
        
        // If ETH has already been sent once, send more ETH
        if (ethSent) {
          console.log('Sending additional 0.02 ETH from admin wallet...');
          
          // Import sendEthFromAdmin if not already done
          const { sendEthFromAdmin } = require('./walletUtils');
          
          const additionalEthSendResult = await sendEthFromAdmin(wallet.address, "0.02");
          
          if (!additionalEthSendResult.success) {
            console.error('Failed to send additional ETH:', additionalEthSendResult.error);
            return {
              success: false,
              error: "Unable to send sufficient ETH to cover transaction fees. Please try again later.",
              code: "ETH_FUNDING_FAILED"
            };
          }
          
          console.log('Additional ETH sent successfully. Transaction hash:', additionalEthSendResult.transactionHash);
          
          // Wait a bit for transaction to be confirmed
          console.log('Waiting for ETH balance update...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          
          // Update ETH transaction URL
          ethTransactionUrl = `https://sepolia.etherscan.io/tx/${additionalEthSendResult.transactionHash}`;
        } else {
          return {
            success: false,
            error: "Insufficient ETH balance to cover transaction fees. Please try again later.",
            code: "INSUFFICIENT_ETH"
          };
        }
      }
      
      // Now, execute the transaction via PayMaster
      try {
        // Create transfer transaction
        const transferTx = await paymasterWithUserSigner.transferRLUSD(
          toAddress, // Recipient address
          amountToSend,
          {
            gasLimit: 300000 // Fixed gas limit for transfer
          }
        );
        
        console.log('Transaction sent:', transferTx.hash);
        
        // Wait for transaction confirmation
        console.log('Waiting for confirmation...');
        const receipt = await transferTx.wait();
        console.log('Transaction confirmed:', receipt.hash);
        
        // Calculate applied fees
        const fees = calculateFees(ethers.formatUnits(amountToSend, 18));
        
        return {
          success: true,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          link: `https://sepolia.etherscan.io/tx/${receipt.hash}`,
          fees: fees,
          // Include ETH sending information
          ethSent: ethSent,
          ethTransactionUrl: ethTransactionUrl
        };
      } catch (transferError) {
        console.error('Error in transfer:', transferError);
        
        // Analyze error for more precise message
        if (transferError.message.includes("execution reverted")) {
          return {
            success: false,
            error: "Contract rejected transaction. Check if amount is at least 1 RLUSD.",
            code: "CONTRACT_REVERTED",
            details: transferError.message
          };
        }
        
        return {
          success: false,
          error: "Error in transfer. Please try again.",
          code: "TRANSFER_ERROR",
          details: transferError.message
        };
      }
    } catch (parseError) {
      console.error('Error in amount parsing:', parseError);
      return {
        success: false,
        error: "Numeric conversion error. Ensure amount is valid and uses only digits and one decimal point (ex: 10.5).",
        code: "PARSE_ERROR",
        details: parseError.message
      };
    }
  } catch (error) {
    console.error('Error in transfer via PayMaster:', error);
    
    // Analyze error for more precise message
    let errorMessage = error.message || "Unknown error";
    let errorCode = "UNKNOWN_ERROR";
    
    if (errorMessage.includes("insufficient funds")) {
      errorCode = "INSUFFICIENT_FUNDS";
    } else if (errorMessage.includes("user rejected")) {
      errorCode = "USER_REJECTED";
    } else if (errorMessage.includes("gas required exceeds allowance")) {
      errorCode = "GAS_LIMIT_EXCEEDED";
    } else if (errorMessage.includes("nonce")) {
      errorCode = "NONCE_ERROR";
    } else if (errorMessage.includes("BigInt")) {
      errorCode = "BIGINT_ERROR";
      errorMessage = "Numeric conversion error. Ensure amount is valid and uses only digits and one decimal point (ex: 10.5).";
    } else if (errorMessage.includes("execution reverted")) {
      // Check if it's a minimum amount error
      if (errorMessage.includes("Amount too low")) {
        errorCode = "AMOUNT_TOO_LOW";
        errorMessage = "Minimum amount is 1 RLUSD.";
      } else if (errorMessage.includes("Insufficient RLUSD balance")) {
        errorCode = "INSUFFICIENT_RLUSD";
        errorMessage = "Insufficient RLUSD balance for this transfer.";
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      code: errorCode,
      originalError: error.toString()
    };
  }
}

/**
 * Get a fee estimate for a transfer without executing it
 * @param {string|number} amount - RLUSD amount
 * @returns {Promise<Object>} - Fee estimate
 */
async function getTransferFeeEstimate(amount) {
  try {
    // Use local function to calculate fees
    return calculateFees(amount);
  } catch (error) {
    console.error('Error in fee estimation:', error);
    return {
      success: false,
      error: error.message || "Error in fee estimation"
    };
  }
}

/**
 * Get fee tier information
 * @returns {Array<Object>} - Fee tier array
 */
function getFeeTiers() {
  return [
    { min: 1, max: 4.99, percentage: 10 },
    { min: 5, max: 9.99, percentage: 8 },
    { min: 10, max: 24.99, percentage: 6 },
    { min: 25, max: 49.99, percentage: 4 },
    { min: 50, max: 99.99, percentage: 2 },
    { min: 100, max: Infinity, percentage: 1 }
  ];
}

/**
 * Get collected fees balance of PayMaster contract
 * @returns {Promise<string>} - Collected fees balance
 */
async function getCollectedFees() {
  try {
    // This function assumes the contract has a method to get collected fees
    // If not, we can simply return the contract RLUSD balance
    const balance = await paymasterContract.getCollectedFees();
    return ethers.formatUnits(balance, 18);
  } catch (error) {
    console.error('Error in getting collected fees:', error);
    throw error;
  }
}

module.exports = {
  calculateFees,
  transferViaPaymaster,
  getTransferFeeEstimate,
  getFeeTiers,
  getCollectedFees,
  PAYMASTER_CONTRACT_ADDRESS
}; 