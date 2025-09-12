const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { dialog } = require('electron');
const axios = require('axios');

class UpdateManager {
  constructor() {
    this.repoUrl = 'https://github.com/Valloue/WEB2PWA.git';
    this.repoApiUrl = 'https://api.github.com/repos/Valloue/WEB2PWA';
    this.appPath = __dirname;
    this.updateConfigPath = path.join(this.appPath, 'update-config.json');
    this.updateConfig = this.loadUpdateConfig();
  }

  // Charger la configuration de mise à jour
  loadUpdateConfig() {
    try {
      if (fs.existsSync(this.updateConfigPath)) {
        const data = fs.readFileSync(this.updateConfigPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la config de mise à jour:', error);
    }
    
    return {
      autoUpdate: false,
      lastCheck: null,
      lastUpdate: null,
      currentVersion: '1.0.0'
    };
  }

  // Sauvegarder la configuration de mise à jour
  saveUpdateConfig() {
    try {
      fs.writeFileSync(this.updateConfigPath, JSON.stringify(this.updateConfig, null, 2));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la config de mise à jour:', error);
    }
  }

  // Vérifier les mises à jour disponibles
  async checkForUpdates() {
    try {
      console.log('🔍 Vérification des mises à jour...');
      
      // Récupérer les informations du dépôt
      const repoInfo = await this.fetchRepoInfo();
      if (!repoInfo) {
        throw new Error('Impossible de récupérer les informations du dépôt');
      }

      const latestCommit = repoInfo.commit;
      const currentCommit = await this.getCurrentCommit();
      
      console.log(`📊 Commit actuel: ${currentCommit?.substring(0, 7) || 'Inconnu'}`);
      console.log(`📊 Dernier commit: ${latestCommit?.sha?.substring(0, 7) || 'Inconnu'}`);

      const hasUpdate = currentCommit !== latestCommit?.sha;
      
      // Mettre à jour la config
      this.updateConfig.lastCheck = new Date().toISOString();
      this.saveUpdateConfig();

      return {
        hasUpdate,
        currentCommit,
        latestCommit: latestCommit?.sha,
        updateDate: latestCommit?.commit?.committer?.date,
        message: latestCommit?.commit?.message
      };

    } catch (error) {
      console.error('❌ Erreur lors de la vérification des mises à jour:', error);
      return {
        hasUpdate: false,
        error: error.message
      };
    }
  }

  // Récupérer les informations du dépôt via l'API GitHub
  async fetchRepoInfo() {
    try {
      const response = await axios.get(this.repoApiUrl + '/commits/main', {
        headers: {
          'User-Agent': 'WEB2PWA-UpdateManager/1.0.0',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des informations du dépôt:', error);
      throw error;
    }
  }

  // Obtenir le commit actuel (via Git ou fichier de version)
  async getCurrentCommit() {
    return new Promise((resolve) => {
      // Essayer d'obtenir le commit via Git
      exec('git rev-parse HEAD', { cwd: this.appPath }, (error, stdout) => {
        if (error) {
          // Si Git n'est pas disponible, essayer de lire un fichier de version
          const versionFile = path.join(this.appPath, '.git-version');
          if (fs.existsSync(versionFile)) {
            try {
              const version = fs.readFileSync(versionFile, 'utf8').trim();
              resolve(version);
            } catch (err) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  // Télécharger et installer les mises à jour
  async downloadAndInstallUpdate() {
    try {
      console.log('📥 Téléchargement des mises à jour...');
      
      // Créer un dossier temporaire pour le téléchargement
      const tempDir = path.join(this.appPath, 'temp-update');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Télécharger les fichiers individuels depuis GitHub
      await this.downloadFilesFromGitHub(tempDir);
      
      // Copier les fichiers mis à jour (en excluant certains dossiers)
      await this.copyUpdatedFiles(tempDir);
      
      // Nettoyer le dossier temporaire
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      // Mettre à jour la config
      this.updateConfig.lastUpdate = new Date().toISOString();
      this.updateConfig.currentVersion = await this.getCurrentCommit();
      this.saveUpdateConfig();

      console.log('✅ Mise à jour installée avec succès');
      return { success: true };

    } catch (error) {
      console.error('❌ Erreur lors de l\'installation de la mise à jour:', error);
      return { success: false, error: error.message };
    }
  }

  // Télécharger les fichiers depuis GitHub
  async downloadFilesFromGitHub(destination) {
    const filesToDownload = [
      'main.js',
      'script.js', 
      'style.css',
      'index.html',
      'app-manager.html',
      'app-manager.js',
      'app-manager.css',
      'preload.js',
      'package.json'
    ];

    for (const file of filesToDownload) {
      try {
        const fileUrl = `https://raw.githubusercontent.com/Valloue/WEB2PWA/main/${file}`;
        const response = await axios.get(fileUrl, {
          timeout: 10000,
          responseType: 'text'
        });
        
        const filePath = path.join(destination, file);
        fs.writeFileSync(filePath, response.data, 'utf8');
        console.log(`✅ Fichier téléchargé: ${file}`);
      } catch (error) {
        console.error(`❌ Erreur lors du téléchargement de ${file}:`, error.message);
      }
    }

    // Télécharger le dossier icons
    await this.downloadIconsFolder(destination);
  }

  // Télécharger le dossier des icônes
  async downloadIconsFolder(destination) {
    try {
      const iconsDir = path.join(destination, 'icons');
      fs.mkdirSync(iconsDir, { recursive: true });

      // Liste des icônes connues (vous pouvez l'étendre)
      const iconFiles = [
        'icon.ico',
        'add.png',
        'delete.png', 
        'edit.png',
        'filter.png',
        'save.png',
        'search.png'
      ];

      for (const iconFile of iconFiles) {
        try {
          const iconUrl = `https://raw.githubusercontent.com/Valloue/WEB2PWA/main/icons/${iconFile}`;
          const response = await axios.get(iconUrl, {
            timeout: 10000,
            responseType: 'arraybuffer'
          });
          
          const iconPath = path.join(iconsDir, iconFile);
          fs.writeFileSync(iconPath, response.data);
          console.log(`✅ Icône téléchargée: ${iconFile}`);
        } catch (error) {
          console.log(`⚠️ Icône non trouvée: ${iconFile}`);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du téléchargement du dossier icons:', error.message);
    }
  }

  // Copier les fichiers mis à jour
  async copyUpdatedFiles(sourceDir) {
    const filesToUpdate = [
      'main.js',
      'script.js',
      'style.css',
      'index.html',
      'app-manager.html',
      'app-manager.js',
      'app-manager.css',
      'preload.js',
      'package.json'
    ];

    const dirsToUpdate = [
      'icons'
    ];

    // Copier les fichiers
    for (const file of filesToUpdate) {
      const sourceFile = path.join(sourceDir, file);
      const destFile = path.join(this.appPath, file);
      
      if (fs.existsSync(sourceFile)) {
        try {
          fs.copyFileSync(sourceFile, destFile);
          console.log(`✅ Fichier mis à jour: ${file}`);
        } catch (error) {
          console.error(`❌ Erreur lors de la copie de ${file}:`, error);
        }
      }
    }

    // Copier les dossiers
    for (const dir of dirsToUpdate) {
      const sourceDirPath = path.join(sourceDir, dir);
      const destDirPath = path.join(this.appPath, dir);
      
      if (fs.existsSync(sourceDirPath)) {
        try {
          if (fs.existsSync(destDirPath)) {
            fs.rmSync(destDirPath, { recursive: true, force: true });
          }
          fs.cpSync(sourceDirPath, destDirPath, { recursive: true });
          console.log(`✅ Dossier mis à jour: ${dir}`);
        } catch (error) {
          console.error(`❌ Erreur lors de la copie du dossier ${dir}:`, error);
        }
      }
    }

    // Sauvegarder la version actuelle
    const versionFile = path.join(this.appPath, '.git-version');
    try {
      const latestCommit = await this.getLatestCommitFromRepo();
      if (latestCommit) {
        fs.writeFileSync(versionFile, latestCommit);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la version:', error);
    }
  }

  // Obtenir le dernier commit du dépôt
  async getLatestCommitFromRepo() {
    try {
      const repoInfo = await this.fetchRepoInfo();
      return repoInfo?.sha || null;
    } catch (error) {
      console.error('Erreur lors de la récupération du dernier commit:', error);
      return null;
    }
  }

  // Vérifier et installer automatiquement les mises à jour
  async autoUpdate() {
    if (!this.updateConfig.autoUpdate) {
      return { success: false, message: 'Mise à jour automatique désactivée' };
    }

    try {
      const updateInfo = await this.checkForUpdates();
      
      if (updateInfo.hasUpdate) {
        console.log('🔄 Mise à jour automatique détectée, installation...');
        const result = await this.downloadAndInstallUpdate();
        
        if (result.success) {
          return {
            success: true,
            message: 'Mise à jour automatique installée avec succès',
            restartRequired: true
          };
        } else {
          return {
            success: false,
            message: `Erreur lors de la mise à jour automatique: ${result.error}`
          };
        }
      } else {
        return {
          success: true,
          message: 'Application à jour'
        };
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour automatique:', error);
      return {
        success: false,
        message: `Erreur: ${error.message}`
      };
    }
  }

  // Activer/désactiver la mise à jour automatique
  setAutoUpdate(enabled) {
    this.updateConfig.autoUpdate = enabled;
    this.saveUpdateConfig();
    console.log(`Mise à jour automatique ${enabled ? 'activée' : 'désactivée'}`);
  }

  // Obtenir le statut de la mise à jour automatique
  isAutoUpdateEnabled() {
    return this.updateConfig.autoUpdate;
  }

  // Obtenir les informations de la dernière vérification
  getLastCheckInfo() {
    return {
      lastCheck: this.updateConfig.lastCheck,
      lastUpdate: this.updateConfig.lastUpdate,
      currentVersion: this.updateConfig.currentVersion
    };
  }
}

module.exports = UpdateManager;
