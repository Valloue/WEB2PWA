const { app, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

class UpdateManager {
  constructor() {
    this.updateConfig = this.loadUpdateConfig();
    this.isChecking = false;
    this.isDownloading = false;
    
    // Configuration d'autoUpdater
    autoUpdater.autoDownload = false; // Téléchargement manuel uniquement
    autoUpdater.autoInstallOnAppQuit = false; // Installation manuelle
    
    // Configuration du dépôt GitHub
    if (this.updateConfig.githubRepo) {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: this.updateConfig.githubRepo.owner,
        repo: this.updateConfig.githubRepo.repo,
        private: false
      });
    }
    
    this.setupEventListeners();
  }

  // Charger la configuration de mise à jour
  loadUpdateConfig() {
    const configPath = path.join(__dirname, 'update-config.json');
    
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('Configuration de mise à jour chargée:', config);
        return config;
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration de mise à jour:', error);
    }
    
    // Configuration par défaut
    return {
      githubRepo: {
        owner: 'votre-username',
        repo: 'votre-repo'
      },
      checkInterval: 24 * 60 * 60 * 1000, // 24 heures
      autoCheck: false,
      prerelease: false
    };
  }

  // Configurer les écouteurs d'événements
  setupEventListeners() {
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Vérification des mises à jour...');
      this.isChecking = true;
    });

    autoUpdater.on('update-available', (info) => {
      console.log('📦 Mise à jour disponible:', info);
      this.isChecking = false;
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('✅ Aucune mise à jour disponible');
      this.isChecking = false;
    });

    autoUpdater.on('error', (err) => {
      console.error('❌ Erreur lors de la vérification des mises à jour:', err);
      this.isChecking = false;
      this.isDownloading = false;
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      console.log(`📥 Téléchargement: ${percent}%`);
      this.isDownloading = true;
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('✅ Mise à jour téléchargée:', info);
      this.isDownloading = false;
    });
  }

  // Vérifier les mises à jour disponibles
  async checkForUpdates() {
    if (this.isChecking) {
      return { hasUpdate: false, error: 'Vérification déjà en cours' };
    }

    try {
      console.log('🔍 Vérification des mises à jour...');
      
      // Vérifier la configuration
      if (!this.updateConfig.githubRepo || !this.updateConfig.githubRepo.owner || !this.updateConfig.githubRepo.repo) {
        throw new Error('Configuration GitHub manquante dans update-config.json');
      }

      // Méthode 1: Utiliser l'API GitHub directement (plus fiable)
      const githubInfo = await this.checkGitHubReleases();
      
      if (githubInfo.hasUpdate) {
        return {
          hasUpdate: true,
          version: githubInfo.version,
          message: githubInfo.message,
          downloadUrl: githubInfo.downloadUrl,
          releaseNotes: githubInfo.releaseNotes,
          publishedAt: githubInfo.publishedAt
        };
      }

      // Méthode 2: Utiliser autoUpdater comme fallback
      await autoUpdater.checkForUpdates();
      
      return { hasUpdate: false, message: 'Aucune mise à jour disponible' };

    } catch (error) {
      console.error('Erreur lors de la vérification des mises à jour:', error);
      return { hasUpdate: false, error: error.message };
    }
  }

  // Vérifier les releases GitHub via API
  async checkGitHubReleases() {
    return new Promise((resolve) => {
      const { owner, repo } = this.updateConfig.githubRepo;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
      
      const options = {
        headers: {
          'User-Agent': 'WEB2PWA-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      https.get(apiUrl, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const releases = JSON.parse(data);
            
            if (releases.length === 0) {
              resolve({ hasUpdate: false });
              return;
            }

            // Filtrer les prereleases si nécessaire
            const filteredReleases = this.updateConfig.prerelease 
              ? releases 
              : releases.filter(release => !release.prerelease);

            if (filteredReleases.length === 0) {
              resolve({ hasUpdate: false });
              return;
            }

            const latestRelease = filteredReleases[0];
            const currentVersion = this.getCurrentVersion();
            const latestVersion = latestRelease.tag_name.replace(/^v/, '');

            console.log(`Version actuelle: ${currentVersion}`);
            console.log(`Dernière version: ${latestVersion}`);
            console.log(`Nombre de releases trouvées: ${releases.length}`);
            console.log(`Releases filtrées: ${filteredReleases.length}`);
            console.log(`Dernière release:`, latestRelease);

            if (this.isNewerVersion(latestVersion, currentVersion)) {
              // Trouver l'asset pour Windows
              const windowsAsset = latestRelease.assets.find(asset => 
                asset.name.includes('win') && 
                (asset.name.endsWith('.exe') || asset.name.endsWith('.msi'))
              );

              resolve({
                hasUpdate: true,
                version: latestVersion,
                message: latestRelease.body || 'Mise à jour disponible',
                downloadUrl: windowsAsset ? windowsAsset.browser_download_url : latestRelease.html_url,
                releaseNotes: latestRelease.body,
                publishedAt: latestRelease.published_at
              });
            } else {
              resolve({ hasUpdate: false });
            }

          } catch (error) {
            console.error('Erreur lors du parsing des releases GitHub:', error);
            resolve({ hasUpdate: false, error: error.message });
          }
        });
      }).on('error', (error) => {
        console.error('Erreur lors de la requête GitHub:', error);
        resolve({ hasUpdate: false, error: error.message });
      });
    });
  }

  // Obtenir la version actuelle de l'application
  getCurrentVersion() {
    return app.getVersion();
  }

  // Comparer les versions
  isNewerVersion(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return true;
      if (v1part < v2part) return false;
    }
    
    return false;
  }

  // Télécharger et installer la mise à jour
  async downloadAndInstallUpdate() {
    if (this.isDownloading) {
      return { success: false, error: 'Téléchargement déjà en cours' };
    }

    try {
      console.log('📥 Téléchargement de la mise à jour...');
      
      // Utiliser autoUpdater pour télécharger
      await autoUpdater.downloadUpdate();
      
      return { success: true, message: 'Mise à jour téléchargée avec succès' };

    } catch (error) {
      console.error('Erreur lors du téléchargement de la mise à jour:', error);
      return { success: false, error: error.message };
    }
  }

  // Installer la mise à jour téléchargée
  async installUpdate() {
    try {
      console.log('⚙️ Installation de la mise à jour...');
      
      // Quitter l'application et installer
      autoUpdater.quitAndInstall();
      
      return { success: true, message: 'Mise à jour installée avec succès' };

    } catch (error) {
      console.error('Erreur lors de l\'installation de la mise à jour:', error);
      return { success: false, error: error.message };
    }
  }

  // Ouvrir la page de releases GitHub
  openReleasesPage() {
    const { owner, repo } = this.updateConfig.githubRepo;
    const releasesUrl = `https://github.com/${owner}/${repo}/releases`;
    shell.openExternal(releasesUrl);
  }

  // Obtenir les informations de la dernière release
  async getLatestReleaseInfo() {
    try {
      const githubInfo = await this.checkGitHubReleases();
      return githubInfo;
    } catch (error) {
      console.error('Erreur lors de la récupération des informations de release:', error);
      return { hasUpdate: false, error: error.message };
    }
  }

  // Vérifier les mises à jour automatiquement (si activé)
  startAutoCheck() {
    if (this.updateConfig.autoCheck && this.updateConfig.checkInterval > 0) {
      setInterval(() => {
        this.checkForUpdates();
      }, this.updateConfig.checkInterval);
      
      console.log('🔄 Vérification automatique des mises à jour activée');
    }
  }
}

module.exports = UpdateManager;
