// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title RLUSDPaymaster
 * @dev Contract that allows charging fees on RLUSD transfers
 * while paying gas fees in Sepolia ETH
 */
contract RLUSDPaymaster is Ownable {
    using SafeMath for uint256;
    
    // RLUSD token address
    IERC20 public rlusdToken;
    
    // Structure to define a fee tier
    struct FeeTier {
        uint256 threshold;     // Threshold in RLUSD (18 decimals)
        uint256 feePercentage; // Percentage in basis points (100 = 1%)
    }
    
    // Array of fee tiers (sorted by ascending threshold)
    FeeTier[] public feeTiers;
    
    // Absolute minimum fee in RLUSD
    uint256 public minimumFee;
    
    // Balance of collected fees in RLUSD
    uint256 public collectedFees;
    
    // Events
    event TransferExecuted(address indexed from, address indexed to, uint256 amount, uint256 fee);
    event FeeTiersUpdated();
    event MinimumFeeChanged(uint256 oldMinFee, uint256 newMinFee);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event EthReceived(address indexed sender, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _rlusdToken RLUSD contract address
     * @param _minimumFee Absolute minimum fee in RLUSD
     */
    constructor(address _rlusdToken, uint256 _minimumFee) Ownable(msg.sender) {
        require(_rlusdToken != address(0), "Invalid RLUSD token address");
        
        rlusdToken = IERC20(_rlusdToken);
        minimumFee = _minimumFee;
        
        // Initialization of fee tiers according to specifications
        
        // 10% for amounts starting from 1 RLUSD
        feeTiers.push(FeeTier(1 * 1e18, 1000));
        
        // 8% for amounts starting from 5 RLUSD
        feeTiers.push(FeeTier(5 * 1e18, 800));
        
        // 6% for amounts starting from 10 RLUSD
        feeTiers.push(FeeTier(10 * 1e18, 600));
        
        // 4% for amounts starting from 25 RLUSD
        feeTiers.push(FeeTier(25 * 1e18, 400));
        
        // 2% for amounts starting from 50 RLUSD
        feeTiers.push(FeeTier(50 * 1e18, 300));
        
        // 1% for amounts starting from 100 RLUSD
        feeTiers.push(FeeTier(100 * 1e18, 200));
        
        // 0.75% for amounts above 100 RLUSD (default tier)
        feeTiers.push(FeeTier(type(uint256).max, 75));
    }
    
    /**
     * @dev Function to receive ETH (necessary to pay gas fees)
     */
    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }
    
    /**
     * @dev Calculate fees for a given amount based on tiers
     * @param _amount Amount in RLUSD
     * @return fee Amount of fees
     */
    function calculateFee(uint256 _amount) public view returns (uint256) {
        // If amount is below the first tier, apply minimum fee
        if (_amount < feeTiers[0].threshold) {
            return minimumFee;
        }
        
        uint256 applicableFeePercentage = feeTiers[feeTiers.length - 1].feePercentage;
        
        // Find applicable tier
        for (uint256 i = 0; i < feeTiers.length - 1; i++) {
            if (_amount >= feeTiers[i].threshold && _amount < feeTiers[i + 1].threshold) {
                applicableFeePercentage = feeTiers[i].feePercentage;
                break;
            }
        }
        
        // Calculate fees based on percentage
        uint256 percentageFee = _amount.mul(applicableFeePercentage).div(10000);
        
        // Apply minimum if necessary
        return percentageFee > minimumFee ? percentageFee : minimumFee;
    }
    
    /**
     * @dev Execute a RLUSD transfer with fee deduction
     * @param _to Recipient address
     * @param _amount Amount in RLUSD to transfer
     * @return actualFee Amount of fees deducted
     */
    function transferRLUSD(address _to, uint256 _amount) external returns (uint256) {
        require(_to != address(0), "Invalid recipient address");
        require(_amount > 0, "Amount must be greater than 0");
        
        // Calculate fees
        uint256 fee = calculateFee(_amount);
        
        // Ensure fees do not exceed total amount
        require(fee < _amount, "Fee exceeds transfer amount");
        
        uint256 amountAfterFee = _amount.sub(fee);
        
        // Transfer RLUSD from user to this contract
        require(rlusdToken.transferFrom(msg.sender, address(this), _amount), "Transfer from sender failed");
        
        // Transfer amount after fees to recipient
        require(rlusdToken.transfer(_to, amountAfterFee), "Transfer to recipient failed");
        
        // Add fees to collected balance
        collectedFees = collectedFees.add(fee);
        
        emit TransferExecuted(msg.sender, _to, amountAfterFee, fee);
        
        return fee;
    }
    
    /**
     * @dev Allow user to approve and transfer in one transaction
     * @param _to Recipient address
     * @param _amount Amount in RLUSD to transfer
     * @return actualFee Amount of fees deducted
     */
    function approveAndTransfer(address _to, uint256 _amount) external returns (uint256) {
        // Approve this contract to spend user's RLUSD
        require(rlusdToken.approve(address(this), _amount), "Approval failed");
        
        // Execute transfer
        return this.transferRLUSD(_to, _amount);
    }
    
    /**
     * @dev Get fees for a transfer without executing
     * @param _amount Amount in RLUSD to transfer
     * @return fee Amount of fees
     * @return amountAfterFee Amount after fees deduction
     */
    function getTransferFeeEstimate(uint256 _amount) external view returns (uint256 fee, uint256 amountAfterFee) {
        fee = calculateFee(_amount);
        amountAfterFee = _amount > fee ? _amount.sub(fee) : 0;
        return (fee, amountAfterFee);
    }
    
    /**
     * @dev Update fee tiers (reserved for owner)
     * @param _thresholds Array of thresholds in RLUSD
     * @param _percentages Corresponding percentages (in basis points)
     */
    function updateFeeTiers(uint256[] calldata _thresholds, uint256[] calldata _percentages) external onlyOwner {
        require(_thresholds.length == _percentages.length, "Arrays length mismatch");
        require(_thresholds.length > 0, "Empty arrays");
        
        // Clear existing array
        delete feeTiers;
        
        // Add new tiers
        for (uint256 i = 0; i < _thresholds.length; i++) {
            require(_percentages[i] <= 10000, "Fee percentage cannot exceed 100%");
            
            // If this is not the last element, ensure thresholds are in ascending order
            if (i < _thresholds.length - 1) {
                require(_thresholds[i] < _thresholds[i + 1], "Thresholds must be in ascending order");
            }
            
            feeTiers.push(FeeTier(_thresholds[i], _percentages[i]));
        }
        
        // Add default tier for amounts above the last threshold
        if (_thresholds[_thresholds.length - 1] != type(uint256).max) {
            feeTiers.push(FeeTier(type(uint256).max, _percentages[_percentages.length - 1]));
        }
        
        emit FeeTiersUpdated();
    }
    
    /**
     * @dev Modify minimum fees (reserved for owner)
     * @param _minimumFee New minimum fee amount
     */
    function setMinimumFee(uint256 _minimumFee) external onlyOwner {
        uint256 oldMinFee = minimumFee;
        minimumFee = _minimumFee;
        
        emit MinimumFeeChanged(oldMinFee, minimumFee);
    }
    
    /**
     * @dev Withdraw collected fees in RLUSD (reserved for owner)
     * @param _to Recipient address to send fees
     * @param _amount Amount to withdraw (0 to withdraw all)
     */
    function withdrawFees(address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid recipient address");
        
        uint256 amountToWithdraw = _amount;
        if (_amount == 0 || _amount > collectedFees) {
            amountToWithdraw = collectedFees;
        }
        
        require(amountToWithdraw > 0, "No fees to withdraw");
        
        collectedFees = collectedFees.sub(amountToWithdraw);
        require(rlusdToken.transfer(_to, amountToWithdraw), "Fee transfer failed");
        
        emit FeesWithdrawn(_to, amountToWithdraw);
    }
    
    /**
     * @dev Withdraw ETH from contract (reserved for owner)
     * @param _to Recipient address to send ETH
     * @param _amount Amount to withdraw (0 to withdraw all)
     */
    function withdrawEth(address payable _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid recipient address");
        
        uint256 balance = address(this).balance;
        uint256 amountToWithdraw = _amount == 0 || _amount > balance ? balance : _amount;
        
        require(amountToWithdraw > 0, "No ETH to withdraw");
        
        (bool success, ) = _to.call{value: amountToWithdraw}("");
        require(success, "ETH withdrawal failed");
    }
    
    /**
     * @dev Get fee tiers count
     * @return count Number of tiers
     */
    function getFeeTiersCount() external view returns (uint256) {
        return feeTiers.length;
    }
    
    /**
     * @dev Get information about a fee tier
     * @param _index Tier index
     * @return threshold Tier threshold
     * @return feePercentage Tier fee percentage
     */
    function getFeeTier(uint256 _index) external view returns (uint256 threshold, uint256 feePercentage) {
        require(_index < feeTiers.length, "Index out of bounds");
        return (feeTiers[_index].threshold, feeTiers[_index].feePercentage);
    }
} 