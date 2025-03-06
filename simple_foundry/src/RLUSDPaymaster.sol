// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title RLUSDPaymaster
 * @dev Contrat qui permet de prélever des frais sur les transferts de RLUSD
 * tout en payant les frais de gas en ETH Sepolia
 */
contract RLUSDPaymaster is Ownable {
    using SafeMath for uint256;
    
    // Adresse du token RLUSD
    IERC20 public rlusdToken;
    
    // Structure pour définir un palier de frais
    struct FeeTier {
        uint256 threshold;     // Seuil en RLUSD (18 décimales)
        uint256 feePercentage; // Pourcentage en points de base (100 = 1%)
    }
    
    // Tableau des paliers de frais (triés par seuil croissant)
    FeeTier[] public feeTiers;
    
    // Frais minimum absolu en RLUSD
    uint256 public minimumFee;
    
    // Solde des frais collectés en RLUSD
    uint256 public collectedFees;
    
    // Événements
    event TransferExecuted(address indexed from, address indexed to, uint256 amount, uint256 fee);
    event FeeTiersUpdated();
    event MinimumFeeChanged(uint256 oldMinFee, uint256 newMinFee);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event EthReceived(address indexed sender, uint256 amount);
    
    /**
     * @dev Constructeur
     * @param _rlusdToken Adresse du contrat RLUSD
     * @param _minimumFee Frais minimum absolu en RLUSD
     */
    constructor(address _rlusdToken, uint256 _minimumFee) {
        require(_rlusdToken != address(0), "Invalid RLUSD token address");
        
        rlusdToken = IERC20(_rlusdToken);
        minimumFee = _minimumFee;
        
        // Initialisation des paliers de frais selon les spécifications
        
        // 10% pour les montants à partir de 1 RLUSD
        feeTiers.push(FeeTier(1 * 1e18, 1000));
        
        // 8% pour les montants à partir de 5 RLUSD
        feeTiers.push(FeeTier(5 * 1e18, 800));
        
        // 6% pour les montants à partir de 10 RLUSD
        feeTiers.push(FeeTier(10 * 1e18, 600));
        
        // 4% pour les montants à partir de 25 RLUSD
        feeTiers.push(FeeTier(25 * 1e18, 400));
        
        // 2% pour les montants à partir de 50 RLUSD
        feeTiers.push(FeeTier(50 * 1e18, 200));
        
        // 1% pour les montants à partir de 100 RLUSD et au-delà
        feeTiers.push(FeeTier(100 * 1e18, 100));
    }
    
    /**
     * @dev Fonction pour recevoir ETH (nécessaire pour payer les frais de gas)
     */
    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }
    
    /**
     * @dev Calcule les frais pour un montant donné selon les paliers
     * @param _amount Montant de RLUSD
     * @return fee Montant des frais
     */
    function calculateFee(uint256 _amount) public view returns (uint256) {
        // Rejeter les montants inférieurs à 1 RLUSD
        require(_amount >= 1 * 1e18, "Amount must be at least 1 RLUSD");
        
        uint256 applicableFeePercentage = feeTiers[feeTiers.length - 1].feePercentage;
        
        // Trouver le palier applicable
        for (uint256 i = 0; i < feeTiers.length - 1; i++) {
            if (_amount >= feeTiers[i].threshold && _amount < feeTiers[i + 1].threshold) {
                applicableFeePercentage = feeTiers[i].feePercentage;
                break;
            }
        }
        
        // Si le montant est supérieur ou égal au dernier seuil, appliquer le dernier pourcentage
        if (_amount >= feeTiers[feeTiers.length - 1].threshold) {
            applicableFeePercentage = feeTiers[feeTiers.length - 1].feePercentage;
        }
        
        // Calculer les frais basés sur le pourcentage
        uint256 percentageFee = _amount.mul(applicableFeePercentage).div(10000);
        
        // Appliquer le minimum si nécessaire
        return percentageFee > minimumFee ? percentageFee : minimumFee;
    }
    
    /**
     * @dev Exécute un transfert de RLUSD avec prélèvement de frais
     * @param _to Adresse du destinataire
     * @param _amount Montant de RLUSD à transférer
     * @return actualFee Montant des frais prélevés
     */
    function transferRLUSD(address _to, uint256 _amount) external returns (uint256) {
        require(_to != address(0), "Invalid recipient address");
        require(_amount >= 1 * 1e18, "Amount must be at least 1 RLUSD");
        
        // Calculer les frais
        uint256 fee = calculateFee(_amount);
        
        // S'assurer que les frais ne dépassent pas le montant total
        require(fee < _amount, "Fee exceeds transfer amount");
        
        uint256 amountAfterFee = _amount.sub(fee);
        
        // Transférer les RLUSD de l'utilisateur vers ce contrat
        require(rlusdToken.transferFrom(msg.sender, address(this), _amount), "Transfer from sender failed");
        
        // Transférer le montant après frais au destinataire
        require(rlusdToken.transfer(_to, amountAfterFee), "Transfer to recipient failed");
        
        // Ajouter les frais au solde collecté
        collectedFees = collectedFees.add(fee);
        
        emit TransferExecuted(msg.sender, _to, amountAfterFee, fee);
        
        return fee;
    }
    
    /**
     * @dev Permet à l'utilisateur d'approuver et de transférer en une seule transaction
     * @param _to Adresse du destinataire
     * @param _amount Montant de RLUSD à transférer
     * @return actualFee Montant des frais prélevés
     */
    function approveAndTransfer(address _to, uint256 _amount) external returns (uint256) {
        require(_amount >= 1 * 1e18, "Amount must be at least 1 RLUSD");
        
        // Approuver le contrat à dépenser les RLUSD de l'utilisateur
        require(rlusdToken.approve(address(this), _amount), "Approval failed");
        
        // Exécuter le transfert
        return this.transferRLUSD(_to, _amount);
    }
    
    /**
     * @dev Obtient le montant des frais pour un transfert sans l'exécuter
     * @param _amount Montant de RLUSD à transférer
     * @return fee Montant des frais
     * @return amountAfterFee Montant après déduction des frais
     */
    function getTransferFeeEstimate(uint256 _amount) external view returns (uint256 fee, uint256 amountAfterFee) {
        // Vérifier que le montant est d'au moins 1 RLUSD
        if (_amount < 1 * 1e18) {
            return (0, 0); // Retourner 0 pour indiquer que le transfert serait rejeté
        }
        
        fee = calculateFee(_amount);
        amountAfterFee = _amount > fee ? _amount.sub(fee) : 0;
        return (fee, amountAfterFee);
    }
    
    /**
     * @dev Mettre à jour les paliers de frais (réservé au propriétaire)
     * @param _thresholds Tableau des seuils en RLUSD
     * @param _percentages Tableau des pourcentages correspondants (en points de base)
     */
    function updateFeeTiers(uint256[] calldata _thresholds, uint256[] calldata _percentages) external onlyOwner {
        require(_thresholds.length == _percentages.length, "Arrays length mismatch");
        require(_thresholds.length > 0, "Empty arrays");
        
        // Vider le tableau existant
        delete feeTiers;
        
        // Ajouter les nouveaux paliers
        for (uint256 i = 0; i < _thresholds.length; i++) {
            require(_percentages[i] <= 10000, "Fee percentage cannot exceed 100%");
            
            // Si ce n'est pas le dernier élément, vérifier que les seuils sont croissants
            if (i < _thresholds.length - 1) {
                require(_thresholds[i] < _thresholds[i + 1], "Thresholds must be in ascending order");
            }
            
            feeTiers.push(FeeTier(_thresholds[i], _percentages[i]));
        }
        
        // Ajouter un palier par défaut pour les montants supérieurs au dernier seuil
        if (_thresholds[_thresholds.length - 1] != type(uint256).max) {
            feeTiers.push(FeeTier(type(uint256).max, _percentages[_percentages.length - 1]));
        }
        
        emit FeeTiersUpdated();
    }
    
    /**
     * @dev Modifier les frais minimum (réservé au propriétaire)
     * @param _minimumFee Nouveau montant minimum de frais
     */
    function setMinimumFee(uint256 _minimumFee) external onlyOwner {
        uint256 oldMinFee = minimumFee;
        minimumFee = _minimumFee;
        
        emit MinimumFeeChanged(oldMinFee, minimumFee);
    }
    
    /**
     * @dev Retirer les frais collectés en RLUSD (réservé au propriétaire)
     * @param _to Adresse à laquelle envoyer les frais
     * @param _amount Montant à retirer (0 pour tout retirer)
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
     * @dev Retirer l'ETH du contrat (réservé au propriétaire)
     * @param _to Adresse à laquelle envoyer l'ETH
     * @param _amount Montant à retirer (0 pour tout retirer)
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
     * @dev Obtient le nombre de paliers de frais
     * @return count Nombre de paliers
     */
    function getFeeTiersCount() external view returns (uint256) {
        return feeTiers.length;
    }
    
    /**
     * @dev Obtient les informations d'un palier de frais
     * @param _index Index du palier
     * @return threshold Seuil du palier
     * @return feePercentage Pourcentage de frais du palier
     */
    function getFeeTier(uint256 _index) external view returns (uint256 threshold, uint256 feePercentage) {
        require(_index < feeTiers.length, "Index out of bounds");
        return (feeTiers[_index].threshold, feeTiers[_index].feePercentage);
    }
} 