// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RLUSDPaymaster.sol";

contract DeployPaymaster is Script {
    function run() external {
        // Récupérer les variables d'environnement
        string memory rlusdAddressStr = vm.envString("RLUSD_CONTRACT_ADDRESS");
        address rlusdAddress = vm.parseAddress(rlusdAddressStr);
        
        uint256 deployerPrivateKey = vm.envUint("ADMIN_PRIVATE_KEY");
        uint256 minimumFee = 0.01 ether; // 0.01 RLUSD (18 décimales)
        
        // Commencer le broadcast (transactions réelles)
        vm.startBroadcast(deployerPrivateKey);
        
        // Déployer le contrat
        RLUSDPaymaster paymaster = new RLUSDPaymaster(rlusdAddress, minimumFee);
        
        // Terminer le broadcast
        vm.stopBroadcast();
        
        // Afficher l'adresse du contrat déployé
        console.log("PayMaster deployed at:", address(paymaster));
    }
} 