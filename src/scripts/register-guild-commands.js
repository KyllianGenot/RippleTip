require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ID du serveur Discord
const GUILD_ID = '1344827466799255625';

// Fonction pour enregistrer les commandes sur un serveur spécifique
async function registerGuildCommands() {
  try {
    console.log(`Début de l'enregistrement des commandes slash pour le serveur ${GUILD_ID}...`);
    
    // Vérifier les variables d'environnement nécessaires
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN non défini dans le fichier .env');
    }
    
    if (!process.env.DISCORD_APPLICATION_ID) {
      throw new Error('DISCORD_APPLICATION_ID non défini dans le fichier .env');
    }
    
    // Créer un tableau pour stocker les commandes
    const commands = [];
    
    // Lire les fichiers de commandes
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    // Charger chaque commande
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`Commande chargée: ${command.data.name}`);
      } else {
        console.log(`[AVERTISSEMENT] La commande à ${filePath} manque de propriétés requises.`);
      }
    }
    
    // Créer une instance REST pour envoyer les commandes à Discord
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    // Enregistrer les commandes
    console.log(`Tentative d'enregistrement de ${commands.length} commandes slash sur le serveur...`);
    
    // Enregistrer les commandes sur le serveur spécifique
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APPLICATION_ID, GUILD_ID),
      { body: commands },
    );
    
    console.log(`✅ ${data.length} commandes slash enregistrées avec succès sur le serveur!`);
    console.log('Les commandes devraient être disponibles immédiatement.');
    
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des commandes:', error);
  }
}

// Exécuter la fonction
registerGuildCommands(); 