const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema({
  // Informations sur l'expéditeur
  senderId: {
    type: String,
    required: true,
    index: true
  },
  senderUsername: {
    type: String,
    default: '',
    index: true
  },
  senderWalletAddress: {
    type: String,
    default: '',
    index: true
  },
  
  // Informations sur le destinataire
  recipientAddress: {
    type: String,
    required: true,
    index: true
  },
  
  // Détails de la transaction
  amount: {
    type: Number,
    required: true,
    index: true
  },
  message: {
    type: String,
    default: ''
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Métadonnées
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Ajouter des index composites pour les requêtes fréquentes
tipSchema.index({ senderId: 1, timestamp: -1 });
tipSchema.index({ recipientAddress: 1, timestamp: -1 });
tipSchema.index({ status: 1, timestamp: -1 });

module.exports = mongoose.model('Tip', tipSchema); 