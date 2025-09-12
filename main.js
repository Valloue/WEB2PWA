const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const { dialog } = require('electron');
const express = require('express');
const UpdateManager = require('./update-manager');

// Configuration de l'encodage UTF-8 pour Windows
if (process.platform === 'win32') {
    // Forcer l'encodage UTF-8 sur Windows
    process.env.LANG = 'fr_FR.UTF-8';
    process.env.LC_ALL = 'fr_FR.UTF-8';
    
    // Configuration du terminal Windows
    if (process.env.TERM_PROGRAM === 'vscode') {
        process.env.TERM = 'xterm-256color';
    }
}

// Configuration de la langue française
app.commandLine.appendSwitch('lang', 'fr');

// Ignorer les erreurs de certificat SSL pour les connexions locales/auto-signées
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('ignore-ssl-errors');
app.commandLine.appendSwitch('ignore-certificate-errors-spki-list');
app.commandLine.appendSwitch('disable-web-security');

// Variables globales pour la gestion des fenêtres
let mainWindow;
let preloadedWindows = new Map(); // Map pour stocker les fenêtres préchargées
let appData = [];
let httpServer = null; // Serveur HTTP Express
let updateManager = new UpdateManager(); // Gestionnaire de mises à jour

let launchCode = null;

function handleLaunchCode(code) {
  console.log('Code de lancement reçu:', code);
  launchCode = code;
  
  if (code === 'no-files') {
    showWelcomePopup();
  }
}

function showWelcomePopup() {
  console.log('Tentative d\'affichage de la popup'); // Debug
  const welcomePopup = document.getElementById('welcomePopup');
  
  if (welcomePopup) {
    console.log('Popup trouvée, affichage...'); // Debug
    welcomePopup.style.display = 'flex';
    
    // SUPPRIMER les anciens gestionnaires pour éviter les doublons
    const firstStepBtn = document.getElementById('firstStepBtn');
    const importBtn = document.getElementById('importBtn');
    
    // Cloner les boutons pour supprimer tous les événements
    const newFirstStepBtn = firstStepBtn.cloneNode(true);
    const newImportBtn = importBtn.cloneNode(true);
    
    firstStepBtn.parentNode.replaceChild(newFirstStepBtn, firstStepBtn);
    importBtn.parentNode.replaceChild(newImportBtn, importBtn);
    
    // Ajouter les nouveaux gestionnaires
    newFirstStepBtn.addEventListener('click', async () => {
      console.log('=== BOUTON PREMIER PAS CLIQUÉ ==='); // Debug
      try {
        console.log('Ouverture du gestionnaire avec popup automatique...'); // Debug
        console.log('Options à envoyer:', { autoOpenAddModal: true }); // Debug
        
        // Ouvrir le gestionnaire AVEC le code spécial pour déclencher la popup
        const result = await ipcRenderer.invoke('openAppManager', { autoOpenAddModal: true });
        console.log('Résultat ouverture gestionnaire:', result); // Debug
        
        welcomePopup.style.display = 'none';
      } catch (error) {
        console.error('Erreur lors du clic sur Premier pas:', error); // Debug
      }
    });
    
    document.getElementById('importBtn').addEventListener('click', async () => {
      if (window.electronAPI) {
        const result = await window.electronAPI.requestImport();
        if (result.success) {
          welcomePopup.style.display = 'none';
        }
      }
    });
  } else {
    console.error('Popup de bienvenue non trouvée!'); // Debug
  }
}

// Fonction pour vérifier app.json SANS le créer
function checkAppJson() {
  const appJsonPath = path.join(__dirname, 'app.json');
  const exists = fs.existsSync(appJsonPath);
  
  if (!exists) {
    console.log('app.json n\'existe pas - lancement avec code "no-files"');
    return { exists: false, code: 'no-files' };
  } else {
    console.log('app.json existe - lancement normal');
    return { exists: true, code: 'normal' };
  }
}

// Fonction pour démarrer le serveur HTTP Express
function startHttpServer() {
  try {
    const expressApp = express();
    const PORT = 6979;
    
    // Middleware pour parser JSON
    expressApp.use(express.json());
    expressApp.use(express.urlencoded({ extended: true }));
    
    // Servir les fichiers statiques depuis le répertoire de l'application
    expressApp.use(express.static(__dirname));
    
    // Route pour l'API des applications
    expressApp.get('/api/apps', (req, res) => {
      try {
        const appJsonPath = path.join(__dirname, 'app.json');
        if (fs.existsSync(appJsonPath)) {
          const data = fs.readFileSync(appJsonPath, 'utf8');
          const jsonData = JSON.parse(data);
          res.json(jsonData);
        } else {
          res.json({ apps: [] });
        }
      } catch (error) {
        console.error('Erreur lors de la lecture des applications:', error);
        res.status(500).json({ error: 'Erreur lors de la lecture des applications' });
      }
    });
    
    // Route pour mettre à jour les applications
    expressApp.post('/api/apps', (req, res) => {
      try {
        const appJsonPath = path.join(__dirname, 'app.json');
        const jsonString = JSON.stringify(req.body, null, 2);
        fs.writeFileSync(appJsonPath, jsonString, 'utf8');
        
        // Notifier la fenêtre principale du changement
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('apps-data-updated');
        }
        
        res.json({ success: true });
      } catch (error) {
        console.error('Erreur lors de la sauvegarde des applications:', error);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde des applications' });
      }
    });
    
    // Route pour servir les icônes
    expressApp.get('/icon/:filename', (req, res) => {
      const iconPath = path.join(__dirname, 'icon', req.params.filename);
      if (fs.existsSync(iconPath)) {
        res.sendFile(iconPath);
      } else {
        res.status(404).json({ error: 'Icône non trouvée' });
      }
    });
    
    // Route de base pour l'application web
    expressApp.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    });
    
    // Démarrer le serveur
    httpServer = expressApp.listen(PORT, 'localhost', () => {
      console.log(`🚀 Serveur HTTP démarré sur http://localhost:${PORT}`);
      console.log(`📱 Application accessible via le navigateur web`);
    });
    
    // Gestion des erreurs du serveur
    httpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`⚠️ Le port ${PORT} est déjà utilisé. Tentative sur le port ${PORT + 1}...`);
        httpServer = expressApp.listen(PORT + 1, 'localhost', () => {
          console.log(`🚀 Serveur HTTP démarré sur http://localhost:${PORT + 1}`);
        });
      } else {
        console.error('Erreur du serveur HTTP:', error);
      }
    });
    
  } catch (error) {
    console.error('Erreur lors du démarrage du serveur HTTP:', error);
  }
}

function createWindow() {
  const appStatus = checkAppJson(); // Vérifier le statut !
  
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: 'Mes Applications',
    icon: path.join(__dirname, 'icons/icon.ico'), // Optionnel : ajoutez une icône
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false, // Garder pour les sites externes
      allowRunningInsecureContent: false, // ✅ Désactiver pour la sécurité
      partition: 'persist:main',
      cache: true
    },
    show: false, // Ne pas afficher immédiatement
    center: true,
    minWidth: 800,
    minHeight: 600
  });

  // Afficher la fenêtre une fois qu'elle est prête
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Démarrer le préchargement après un délai
    setTimeout(startPreloading, 2000);
  });

  // Créer un menu français
  createFrenchMenu();

  // Ouvre le fichier index.html local
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Envoyer le code à l'app
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('launch-code', appStatus.code);
    console.log('Code envoye a l\'app:', appStatus.code);
  });

  // Gestion de la fermeture de la fenêtre principale
  mainWindow.on('closed', () => {
    // Fermer toutes les fenêtres préchargées
    preloadedWindows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    preloadedWindows.clear();
    mainWindow = null;
  });

  // Optionnel : Ouvrir les DevTools en mode développement
  // mainWindow.webContents.openDevTools();

  // Ajouter une Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
          responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': ['default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' data: https: http:']
          }
      });
  });
}

// Création d'un menu en français
function createFrenchMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Actualiser',
          accelerator: 'CmdOrCtrl+R',
          role: 'reload'
        },
        {
          label: 'Forcer l\'actualisation',
          accelerator: 'CmdOrCtrl+Shift+R',
          role: 'forceReload'
        },
        { type: 'separator' },
        { type: 'separator' },
        {
          label: 'Modifier la liste des apps',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => openAppListInNotepad()
        },
        { type: 'separator' },
        {
          label: 'Ouvrir dans le navigateur web',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => openInWebBrowser()
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          role: 'quit'
        }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        {
          label: 'Zoom avant',
          accelerator: 'CmdOrCtrl+Plus',
          role: 'zoomIn'
        },
        {
          label: 'Zoom arrière',
          accelerator: 'CmdOrCtrl+-',
          role: 'zoomOut'
        },
        {
          label: 'Zoom normal',
          accelerator: 'CmdOrCtrl+0',
          role: 'resetZoom'
        },
        { type: 'separator' },
        {
          label: 'Plein écran',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          role: 'togglefullscreen'
        },
        { type: 'separator' },
        {
          label: 'Thème',
          submenu: [
            {
              id: 'theme-light',
              label: 'Thème clair',
              type: 'radio',
              checked: true,
              click: () => changeTheme('light')
            },
            {
              id: 'theme-dark',
              label: 'Thème sombre',
              type: 'radio',
              click: () => changeTheme('dark')
            },
            {
              id: 'theme-auto',
              label: 'Automatique (système)',
              type: 'radio',
              click: () => changeTheme('auto')
            }
          ]
        }
      ]
    },
    {
      label: 'Options',
      submenu: [
        {
          label: 'Outils de développement',
          accelerator: 'F12',
          click: () => {
            // Ouvrir les DevTools sur la fenêtre active
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Console de débogage',
          accelerator: 'Ctrl+Shift+I',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.openDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: '📤 Exporter la configuration',
          accelerator: 'Ctrl+Shift+E',
          click: () => exportConfiguration()
        },
        {
          label: '📥 Importer la configuration',
          accelerator: 'Ctrl+Shift+I',
          click: () => importConfiguration()
        },
        { type: 'separator' },
        {
          label: '🔄 Vérifier les mises à jour',
          accelerator: 'Ctrl+Shift+U',
          click: () => checkForUpdatesManually()
        },
        {
          label: '⚙️ Paramètres de mise à jour',
          click: () => openUpdateSettings()
        }
      ]
    },
    {
      label: 'Fenêtre',
      submenu: [
        {
          label: 'Réduire',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Fermer',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }
      ]
    }
  ];

  // Ajustements spécifiques à macOS
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: 'À propos de ' + app.getName(),
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Masquer ' + app.getName(),
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Masquer les autres',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Tout afficher',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: 'Command+Q',
          role: 'quit'
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  // Démarrer le serveur HTTP Express
  startHttpServer();
  
  createWindow();

  // Vérifier les mises à jour automatiques au démarrage
  if (updateManager.isAutoUpdateEnabled()) {
    console.log('🔄 Vérification automatique des mises à jour...');
    try {
      const updateResult = await updateManager.autoUpdate();
      if (updateResult.restartRequired) {
        console.log('🔄 Redémarrage requis après mise à jour');
        // Afficher une notification à l'utilisateur
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', {
            message: 'Mise à jour installée. L\'application va redémarrer.',
            restartRequired: true
          });
        }
        // Redémarrer après un délai
        setTimeout(() => {
          app.relaunch();
          app.exit();
        }, 3000);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification automatique:', error);
    }
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // Arrêter le serveur HTTP avant de quitter
  if (httpServer) {
    httpServer.close(() => {
      console.log('Serveur HTTP arrêté');
    });
  }
  
  if (process.platform !== 'darwin') app.quit();
});

// Gestionnaire pour ignorer les erreurs de certificat SSL
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  console.log(`Certificat SSL ignoré pour: ${url}`);
  // Ignorer l'erreur de certificat et continuer
  event.preventDefault();
  callback(true);
});

// Gestionnaire pour les erreurs de permission (pour les sites HTTPS avec certificats auto-signés)
app.on('select-client-certificate', (event, webContents, url, list, callback) => {
  console.log(`Sélection de certificat client pour: ${url}`);
  event.preventDefault();
  // Continuer sans certificat client
  callback();
});

// Fonction pour démarrer le préchargement des applications
async function startPreloading() {
  try {
    // Charger le fichier app.json
    
    const appJsonPath = path.join(__dirname, 'app.json');
    
    if (fs.existsSync(appJsonPath)) {
      const data = fs.readFileSync(appJsonPath, 'utf8');
      const jsonData = JSON.parse(data);
      appData = jsonData.apps || [];
      
      console.log('Demarrage du prechargement de', appData.length, 'applications...');
      
      // Précharger les applications par priorité (les plus populaires d'abord)
      const priorityApps = appData.slice(0, 5); // Précharger les 5 premières
      
      for (const app of priorityApps) {
        await preloadApp(app);
        // Délai entre chaque préchargement pour éviter la surcharge
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('Prechargement termine !');
    }
  } catch (error) {
    console.error('Erreur lors du préchargement:', error);
  }
}

// Fonction pour précharger une application spécifique
function preloadApp(app) {
  return new Promise((resolve) => {
    try {
      console.log('Prechargement de', app.name, '...');
      
      const preloadWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false, // Fenêtre invisible
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false, // Désactiver pour permettre les certificats SSL non valides
          allowRunningInsecureContent: false,
          // Ajouter ces options pour éviter les erreurs de cache :
          partition: 'persist:preload', // Éviter les conflits de cache
          cache: true // Désactiver le cache
        },
        title: app.name
      });
      
      // Stocker la fenêtre préchargée
      preloadedWindows.set(app.url, preloadWindow);
      
      // Gestionnaire pour ignorer les erreurs de certificat sur cette fenêtre
      preloadWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
        console.log(`Certificat SSL ignoré pour le prechargement de ${app.name}: ${url}`);
        event.preventDefault();
        callback(true);
      });
      
      // Charger l'URL
      preloadWindow.loadURL(app.url).then(() => {
        console.log(`[OK] ${app.name} precharge avec succes`);
        resolve();
      }).catch(error => {
        console.log(`⚠️ ${app.name} non precharge (${error.message})`);
        // Supprimer la fenêtre en cas d'erreur
        if (!preloadWindow.isDestroyed()) {
            preloadWindow.close();
        }
        preloadedWindows.delete(app.url);
        resolve(); // Continuer même en cas d'erreur
      });
      
      // Réduire le timeout et améliorer la gestion :
      setTimeout(() => {
          if (!preloadWindow.isDestroyed()) {
              console.log(`[TIMEOUT] ${app.name} precharge (timeout de securite)`);
              preloadWindow.close();
              preloadedWindows.delete(app.url);
          }
          resolve();
      }, 8000); // Réduire à 8 secondes
      
    } catch (error) {
      console.error(`Erreur lors de la création de la fenêtre pour ${app.name}:`, error);
      resolve();
    }
  });
}

// IPC pour ouvrir une application préchargée
ipcMain.handle('open-app', async (event, appUrl) => {
  try {
    console.log(`Tentative d'ouverture de l'app: ${appUrl}`);
    
    if (preloadedWindows.has(appUrl)) {
      // Application préchargée - affichage instantané
      const window = preloadedWindows.get(appUrl);
      
      if (!window.isDestroyed()) {
        window.show();
        window.focus();
        console.log(`[APP] Application prechargee ouverte: ${appUrl}`);
        
        // Retirer de la liste des préchargées car maintenant elle est visible
        preloadedWindows.delete(appUrl);
        
        // Gérer la fermeture de la fenêtre
        window.on('closed', () => {
          console.log(`Fenêtre fermée: ${appUrl}`);
        });
        
        return { success: true, preloaded: true };
      } else {
        // Fenêtre détruite, on la supprime de la map
        preloadedWindows.delete(appUrl);
      }
    }
    
    // Application non préchargée - création d'une nouvelle fenêtre
    console.log(`[NEW] Creation d'une nouvelle fenetre pour: ${appUrl}`);
    const newWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Désactiver pour permettre les certificats SSL non valides
        allowRunningInsecureContent: false,
        // Ajouter ces options pour éviter les erreurs de cache :
        partition: 'persist:newWindow', // Éviter les conflits de cache
        cache: false // Désactiver le cache
      },
      show: false
    });
    
    // Gestionnaire pour ignorer les erreurs de certificat sur cette nouvelle fenêtre
    newWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      console.log(`Certificat SSL ignoré pour une nouvelle fenêtre: ${url}`);
      event.preventDefault();
      callback(true);
    });
    
    newWindow.loadURL(appUrl);
    newWindow.once('ready-to-show', () => {
      newWindow.show();
    });
    
    return { success: true, preloaded: false };
    
  } catch (error) {
    console.error('Erreur lors de l\'ouverture de l\'application:', error);
    return { success: false, error: error.message };
  }
});

// IPC pour obtenir le statut du préchargement
ipcMain.handle('get-preload-status', () => {
  const status = {
    totalApps: appData.length,
    preloadedApps: preloadedWindows.size,
    preloadedUrls: Array.from(preloadedWindows.keys())
  };
  console.log('Statut du prechargement:', status);
  return status;
});

// Fonction pour changer le thème
function changeTheme(theme) {
  console.log(`Changement de thème vers: ${theme}`);
  
  // Mettre à jour les boutons radio dans le menu
  const menu = Menu.getApplicationMenu();
  if (menu) {
    const themeMenu = menu.getMenuItemById('theme-light')?.parent;
    if (themeMenu) {
      themeMenu.items.forEach(item => {
        if (item.id && item.id.startsWith('theme-')) {
          item.checked = item.id === `theme-${theme}`;
        }
      });
    }
  }
  
  // Envoyer le changement de thème à toutes les fenêtres
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('theme-changed', theme);
  });
}

// IPC pour récupérer le thème actuel
ipcMain.handle('get-current-theme', () => {
  // Récupérer depuis le localStorage ou retourner le thème par défaut
  return 'light'; // Par défaut
});

// IPC pour sauvegarder le thème
ipcMain.handle('save-theme', (event, theme) => {
  console.log(`Thème sauvegardé: ${theme}`);
  // Le thème sera sauvegardé côté client dans localStorage
  return true;
});

// ============ IPC pour le gestionnaire d'applications ============

// IPC pour charger les applications
ipcMain.handle('load-apps-data', async () => {
  try {
    const appJsonPath = path.join(__dirname, 'app.json');
    
    if (fs.existsSync(appJsonPath)) {
      const data = fs.readFileSync(appJsonPath, 'utf8');
      const jsonData = JSON.parse(data);
      console.log('Applications chargées pour le gestionnaire');
      return { success: true, data: jsonData };
    } else {
      return { success: false, error: 'Fichier app.json non trouvé' };
    }
  } catch (error) {
    console.error('Erreur lors du chargement des apps:', error);
    return { success: false, error: error.message };
  }
});

// IPC pour sauvegarder les applications
ipcMain.handle('save-apps-data', async (event, appsData) => {
  try {
    const appJsonPath = path.join(__dirname, 'app.json');
    
    // Créer une sauvegarde
    const backupPath = path.join(__dirname, 'app.json.backup');
    if (fs.existsSync(appJsonPath)) {
      fs.copyFileSync(appJsonPath, backupPath);
    }
    
    // Sauvegarder les nouvelles données
    const jsonString = JSON.stringify(appsData, null, 2);
    fs.writeFileSync(appJsonPath, jsonString, 'utf8');
    
    console.log('Applications sauvegardées avec succès');
    
    // Notifier la fenêtre principale du changement
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('apps-data-updated');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des apps:', error);
    return { success: false, error: error.message };
  }
});

// IPC pour obtenir les catégories disponibles
ipcMain.handle('get-available-categories', async () => {
  try {
    const categoriesSet = new Set();
    
    // Catégories prédéfinies
    const predefinedCategories = [
      'IA', 'Productivité', 'Communication', 'Développement', 
      'Divertissement', 'Musique', 'Design', 'Éducation', 
      'Finance', 'Santé', 'Sport', 'Voyage', 'Shopping', 
      'Actualités', 'Mon Site'
    ];
    
    predefinedCategories.forEach(cat => categoriesSet.add(cat));
    
    // Ajouter les catégories existantes du fichier
    if (appData && appData.length > 0) {
      appData.forEach(app => {
        if (app.category && app.category.trim()) {
          categoriesSet.add(app.category.trim());
        }
      });
    }
    
    return Array.from(categoriesSet).sort();
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    return [];
  }
});

// ============ IPC pour la gestion des mises à jour ============

// IPC pour vérifier les mises à jour
ipcMain.handle('check-for-updates', async () => {
  try {
    console.log('🔍 Vérification manuelle des mises à jour...');
    const updateInfo = await updateManager.checkForUpdates();
    return updateInfo;
  } catch (error) {
    console.error('Erreur lors de la vérification des mises à jour:', error);
    return { hasUpdate: false, error: error.message };
  }
});

// IPC pour installer les mises à jour
ipcMain.handle('install-update', async () => {
  try {
    console.log('📥 Installation des mises à jour...');
    const result = await updateManager.downloadAndInstallUpdate();
    
    if (result.success) {
      // Afficher une notification de succès
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-installed', {
          message: 'Mise à jour installée avec succès. L\'application va redémarrer.',
          restartRequired: true
        });
      }
      
      // Redémarrer après un délai
      setTimeout(() => {
        app.relaunch();
        app.exit();
      }, 3000);
    }
    
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'installation de la mise à jour:', error);
    return { success: false, error: error.message };
  }
});

// IPC pour activer/désactiver la mise à jour automatique
ipcMain.handle('set-auto-update', async (event, enabled) => {
  try {
    updateManager.setAutoUpdate(enabled);
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la configuration de la mise à jour automatique:', error);
    return { success: false, error: error.message };
  }
});

// IPC pour obtenir le statut de la mise à jour automatique
ipcMain.handle('get-auto-update-status', async () => {
  try {
    const isEnabled = updateManager.isAutoUpdateEnabled();
    const lastCheckInfo = updateManager.getLastCheckInfo();
    return { 
      success: true, 
      autoUpdateEnabled: isEnabled,
      lastCheck: lastCheckInfo.lastCheck,
      lastUpdate: lastCheckInfo.lastUpdate,
      currentVersion: lastCheckInfo.currentVersion
    };
  } catch (error) {
    console.error('Erreur lors de la récupération du statut:', error);
    return { success: false, error: error.message };
  }
});

// ============ IPC pour la gestion des icônes ============

// IPC pour lister les icônes disponibles
ipcMain.handle('get-available-icons', async () => {
  try {
    const iconDir = path.join(__dirname, 'icon');
    
    // Créer le dossier icon s'il n'existe pas
    if (!fs.existsSync(iconDir)) {
      fs.mkdirSync(iconDir, { recursive: true });
      console.log('Dossier icon créé');
    }
    
    // Lire le contenu du dossier
    const files = fs.readdirSync(iconDir);
    
    // Filtrer pour ne garder que les images
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp'];
    const iconFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });
    
    console.log(`${iconFiles.length} icônes trouvées dans le dossier icon`);
    return iconFiles;
  } catch (error) {
    console.error('Erreur lors de la lecture des icônes:', error);
    return [];
  }
});

// IPC pour sauvegarder une nouvelle icône
ipcMain.handle('save-icon', async (event, iconData, fileName) => {
  try {
    const iconDir = path.join(__dirname, 'icon');
    
    // Créer le dossier icon s'il n'existe pas
    if (!fs.existsSync(iconDir)) {
      fs.mkdirSync(iconDir, { recursive: true });
    }
    
    // Générer un nom de fichier unique si nécessaire
    let finalFileName = fileName;
    let counter = 1;
    const nameWithoutExt = path.parse(fileName).name;
    const ext = path.parse(fileName).ext;
    
    while (fs.existsSync(path.join(iconDir, finalFileName))) {
      finalFileName = `${nameWithoutExt}_${counter}${ext}`;
      counter++;
    }
    
    const iconPath = path.join(iconDir, finalFileName);
    
    // Convertir base64 en buffer si nécessaire
    let buffer;
    if (typeof iconData === 'string' && iconData.startsWith('data:')) {
      // Données base64
      const base64Data = iconData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = iconData;
    }
    
    // Sauvegarder le fichier
    fs.writeFileSync(iconPath, buffer);
    
    console.log(`Icône sauvegardée: ${finalFileName}`);
    return { success: true, fileName: finalFileName };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'icône:', error);
    return { success: false, error: error.message };
  }
});

// IPC pour supprimer une icône
ipcMain.handle('delete-icon', async (event, fileName) => {
  try {
    const iconPath = path.join(__dirname, 'icon', fileName);
    
    if (fs.existsSync(iconPath)) {
      fs.unlinkSync(iconPath);
      console.log(`Icône supprimée: ${fileName}`);
      return { success: true };
    } else {
      return { success: false, error: 'Fichier non trouvé' };
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'icône:', error);
    return { success: false, error: error.message };
  }
});

// IPC pour copier une icône depuis un chemin externe
ipcMain.handle('copy-icon-from-path', async (event, sourcePath) => {
  try {
    const iconDir = path.join(__dirname, 'icon');
    
    // Créer le dossier icon s'il n'existe pas
    if (!fs.existsSync(iconDir)) {
      fs.mkdirSync(iconDir, { recursive: true });
    }
    
    // Obtenir le nom du fichier
    const fileName = path.basename(sourcePath);
    let finalFileName = fileName;
    let counter = 1;
    const nameWithoutExt = path.parse(fileName).name;
    const ext = path.parse(fileName).ext;
    
    // Générer un nom unique si nécessaire
    while (fs.existsSync(path.join(iconDir, finalFileName))) {
      finalFileName = `${nameWithoutExt}_${counter}${ext}`;
      counter++;
    }
    
    const destPath = path.join(iconDir, finalFileName);
    
    // Copier le fichier
    fs.copyFileSync(sourcePath, destPath);
    
    console.log(`Icône copiée: ${finalFileName}`);
    return { success: true, fileName: finalFileName };
  } catch (error) {
    console.error('Erreur lors de la copie de l\'icône:', error);
    return { success: false, error: error.message };
  }
});

// 🧠 NOUVELLE FONCTION: Extraire les icônes du HTML de la page
async function extractIconsFromHTML(url) {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const http = require('http');
      
      const client = url.startsWith('https:') ? https : http;
      const options = {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
      
      if (url.startsWith('https:')) {
        options.rejectUnauthorized = false;
      }
      
      const request = client.get(url, options, (response) => {
        if (response.statusCode !== 200) {
          console.log(`❌ Erreur HTTP ${response.statusCode} pour ${url}`);
          resolve([]);
          return;
        }
        
        let html = '';
        response.on('data', (chunk) => {
          html += chunk;
        });
        
        response.on('end', () => {
          try {
            const icons = parseHTMLForIcons(html, url);
            console.log(`🔍 ${icons.length} icône(s) extraite(s) du HTML`);
            resolve(icons);
          } catch (error) {
            console.error('❌ Erreur lors du parsing HTML:', error);
            resolve([]);
          }
        });
      });
      
      request.on('error', (error) => {
        console.log(`❌ Erreur de requête pour ${url}:`, error.message);
        resolve([]);
      });
      
      request.on('timeout', () => {
        console.log(`⏰ Timeout pour ${url}`);
        request.destroy();
        resolve([]);
      });
      
      request.setTimeout(15000);
      
    } catch (error) {
      console.error('❌ Erreur générale lors de l\'extraction HTML:', error);
      resolve([]);
    }
  });
}

// 🧠 NOUVELLE FONCTION: Parser le HTML pour trouver les icônes
function parseHTMLForIcons(html, baseUrl) {
  const icons = [];
  const baseUrlObj = new URL(baseUrl);
  
  try {
    // 🔍 Recherche des balises link avec rel="icon" ou "apple-touch-icon"
    const linkRegex = /<link[^>]+(?:rel=["'](?:icon|apple-touch-icon|shortcut icon|mask-icon)[^"']*["'])[^>]+(?:href=["']([^"']+)["'])[^>]*>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      if (href && !href.startsWith('data:')) {
        const fullUrl = new URL(href, baseUrl).href;
        icons.push(fullUrl);
        console.log(`🔗 Icône trouvée dans <link>: ${fullUrl}`);
      }
    }
    
    // 🔍 Recherche des balises meta avec property="og:image" ou "twitter:image"
    const metaRegex = /<meta[^>]+(?:property=["'](?:og:image|twitter:image)[^"']*["'])[^>]+(?:content=["']([^"']+)["'])[^>]*>/gi;
    
    while ((match = metaRegex.exec(html)) !== null) {
      const content = match[1];
      if (content && !content.startsWith('data:')) {
        const fullUrl = new URL(content, baseUrl).href;
        icons.push(fullUrl);
        console.log(`📱 Icône trouvée dans <meta>: ${fullUrl}`);
      }
    }
    
    // 🔍 Recherche des balises img avec des noms d'icônes
    const imgRegex = /<img[^>]+(?:src=["']([^"']+)["'])[^>]+(?:alt=["']([^"']*logo[^"']*|icon[^"']*|brand[^"']*)[^"']*["'])[^>]*>/gi;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      const alt = match[2] || '';
      if (src && !src.startsWith('data:') && (alt.toLowerCase().includes('logo') || alt.toLowerCase().includes('icon') || alt.toLowerCase().includes('brand'))) {
        const fullUrl = new URL(src, baseUrl).href;
        icons.push(fullUrl);
        console.log(`🖼️ Icône trouvée dans <img>: ${fullUrl}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du parsing HTML:', error);
  }
  
  return icons;
}

// 🧠 NOUVELLE FONCTION: Déterminer la priorité d'une icône
function getIconPriority(url) {
  const lowerUrl = url.toLowerCase();
  
  // 🥇 Priorité 1: SVG (vectoriel, qualité infinie)
  if (lowerUrl.includes('.svg')) return 100;
  
  // 🥈 Priorité 2: Formats haute résolution (éviter les icônes floues)
  if (lowerUrl.includes('180x180') || lowerUrl.includes('152x152') || lowerUrl.includes('144x144')) return 95;
  if (lowerUrl.includes('120x120') || lowerUrl.includes('114x114') || lowerUrl.includes('76x76')) return 90;
  if (lowerUrl.includes('72x72') || lowerUrl.includes('60x60') || lowerUrl.includes('57x57')) return 85;
  
  // 🥉 Priorité 3: Formats modernes haute qualité
  if (lowerUrl.includes('.webp')) return 80;
  if (lowerUrl.includes('.png')) return 75;
  if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) return 70;
  
  // 🏅 Priorité 4: Formats classiques (éviter si possible)
  if (lowerUrl.includes('.ico')) return 50;
  
  // 🎯 Priorité 5: Icônes spécifiques (éviter les favicon génériques)
  if (lowerUrl.includes('apple-touch-icon')) return 90;
  if (lowerUrl.includes('logo')) return 85;
  if (lowerUrl.includes('icon') && !lowerUrl.includes('favicon')) return 80;
  
  // 📱 Priorité 6: Icônes sociales (généralement de bonne qualité)
  if (lowerUrl.includes('og:image') || lowerUrl.includes('twitter:image')) return 85;
  
  // ❌ Priorité très basse pour les favicon génériques (souvent flous)
  if (lowerUrl.includes('favicon')) return 30;
  
  return 40; // Priorité par défaut
}

// 🧠 NOUVELLE FONCTION: Obtenir une description de la qualité d'une icône
function getQualityDescription(url) {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('.svg')) return 'SVG (qualité infinie)';
  if (lowerUrl.includes('180x180')) return '180x180 (haute résolution)';
  if (lowerUrl.includes('152x152')) return '152x152 (haute résolution)';
  if (lowerUrl.includes('144x144')) return '144x144 (haute résolution)';
  if (lowerUrl.includes('120x120')) return '120x120 (haute résolution)';
  if (lowerUrl.includes('114x114')) return '114x114 (haute résolution)';
  if (lowerUrl.includes('76x76')) return '76x76 (moyenne résolution)';
  if (lowerUrl.includes('72x72')) return '72x72 (moyenne résolution)';
  if (lowerUrl.includes('60x60')) return '60x60 (moyenne résolution)';
  if (lowerUrl.includes('57x57')) return '57x57 (moyenne résolution)';
  if (lowerUrl.includes('32x32')) return '32x32 (standard)';
  if (lowerUrl.includes('16x16')) return '16x16 (compact)';
  
  if (lowerUrl.includes('.webp')) return 'WebP (moderne)';
  if (lowerUrl.includes('.png')) return 'PNG (moderne)';
  if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) return 'JPG (photo)';
  if (lowerUrl.includes('.ico')) return 'ICO (classique)';
  
  if (lowerUrl.includes('apple-touch-icon')) return 'Apple Touch Icon';
  if (lowerUrl.includes('logo')) return 'Logo';
  if (lowerUrl.includes('og:image')) return 'Image sociale';
  if (lowerUrl.includes('twitter:image')) return 'Image Twitter';
  
  return 'Icône standard';
}

// IPC pour récupérer le favicon d'un site web
ipcMain.handle('fetch-favicon', async (event, url) => {
  try {
    const https = require('https');
    const http = require('http');
    
    console.log(`🔍 Récupération intelligente du favicon pour: ${url}`);
    
    // Nettoyer et valider l'URL
    let cleanUrl;
    let hostname;
    try {
      const urlObj = new URL(url);
      cleanUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      hostname = urlObj.hostname;
    } catch (error) {
      console.log(`❌ URL invalide: ${url}`);
      return { success: false, error: 'URL invalide' };
    }
    
    // 🚀 MÉTHODE 1: Parser le HTML de la page pour extraire les vraies icônes
    console.log('📄 Méthode 1: Analyse du HTML de la page...');
    let allIcons = [];
    
    try {
      const htmlIcons = await extractIconsFromHTML(url);
      if (htmlIcons.length > 0) {
        console.log(`✅ ${htmlIcons.length} icône(s) trouvée(s) dans le HTML`);
        allIcons.push(...htmlIcons.map(icon => ({
          url: icon,
          priority: getIconPriority(icon),
          quality: getQualityDescription(icon),
          source: 'HTML'
        })));
      }
    } catch (error) {
      console.log(`❌ Erreur lors de l'analyse HTML: ${error.message}`);
    }
    
    // 🎯 MÉTHODE 2: Services de favicon externes
    console.log('🌐 Méthode 2: Services de favicon externes...');
    const externalServices = [
      `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
      `https://favicon.yandex.net/favicon/${hostname}`,
      `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
      `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}`,
      `https://api.faviconkit.com/${hostname}/64`
    ];
    
    for (const serviceUrl of externalServices) {
      try {
        const result = await downloadFaviconToBase64(serviceUrl, url);
        if (result.success) {
          console.log(`🌐 Icône récupérée via service externe: ${serviceUrl}`);
          allIcons.push({
            url: serviceUrl,
            priority: getIconPriority(serviceUrl),
            quality: result.quality || getQualityDescription(serviceUrl),
            source: 'Service externe',
            base64Data: result.base64Data,
            mimeType: result.mimeType
          });
        }
      } catch (error) {
        console.log(`❌ Service externe échoué: ${serviceUrl}`);
        continue;
      }
    }
    
    // 🔍 MÉTHODE 3: URLs de favicon classiques (fallback)
    console.log('🔍 Méthode 3: URLs de favicon classiques...');
    const classicUrls = [
      `${cleanUrl}/apple-touch-icon-180x180.png`,
      `${cleanUrl}/apple-touch-icon-152x152.png`,
      `${cleanUrl}/apple-touch-icon-144x144.png`,
      `${cleanUrl}/apple-touch-icon-120x120.png`,
      `${cleanUrl}/apple-touch-icon.png`,
      `${cleanUrl}/icon.png`,
      `${cleanUrl}/favicon.ico` // En dernier car souvent flou
    ];
    
    for (const faviconUrl of classicUrls) {
      try {
        const result = await downloadFaviconToBase64(faviconUrl, url);
        if (result.success) {
          console.log(`🔍 Icône classique trouvée: ${faviconUrl}`);
          allIcons.push({
            url: faviconUrl,
            priority: getIconPriority(faviconUrl),
            quality: result.quality || getQualityDescription(faviconUrl),
            source: 'URL classique',
            base64Data: result.base64Data,
            mimeType: result.mimeType
          });
        }
      } catch (error) {
        console.log(`❌ URL classique échouée: ${faviconUrl}`);
        continue;
      }
    }
    
    // 🎯 ANALYSE FINALE: Présenter toutes les icônes trouvées à l'utilisateur
    if (allIcons.length > 0) {
      // Trier par priorité (meilleure qualité en premier)
      const sortedIcons = allIcons.sort((a, b) => b.priority - a.priority);
      
      console.log(`🎯 ${sortedIcons.length} icône(s) trouvée(s) au total, demande de choix à l'utilisateur`);
      
      // Télécharger toutes les icônes qui n'ont pas encore de données base64
      const iconsToDownload = sortedIcons.filter(icon => !icon.base64Data);
      const iconsWithData = sortedIcons.filter(icon => icon.base64Data);
      
      if (iconsToDownload.length > 0) {
        console.log(`📥 Téléchargement de ${iconsToDownload.length} icône(s) manquante(s)...`);
        
        for (const icon of iconsToDownload) {
          try {
            const result = await downloadFaviconToBase64(icon.url, url);
            if (result.success) {
              icon.base64Data = result.base64Data;
              icon.mimeType = result.mimeType;
              console.log(`✅ Icône téléchargée: ${icon.url}`);
            }
          } catch (error) {
            console.log(`❌ Échec du téléchargement de ${icon.url}: ${error.message}`);
          }
        }
      }
      
      // Maintenant toutes les icônes ont des données base64 (ou ont échoué)
      const finalIcons = sortedIcons.filter(icon => icon.base64Data);
      
      if (finalIcons.length > 0) {
        return {
          success: false,
          needsUserChoice: true,
          icons: finalIcons.map(icon => ({
            url: icon.url,
            priority: icon.priority,
            quality: icon.quality,
            source: icon.source,
            base64Data: icon.base64Data,
            mimeType: icon.mimeType
          }))
        };
      } else {
        return { success: false, error: 'Aucune icône n\'a pu être téléchargée' };
      }
    }
    
    return { success: false, error: 'Aucun favicon trouvé avec aucune méthode' };
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du favicon:', error);
    return { success: false, error: error.message };
  }
});

// NOUVELLE FONCTION: Télécharger un favicon en base64 (sans sauvegarder sur disque)
function downloadFaviconToBase64(faviconUrl, originalUrl) {
  return new Promise((resolve) => {
    try {
      const https = require('https');
      const http = require('http');
      
      console.log(`Tentative de téléchargement: ${faviconUrl}`);
      
      // Déterminer la qualité et la taille
      let quality, size;
      
      // Formats vectoriels (qualité infinie)
      if (faviconUrl.includes('.svg')) {
        quality = 'SVG (vectoriel)';
        size = 'Infini';
      }
      // Formats haute résolution - Détecter le format exact
      else if (faviconUrl.includes('180x180')) {
        quality = '180x180 (haute résolution)';
        size = '180x180';
      } else if (faviconUrl.includes('152x152')) {
        quality = '152x152 (haute résolution)';
        size = '152x152';
      } else if (faviconUrl.includes('144x144')) {
        quality = '144x144 (haute résolution)';
        size = '144x144';
      } else if (faviconUrl.includes('120x120')) {
        quality = '120x120 (haute résolution)';
        size = '120x120';
      } else if (faviconUrl.includes('114x114')) {
        quality = '114x114 (haute résolution)';
        size = '114x114';
      } else if (faviconUrl.includes('76x76')) {
        quality = '76x76 (moyenne résolution)';
        size = '76x76';
      } else if (faviconUrl.includes('72x72')) {
        quality = '72x72 (moyenne résolution)';
        size = '72x72';
      } else if (faviconUrl.includes('60x60')) {
        quality = '60x60 (moyenne résolution)';
        size = '60x60';
      } else if (faviconUrl.includes('57x57')) {
        quality = '57x57 (moyenne résolution)';
        size = '57x57';
      } else if (faviconUrl.includes('32x32')) {
        quality = '32x32 (standard)';
        size = '32x32';
      } else if (faviconUrl.includes('16x16')) {
        quality = '16x16 (compact)';
        size = '16x16';
      }
      // Formats génériques - Détecter l'extension exacte
      else if (faviconUrl.includes('.webp')) {
        quality = 'WebP (format moderne compressé)';
        size = 'Variable';
      } else if (faviconUrl.includes('.png')) {
        quality = 'PNG (format moderne)';
        size = 'Variable';
      } else if (faviconUrl.includes('.jpg') || faviconUrl.includes('.jpeg')) {
        quality = 'JPG (format photo)';
        size = 'Variable';
      } else {
        quality = 'ICO (format classique Windows)';
        size = 'Variable';
      }
      
      const client = faviconUrl.startsWith('https:') ? https : http;
      
      const options = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };
      
      // Pour HTTPS, ignorer les erreurs SSL comme on fait pour l'app
      if (faviconUrl.startsWith('https:')) {
        options.rejectUnauthorized = false;
      }
      
      const request = client.get(faviconUrl, options, (response) => {
        console.log(`Réponse reçue: ${response.statusCode}`);
        
        // Vérifier le code de statut
        if (response.statusCode !== 200) {
          console.log(`Échec - Status: ${response.statusCode}`);
          resolve({ success: false, error: `Status ${response.statusCode}` });
          return;
        }
        
        // Vérifier le type de contenu
        const contentType = response.headers['content-type'] || '';
        console.log(`Type de contenu: ${contentType}`);
        
        // Accepter plus de types de contenu pour les favicons
        const validContentTypes = [
          'image/', 'application/octet-stream', 'application/x-icon',
          'image/x-icon', 'image/png', 'image/svg+xml', 'image/jpeg',
          'image/jpg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'
        ];
        
        // Validation plus permissive pour les favicons
        const isValidContentType = validContentTypes.some(type => 
          contentType.includes(type) || 
          faviconUrl.includes('.ico') || 
          faviconUrl.includes('.svg') ||
          faviconUrl.includes('.webp') ||
          faviconUrl.includes('.jpg') ||
          faviconUrl.includes('.jpeg') ||
          faviconUrl.includes('.png')
        );
        
        if (!isValidContentType) {
          console.log(`Type de contenu invalide: ${contentType}`);
          resolve({ success: false, error: 'Type de contenu invalide' });
          return;
        }
        
        // Collecter les données en mémoire au lieu de les écrire sur disque
        const chunks = [];
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const fileSize = buffer.length;
            
            if (fileSize < 50) {
              // Fichier trop petit, probablement pas un vrai favicon
              console.log('Fichier trop petit, ignoré');
              resolve({ success: false, error: 'Fichier trop petit' });
              return;
            }
            
            // Convertir en base64
            const base64Data = buffer.toString('base64');
            const mimeType = contentType || 'image/png';
            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            
            console.log(`✅ Favicon téléchargé avec succès en mémoire`);
            console.log(`📊 Qualité: ${quality} | Taille: ${size} | Fichier: ${fileSize} bytes`);
            
            resolve({ 
              success: true, 
              base64Data: dataUrl,
              quality: quality,
              size: size,
              fileSize: fileSize,
              mimeType: mimeType,
              originalUrl: faviconUrl
            });
          } catch (error) {
            console.error('Erreur lors du traitement des données:', error);
            resolve({ success: false, error: error.message });
          }
        });
        
        response.on('error', (error) => {
          console.error('Erreur de lecture des données:', error);
          resolve({ success: false, error: error.message });
        });
      });
      
      request.on('error', (error) => {
        console.error('Erreur de requête HTTP:', error);
        resolve({ success: false, error: error.message });
      });
      
      request.on('timeout', () => {
        console.log('Timeout de la requête');
        request.destroy();
        resolve({ success: false, error: 'Timeout' });
      });
      
      request.setTimeout(10000);
      
    } catch (error) {
      console.error('Erreur générale lors du téléchargement:', error);
      resolve({ success: false, error: error.message });
    }
  });
}

// Fonction pour ouvrir le gestionnaire d'applications
function openAppListInNotepad() {
  openAppManager();
}

// Fonction pour ouvrir l'application dans le navigateur web
function openInWebBrowser() {
  const webUrl = 'http://localhost:6979';
  shell.openExternal(webUrl);
  console.log(`Application ouverte dans le navigateur: ${webUrl}`);
}

// Fonction pour vérifier les mises à jour manuellement
async function checkForUpdatesManually() {
  try {
    console.log('🔍 Vérification manuelle des mises à jour...');
    
    // Afficher une notification de vérification
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-check-started');
    }
    
    const updateInfo = await updateManager.checkForUpdates();
    
    if (updateInfo.hasUpdate) {
      // Afficher une boîte de dialogue pour proposer l'installation
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Mise à jour disponible',
        message: 'Une nouvelle version est disponible !',
        detail: `Message du commit: ${updateInfo.message || 'Aucun message'}\n\nVoulez-vous installer la mise à jour maintenant ?`,
        buttons: ['Installer maintenant', 'Plus tard'],
        defaultId: 0,
        cancelId: 1
      });
      
      if (result.response === 0) {
        // L'utilisateur veut installer la mise à jour
        await installUpdateManually();
      }
    } else if (updateInfo.error) {
      // Afficher une erreur
      dialog.showErrorBox('Erreur de vérification', `Erreur lors de la vérification des mises à jour:\n${updateInfo.error}`);
    } else {
      // Aucune mise à jour disponible
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Aucune mise à jour',
        message: 'Votre application est à jour !',
        buttons: ['OK']
      });
    }
    
  } catch (error) {
    console.error('Erreur lors de la vérification manuelle:', error);
    dialog.showErrorBox('Erreur', `Erreur lors de la vérification des mises à jour:\n${error.message}`);
  }
}

// Fonction pour installer les mises à jour manuellement
async function installUpdateManually() {
  try {
    console.log('📥 Installation manuelle des mises à jour...');
    
    // Afficher une notification d'installation
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-install-started');
    }
    
    const result = await updateManager.downloadAndInstallUpdate();
    
    if (result.success) {
      // Afficher une confirmation de succès
      const restartResult = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Mise à jour installée',
        message: 'La mise à jour a été installée avec succès !',
        detail: 'L\'application va redémarrer pour appliquer les changements.',
        buttons: ['Redémarrer maintenant', 'Redémarrer plus tard'],
        defaultId: 0,
        cancelId: 1
      });
      
      if (restartResult.response === 0) {
        // Redémarrer immédiatement
        app.relaunch();
        app.exit();
      }
    } else {
      // Afficher une erreur
      dialog.showErrorBox('Erreur d\'installation', `Erreur lors de l'installation de la mise à jour:\n${result.error}`);
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'installation manuelle:', error);
    dialog.showErrorBox('Erreur', `Erreur lors de l'installation de la mise à jour:\n${error.message}`);
  }
}

// Fonction pour ouvrir les paramètres de mise à jour
function openUpdateSettings() {
  // Créer une fenêtre de paramètres de mise à jour
  const settingsWindow = new BrowserWindow({
    width: 600,
    height: 400,
    title: 'Paramètres de mise à jour',
    icon: path.join(__dirname, 'icons/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    },
    show: false,
    center: true,
    parent: mainWindow,
    modal: true
  });

  // HTML pour les paramètres de mise à jour
  const settingsHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Paramètres de mise à jour</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
          color: #333;
          margin-bottom: 20px;
        }
        .setting-group {
          margin-bottom: 20px;
        }
        label {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: 14px;
        }
        input[type="checkbox"] {
          margin-right: 10px;
          transform: scale(1.2);
        }
        .info {
          background: #e3f2fd;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
          font-size: 12px;
          color: #1976d2;
        }
        .status {
          background: #f5f5f5;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
          font-size: 12px;
          color: #666;
        }
        .buttons {
          margin-top: 20px;
          text-align: right;
        }
        button {
          background: #1976d2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 10px;
        }
        button:hover {
          background: #1565c0;
        }
        button.secondary {
          background: #757575;
        }
        button.secondary:hover {
          background: #616161;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>⚙️ Paramètres de mise à jour</h2>
        
        <div class="setting-group">
          <label>
            <input type="checkbox" id="autoUpdateCheckbox">
            Mise à jour automatique
          </label>
          <div class="info">
            Vérifie et installe automatiquement les mises à jour au démarrage de l'application.
          </div>
        </div>
        
        <div class="status" id="statusInfo">
          Chargement des informations...
        </div>
        
        <div class="buttons">
          <button id="checkUpdatesBtn">Vérifier maintenant</button>
          <button id="closeBtn" class="secondary">Fermer</button>
        </div>
      </div>
      
      <script>
        const { ipcRenderer } = require('electron');
        
        let currentStatus = {};
        
        // Charger le statut actuel
        async function loadStatus() {
          try {
            const status = await ipcRenderer.invoke('get-auto-update-status');
            if (status.success) {
              currentStatus = status;
              document.getElementById('autoUpdateCheckbox').checked = status.autoUpdateEnabled;
              updateStatusDisplay();
            }
          } catch (error) {
            console.error('Erreur lors du chargement du statut:', error);
          }
        }
        
        function updateStatusDisplay() {
          const statusDiv = document.getElementById('statusInfo');
          let statusText = '';
          
          if (currentStatus.lastCheck) {
            const lastCheck = new Date(currentStatus.lastCheck).toLocaleString('fr-FR');
            statusText += \`Dernière vérification: \${lastCheck}\\n\`;
          }
          
          if (currentStatus.lastUpdate) {
            const lastUpdate = new Date(currentStatus.lastUpdate).toLocaleString('fr-FR');
            statusText += \`Dernière mise à jour: \${lastUpdate}\\n\`;
          }
          
          if (currentStatus.currentVersion) {
            statusText += \`Version actuelle: \${currentStatus.currentVersion.substring(0, 7)}\\n\`;
          }
          
          statusText += \`Mise à jour automatique: \${currentStatus.autoUpdateEnabled ? 'Activée' : 'Désactivée'}\`;
          
          statusDiv.textContent = statusText;
        }
        
        // Gestionnaire pour la case à cocher
        document.getElementById('autoUpdateCheckbox').addEventListener('change', async (e) => {
          try {
            const result = await ipcRenderer.invoke('set-auto-update', e.target.checked);
            if (result.success) {
              currentStatus.autoUpdateEnabled = e.target.checked;
              updateStatusDisplay();
            } else {
              console.error('Erreur lors de la mise à jour des paramètres');
            }
          } catch (error) {
            console.error('Erreur:', error);
          }
        });
        
        // Gestionnaire pour le bouton de vérification
        document.getElementById('checkUpdatesBtn').addEventListener('click', async () => {
          try {
            const updateInfo = await ipcRenderer.invoke('check-for-updates');
            if (updateInfo.hasUpdate) {
              alert(\`Mise à jour disponible!\\n\\nMessage: \${updateInfo.message || 'Aucun message'}\\n\\nVoulez-vous l'installer?\`);
              // Ici on pourrait ajouter une logique pour installer automatiquement
            } else if (updateInfo.error) {
              alert(\`Erreur lors de la vérification: \${updateInfo.error}\`);
            } else {
              alert('Aucune mise à jour disponible. Votre application est à jour!');
            }
          } catch (error) {
            console.error('Erreur lors de la vérification:', error);
            alert(\`Erreur: \${error.message}\`);
          }
        });
        
        // Gestionnaire pour le bouton fermer
        document.getElementById('closeBtn').addEventListener('click', () => {
          window.close();
        });
        
        // Charger le statut au démarrage
        loadStatus();
      </script>
    </body>
    </html>
  `;

  settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(settingsHTML));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    console.log('Fenêtre des paramètres de mise à jour fermée');
  });
}

// Variable pour stocker la fenêtre du gestionnaire
let appManagerWindow = null;

// Fonction pour ouvrir le gestionnaire d'applications
function openAppManager() {
  // Si la fenêtre existe déjà, la mettre au premier plan ET la retourner
  if (appManagerWindow && !appManagerWindow.isDestroyed()) {
    appManagerWindow.focus();
    return appManagerWindow; // ✅ CORRECTION : Retourner la fenêtre existante
  }

  console.log('Ouverture du gestionnaire d\'applications...');
  
  // Créer une nouvelle fenêtre pour le gestionnaire
  appManagerWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Gestionnaire d\'Applications',
    icon: path.join(__dirname, 'icons/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      // Ajouter ces options pour éviter les erreurs de cache :
      partition: 'persist:appManager', // Éviter les conflits de cache
      cache: true // Désactiver le cache
    },
    show: false,
    center: true,
    minWidth: 800,
    minHeight: 600,
    parent: mainWindow,
    modal: false
  });

  // Gestionnaire pour ignorer les erreurs de certificat
  appManagerWindow.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  // Charger la page du gestionnaire
  appManagerWindow.loadFile(path.join(__dirname, 'app-manager.html'));

  // Afficher la fenêtre une fois prête
  appManagerWindow.once('ready-to-show', () => {
    appManagerWindow.show();
    console.log('Gestionnaire d\'applications ouvert');
  });

  // Nettoyer la référence quand la fenêtre se ferme
  appManagerWindow.on('closed', () => {
    appManagerWindow = null;
    console.log('Gestionnaire d\'applications fermé');
  });

  return appManagerWindow; // Retourner la fenêtre pour le gestionnaire
}

// 🎯 IPC pour télécharger une icône spécifique choisie par l'utilisateur
ipcMain.handle('download-specific-icon', async (event, iconUrl, originalUrl) => {
  try {
    console.log(`🎯 Téléchargement de l'icône choisie: ${iconUrl}`);
    const result = await downloadFaviconToBase64(iconUrl, originalUrl);
    return result;
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement de l\'icône choisie:', error);
    return { success: false, error: error.message };
  }
});

// 💾 IPC pour sauvegarder une icône base64 sur disque
ipcMain.handle('save-base64-icon', async (event, base64Data, originalUrl, mimeType) => {
  try {
    const iconDir = path.join(__dirname, 'icon');
    
    // Créer le dossier icon s'il n'existe pas
    if (!fs.existsSync(iconDir)) {
      fs.mkdirSync(iconDir, { recursive: true });
    }
    
    // Générer un nom de fichier basé sur le domaine et le format
    const urlObj = new URL(originalUrl);
    const domain = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Déterminer l'extension basée sur le MIME type
    let ext;
    if (mimeType.includes('svg')) ext = '.svg';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
    else if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('ico')) ext = '.ico';
    else ext = '.png'; // Par défaut
    
    let fileName = `favicon_${domain}${ext}`;
    
    // Générer un nom unique si nécessaire
    let counter = 1;
    const baseName = `favicon_${domain}`;
    while (fs.existsSync(path.join(iconDir, fileName))) {
      fileName = `${baseName}_${counter}${ext}`;
      counter++;
    }
    
    const filePath = path.join(iconDir, fileName);
    
    // Extraire les données base64 (enlever le préfixe data:image/...;base64,)
    const base64String = base64Data.split(',')[1];
    const buffer = Buffer.from(base64String, 'base64');
    
    // Écrire le fichier
    fs.writeFileSync(filePath, buffer);
    
    console.log(`✅ Icône sauvegardée sur disque: ${fileName}`);
    return { success: true, fileName: fileName };
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde de l\'icône:', error);
    return { success: false, error: error.message };
  }
});

// Export simple en JSON + copie des icônes
async function exportConfiguration() {
  try {
    console.log('Début de l\'export...'); // Debug
    
    // Demander à l'utilisateur où sauvegarder
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Choisir l\'emplacement de sauvegarde'
    });
    
    console.log('Résultat du dialogue:', result); // Debug
    
    if (!result.canceled && result.filePaths.length > 0) {
      const saveLocation = result.filePaths[0];
      
      // Créer le nom du dossier avec le format demandé
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      
      const backupDirName = `Backup_${day}-${month}-${year}_WEB2PWA`;
      const fullBackupPath = path.join(saveLocation, backupDirName);
      
      console.log('Création du dossier:', fullBackupPath); // Debug
      
      // Créer le dossier de sauvegarde
      fs.mkdirSync(fullBackupPath);
      
      // Copier app.json
      fs.copyFileSync('app.json', path.join(fullBackupPath, 'app.json'));
      
      // Copier le dossier icon/ complet
      fs.cpSync('icon', path.join(fullBackupPath, 'icon'), { recursive: true });
      
      console.log(`Configuration exportée dans: ${fullBackupPath}`);
      
      // Ouvrir le dossier de sauvegarde
      shell.openPath(fullBackupPath);
      
      // Afficher une confirmation
      dialog.showMessageBox({
        type: 'info',
        title: 'Export réussi',
        message: `Configuration exportée dans:\n${fullBackupPath}`,
        buttons: ['OK']
      });
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    
    // Afficher l'erreur
    dialog.showErrorBox('Erreur d\'export', `Erreur lors de l'export:\n${error.message}`);
  }
}

// Import de la configuration
async function importConfiguration() {
  try {
    console.log('Début de l\'import...'); // Debug
    
    // Ouvrir un sélecteur de fichier pour choisir le dossier de sauvegarde
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Sélectionner le dossier de sauvegarde'
    });
    
    console.log('Résultat du dialogue import:', result); // Debug
    
    if (!result.canceled && result.filePaths.length > 0) {
      const backupPath = result.filePaths[0];
      
      console.log('Chemin de sauvegarde sélectionné:', backupPath); // Debug
      
      // Restaurer app.json
      if (fs.existsSync(path.join(backupPath, 'app.json'))) {
        fs.copyFileSync(path.join(backupPath, 'app.json'), 'app.json');
        console.log('app.json restauré');
      }
      
      // Restaurer le dossier icon/
      if (fs.existsSync(path.join(backupPath, 'icon'))) {
        if (fs.existsSync('icon')) {
          fs.rmSync('icon', { recursive: true, force: true });
        }
        fs.cpSync(path.join(backupPath, 'icon'), 'icon', { recursive: true });
        console.log('Dossier icon restauré');
      }
      
      console.log('Configuration importée avec succès');
      
      // Afficher une confirmation
      dialog.showMessageBox({
        type: 'info',
        title: 'Import réussi',
        message: 'Configuration importée avec succès !\nL\'application va redémarrer.',
        buttons: ['OK']
      }).then(() => {
        // Redémarrer l'app
        app.relaunch();
        app.exit();
      });
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'import:', error);
    
    // Afficher l'erreur
    dialog.showErrorBox('Erreur d\'import', `Erreur lors de l'import:\n${error.message}`);
  }
}

// Ajouter les gestionnaires IPC pour la popup
ipcMain.handle('openAppManager', async (event, options = {}) => {
  const { autoOpenAddModal = false } = options;
  
  console.log('=== OUVERTURE DU GESTIONNAIRE ===');
  console.log('Options reçues:', options);
  console.log('autoOpenAddModal:', autoOpenAddModal);
  
  // Ouvrir le gestionnaire
  const managerWindow = openAppManager();
  console.log('Fenêtre du gestionnaire créée');
  
  // Attendre que la fenêtre soit chargée ET que l'écouteur soit prêt
  managerWindow.webContents.once('did-finish-load', () => {
    console.log('Fenêtre du gestionnaire chargée, envoi du code...');
    
    // Attendre un peu que l'écouteur soit mis en place
    setTimeout(() => {
      if (autoOpenAddModal) {
        console.log('Envoi du code add-app-modal au gestionnaire');
        managerWindow.webContents.send('launch-code', 'add-app-modal');
        console.log('Code add-app-modal envoyé !');
      } else {
        console.log('Envoi du code normal au gestionnaire');
        managerWindow.webContents.send('launch-code', 'normal');
        console.log('Code normal envoyé !');
      }
    }, 50); // ✅ Réduire de 2000ms à 500ms
  });
  
  console.log('Handler openAppManager terminé');
  return { success: true };
});

ipcMain.handle('createDefaultAppJson', async () => {
  try {
    const defaultConfig = {
      "apps": [
        {
          "name": "Valloue.fr",
          "description": "Valloue.fr",
          "url": "https://valloue.fr",
          "category": "Mon Site",
          "iconFile": "favicon_valloue_fr.png"
        }
      ]
    };
    
    const appJsonPath = path.join(__dirname, 'app.json');
    fs.writeFileSync(appJsonPath, JSON.stringify(defaultConfig, null, 2));
    
    console.log('app.json cree avec succes');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la creation de app.json:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('requestImport', async () => {
  try {
    console.log('Début de l\'import...'); // Debug
    
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Sélectionner le dossier de sauvegarde'
    });
    
    console.log('Résultat du dialogue import:', result); // Debug
    
    if (!result.canceled && result.filePaths.length > 0) {
      const backupPath = result.filePaths[0];
      
      console.log('Chemin de sauvegarde sélectionné:', backupPath); // Debug
      
      // Restaurer app.json
      if (fs.existsSync(path.join(backupPath, 'app.json'))) {
        fs.copyFileSync(path.join(backupPath, 'app.json'), 'app.json');
        console.log('app.json restauré');
      } else {
        throw new Error('Aucun fichier app.json trouvé dans le dossier sélectionné');
      }
      
      // Restaurer le dossier icon/
      if (fs.existsSync(path.join(backupPath, 'icon'))) {
        if (fs.existsSync('icon')) {
          fs.rmSync('icon', { recursive: true, force: true });
        }
        fs.cpSync(path.join(backupPath, 'icon'), 'icon', { recursive: true });
        console.log('Dossier icon restauré');
      }
      
      console.log('Configuration importée avec succès');
      
      // Afficher une confirmation
      dialog.showMessageBox({
        type: 'info',
        title: 'Import réussi',
        message: 'Configuration importée avec succès !\nL\'application va redémarrer.',
        buttons: ['OK']
      }).then(() => {
        // Redémarrer l'app
        app.relaunch();
        app.exit();
      });
      
      return { success: true, message: 'Configuration importée avec succès' };
    } else {
      return { success: false, message: 'Aucun dossier sélectionné' };
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'import:', error);
    
    // Afficher l'erreur
    dialog.showErrorBox('Erreur d\'import', `Erreur lors de l'import:\n${error.message}`);
    
    return { success: false, error: error.message };
  }
});
