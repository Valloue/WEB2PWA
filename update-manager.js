const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { dialog } = require('electron');

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
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/Valloue/WEB2PWA/commits/main',
        method: 'GET',
        headers: {
          'User-Agent': 'WEB2PWA-UpdateManager/1.0.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const commitInfo = JSON.parse(data);
              resolve(commitInfo);
            } else {
              reject(new Error(`Erreur API GitHub: ${res.statusCode}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout de la requête'));
      });

      req.end();
    });
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

      // Cloner le dépôt dans le dossier temporaire
      await this.cloneRepository(tempDir);
      
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

  // Cloner le dépôt Git
  async cloneRepository(destination) {
    return new Promise((resolve, reject) => {
      const command = `git clone --depth 1 ${this.repoUrl} .`;
      
      exec(command, { cwd: destination }, (error, stdout, stderr) => {
        if (error) {
          console.error('Erreur Git:', stderr);
          reject(new Error(`Erreur lors du clonage: ${error.message}`));
        } else {
          console.log('✅ Dépôt cloné avec succès');
          resolve();
        }
      });
    });
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
