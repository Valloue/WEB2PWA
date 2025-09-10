// Variables globales
let allApps = [];
let filteredApps = [];
let currentCategory = 'all';
let preloadStatus = { preloadedApps: 0, totalApps: 0, preloadedUrls: [] };
let availableCategories = [];
let hasPlayedInitialAnimation = false; // Flag pour éviter de rejouer les animations
let currentTheme = 'light'; // Thème actuel
let launchCode = null;

// Éléments DOM - NE PAS les déclarer ici !
let appsGrid;
let searchInput;
let filterTabsContainer;
let loading;

// Accès aux APIs Electron
const { ipcRenderer } = require('electron');

// NOUVELLE fonction pour initialiser les éléments DOM
function initializeDOMElements() {
    appsGrid = document.getElementById('appsGrid');
    searchInput = document.getElementById('searchInput');
    filterTabsContainer = document.getElementById('filterTabs');
    loading = document.getElementById('loading');
    
    console.log('Éléments DOM initialisés:', {
        appsGrid: !!appsGrid,
        searchInput: !!searchInput,
        filterTabsContainer: !!filterTabsContainer,
        loading: !!loading
    });
}

// Fonction pour gérer le code de lancement
function handleLaunchCode(code) {
  console.log('Code de lancement reçu:', code);
  launchCode = code;
  
  if (code === 'no-files') {
    console.log('Code no-files détecté, affichage de la popup...'); // Debug
    showWelcomePopup();
    // Cacher les éléments de l'app principale
    hideMainAppElements();
  } else if (code === 'normal') {
    console.log('Code normal détecté, chargement des applications...'); // Debug
    loadNormalApp();
  }
}

// NOUVELLE fonction pour cacher les éléments de l'app principale
function hideMainAppElements() {
    // Initialiser les éléments DOM si nécessaire
    if (!filterTabsContainer || !appsGrid) {
        initializeDOMElements();
    }
    
    // Cacher la barre de recherche
    if (searchInput) {
        searchInput.style.display = 'none';
    }
    
    // Cacher les onglets de catégories
    if (filterTabsContainer) {
        filterTabsContainer.style.display = 'none';
    }
    
    // Cacher la grille des apps
    if (appsGrid) {
        appsGrid.style.display = 'none';
    }
    
    // Cacher le loading
    if (loading) {
        loading.style.display = 'none';
    }
}

// MODIFIER la fonction loadNormalApp pour utiliser initializeDOMElements :
async function loadNormalApp() {
    try {
        console.log('Chargement normal des applications...'); // Debug
        
        // Initialiser les éléments DOM
        initializeDOMElements();
        
        // Vérifier que les éléments DOM sont disponibles
        if (!filterTabsContainer) {
            console.error('filterTabsContainer non trouvé après initialisation');
            throw new Error('filterTabsContainer non disponible');
        }
        
        if (!appsGrid) {
            console.error('appsGrid non trouvé après initialisation');
            throw new Error('appsGrid non disponible');
        }
        
        console.log('Éléments DOM disponibles, chargement...'); // Debug
        
        await loadApps();
        generateCategoryTabs();
        setupEventListeners();
        hideLoading();
        displayApps(allApps, true);
        startPreloadMonitoring();
        console.log('Application chargée normalement'); // Debug
    } catch (error) {
        console.error('Erreur lors du chargement normal:', error);
        showError();
    }
}

// Fonction pour afficher la popup de bienvenue
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
    // MODIFIER le gestionnaire du bouton "Premier pas" :
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
    
    newImportBtn.addEventListener('click', async () => {
      console.log('Bouton Importer cliqué'); // Debug
      try {
        // Utiliser les noms EXACTS des handlers de main.js
        const result = await ipcRenderer.invoke('requestImport');
        console.log('Résultat import:', result); // Debug
        
        if (result.success) {
          console.log('Import réussi, fermeture de la popup...'); // Debug
          welcomePopup.style.display = 'none';
        } else {
          console.error('Erreur lors de l\'import:', result.error); // Debug
        }
      } catch (error) {
        console.error('Erreur lors du clic sur Importer:', error); // Debug
      }
    });
  } else {
    console.error('Popup de bienvenue non trouvée!'); // Debug
  }
}

// Initialisation de l'application
// Simplifier en utilisant directement ipcRenderer
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM chargé, initialisation...'); // Debug
    
    try {
        // Charger le thème sauvegardé
        await initializeTheme();
        
        // Utiliser directement ipcRenderer (plus fiable)
        console.log('Utilisation directe d\'ipcRenderer...'); // Debug
        ipcRenderer.on('launch-code', (event, code) => {
            console.log('Code reçu via ipcRenderer direct:', code); // Debug
            handleLaunchCode(code);
        });
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        showError();
    }
});

// Chargement des applications depuis le fichier JSON
async function loadApps() {
    try {
        const response = await fetch('./app.json');
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const data = await response.json();
        allApps = data.apps || [];
        filteredApps = [...allApps];
        
        // Extraire les catégories uniques
        extractCategories();
        
        // Simulation d'un délai de chargement pour montrer l'animation
        await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
        throw new Error('Impossible de charger les applications: ' + error.message);
    }
}

// Fonction pour extraire les catégories uniques du JSON
function extractCategories() {
    const categoriesSet = new Set();
    
    allApps.forEach(app => {
        if (app.category && app.category.trim()) {
            categoriesSet.add(app.category.trim());
        }
    });
    
    // Convertir en array et trier par ordre alphabétique
    availableCategories = Array.from(categoriesSet).sort((a, b) => 
        a.toLowerCase().localeCompare(b.toLowerCase(), 'fr')
    );
    
    console.log('Catégories détectées:', availableCategories);
}

// ET aussi modifier la fonction generateCategoryTabs pour être plus robuste :
function generateCategoryTabs() {
  // Vérifier que filterTabsContainer existe
  if (!filterTabsContainer) {
    console.error('filterTabsContainer non disponible pour generateCategoryTabs');
    return;
  }
  
  // Vider le conteneur
  filterTabsContainer.innerHTML = '';
  
  // Créer le bouton "Toutes"
  const allButton = createCategoryButton('all', 'Toutes', true);
  filterTabsContainer.appendChild(allButton);
  
  // Créer un bouton pour chaque catégorie trouvée
  availableCategories.forEach(category => {
    const button = createCategoryButton(category, category, false);
    filterTabsContainer.appendChild(button);
  });
  
  console.log(`${availableCategories.length + 1} onglets de catégories générés`);
}

// Fonction pour créer un bouton de catégorie
function createCategoryButton(categoryId, categoryLabel, isActive = false) {
    const button = document.createElement('button');
    button.className = `filter-tab ${isActive ? 'active' : ''}`;
    button.dataset.category = categoryId;
    button.textContent = categoryLabel;
    
    // Ajouter l'icône appropriée selon la catégorie
    const categoryIcon = getCategoryIcon(categoryId);
    if (categoryIcon) {
        button.innerHTML = `${categoryIcon} ${categoryLabel}`;
    }
    
    // Ajouter l'événement de clic
    button.addEventListener('click', () => handleCategoryFilter(button));
    
    return button;
}

// Fonction pour obtenir l'icône d'une catégorie
function getCategoryIcon(category) {
    const iconMap = {
        'all': '🌐',
        'IA': '🤖',
        'Productivité': '⚡',
        'Communication': '💬',
        'Développement': '💻',
        'divertissement': '🎮',
        'Divertissement': '🎮',
        'Mon Site': '🏠',
        'Design': '🎨',
        'Musique': '🎵',
        'Éducation': '📚',
        'Finance': '💰',
        'Santé': '❤️',
        'Sport': '⚽',
        'Voyage': '✈️',
        'Shopping': '🛒',
        'Actualités': '📰'
    };
    
    return iconMap[category] || '📁';
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Vérifier que searchInput existe
    if (searchInput) {
        // Recherche en temps réel
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        
        // Gestion du clavier pour la recherche
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                handleSearch();
            }
        });
    }
    
    // Note : Les filtres par catégorie sont maintenant gérés lors de la création des boutons
    
    // Gestion du clavier pour la recherche
    // searchInput.addEventListener('keydown', (e) => {
    //     if (e.key === 'Escape') {
    //         searchInput.value = '';
    //         handleSearch();
    //     }
    // });
}

// Gestion de la recherche
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    filteredApps = allApps.filter(app => {
        const matchesSearch = !searchTerm || 
            app.name.toLowerCase().includes(searchTerm) ||
            app.description.toLowerCase().includes(searchTerm) ||
            app.category.toLowerCase().includes(searchTerm);
        
        const matchesCategory = currentCategory === 'all' || app.category === currentCategory;
        
        return matchesSearch && matchesCategory;
    });
    
    displayApps(filteredApps, false); // Pas d'animation lors des recherches/filtres
}

// Gestion des filtres par catégorie
function handleCategoryFilter(selectedTab) {
    // Mise à jour de l'état actif des onglets (tous les boutons dans le conteneur)
    const allFilterTabs = filterTabsContainer.querySelectorAll('.filter-tab');
    allFilterTabs.forEach(tab => tab.classList.remove('active'));
    selectedTab.classList.add('active');
    
    // Mise à jour de la catégorie actuelle
    currentCategory = selectedTab.dataset.category;
    
    // Animation de transition
    appsGrid.style.opacity = '0.7';
    setTimeout(() => {
        handleSearch();
        appsGrid.style.opacity = '1';
    }, 150);
    
    console.log(`Filtrage par catégorie: ${currentCategory}`);
}

// Affichage des applications
function displayApps(apps, shouldAnimate = true) {
  // Vérifier que appsGrid existe
  if (!appsGrid) {
    console.error('appsGrid non disponible pour displayApps');
    return;
  }
  
  if (apps.length === 0) {
    showNoResults();
    return;
  }
  
  appsGrid.innerHTML = '';
  
  apps.forEach((app, index) => {
    const appCard = createAppCard(app, index, shouldAnimate);
    appsGrid.appendChild(appCard);
  });
  
  // Marquer que l'animation initiale a été jouée
  if (shouldAnimate && !hasPlayedInitialAnimation) {
    // Attendre que toutes les animations soient terminées
    setTimeout(() => {
      hasPlayedInitialAnimation = true;
    }, (apps.length * 100) + 1000); // 100ms par carte + 1s de marge
  }
}

// Création d'une carte d'application
function createAppCard(app, index, shouldAnimate = true) {
    const card = document.createElement('div');
    card.className = 'app-card';
    
    // Vérifier si l'app est préchargée
    const isPreloaded = preloadStatus.preloadedUrls.includes(app.url);
    
    // Animation de délai pour l'apparition échelonnée (seulement si nécessaire)
    if (shouldAnimate && !hasPlayedInitialAnimation) {
        card.style.animationDelay = `${index * 0.1}s`;
    } else {
        // Pas d'animation, apparition immédiate
        card.style.animation = 'none';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }
    
    // Créer l'icône (emoji ou fichier)
    let iconHtml;
    if (app.iconFile) {
        iconHtml = `<img class="app-icon-file" src="./icon/${app.iconFile}" alt="${app.name}" onerror="this.style.display='none'; if(this.nextSibling && this.nextSibling.style) this.nextSibling.style.display='block';">
                   <span class="app-icon" style="display:none;">${app.icon || '📱'}</span>`;
    } else {
        iconHtml = `<span class="app-icon">${app.icon || '📱'}</span>`;
    }
    
    card.innerHTML = `
        ${iconHtml}
        <h3 class="app-name">${escapeHtml(app.name)}</h3>
        <p class="app-description">${escapeHtml(app.description)}</p>
        <div class="app-footer">
            <span class="app-category">${escapeHtml(app.category)}</span>
            ${isPreloaded ? '<span class="preload-indicator" title="Application préchargée - Ouverture instantanée !">⚡</span>' : ''}
        </div>
    `;
    
    // Gestion du clic pour ouvrir l'application
    card.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Animation de clic
        card.style.transform = 'translateY(-4px) scale(0.98)';
        
        // Afficher un indicateur de chargement sur la carte
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'card-loading';
        loadingIndicator.innerHTML = '⏳';
        loadingIndicator.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 1.2rem;
            animation: spin 1s linear infinite;
        `;
        card.style.position = 'relative';
        card.appendChild(loadingIndicator);
        
        try {
            // Utiliser IPC pour ouvrir l'application
            const result = await ipcRenderer.invoke('open-app', app.url);
            
            if (result.success) {
                console.log(`Application ${app.name} ouverte ${result.preloaded ? '(préchargée)' : '(nouvelle fenêtre)'}`);
                
                // Animation de succès
                card.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
                setTimeout(() => {
                    card.style.backgroundColor = '';
                }, 1000);
                
                // Mettre à jour le statut si l'app était préchargée
                if (result.preloaded) {
                    updatePreloadStatus();
                }
            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Erreur lors de l\'ouverture de l\'application:', error);
            
            // Animation d'erreur
            card.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            setTimeout(() => {
                card.style.backgroundColor = '';
            }, 1000);
            
            // Fallback: ouvrir dans le navigateur par défaut
            require('electron').shell.openExternal(app.url);
        } finally {
            // Supprimer l'indicateur de chargement et remettre la transformation
            loadingIndicator.remove();
            setTimeout(() => {
                card.style.transform = '';
            }, 150);
        }
    });
    
    // Animation au survol
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-8px) rotate(1deg)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
    
    return card;
}

// Affichage du message "Aucun résultat"
function showNoResults() {
    appsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: rgba(255, 255, 255, 0.8);">
            <div style="font-size: 4rem; margin-bottom: 1rem;">🔍</div>
            <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Aucune application trouvée</h3>
            <p>Essayez de modifier votre recherche ou sélectionner une autre catégorie.</p>
        </div>
    `;
}

// Affichage d'une erreur
function showError() {
    if (loading && loading.classList) {
        hideLoading();
    }
    
    // Vérifier que appsGrid existe avant de modifier innerHTML
    if (appsGrid) {
        appsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: rgba(255, 255, 255, 0.8);">
                <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Erreur de chargement</h3>
                <p>Impossible de charger les applications. Vérifiez le fichier app.json.</p>
                <button onclick="location.reload()" style="
                    margin-top: 1rem; 
                    padding: 0.8rem 1.5rem; 
                    background: linear-gradient(135deg, #667eea, #764ba2); 
                    color: white; 
                    border: none; 
                    border-radius: 25px; 
                    cursor: pointer;
                    transition: transform 0.2s ease;
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                    Réessayer
                </button>
            </div>
        `;
    }
}

// Masquer l'indicateur de chargement
function hideLoading() {
    if (loading && loading.classList) {
        loading.classList.add('hidden');
    }
}

// Fonction utilitaire pour débouncer la recherche
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Fonction utilitaire pour échapper les caractères HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Gestion des raccourcis clavier
document.addEventListener('keydown', (e) => {
    // Focus sur la recherche avec Ctrl+F ou /
    if ((e.ctrlKey && e.key === 'f') || e.key === '/') {
        e.preventDefault();
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
    
    // Navigation dans les catégories avec les flèches
    if (e.target === document.body && filterTabsContainer) {
        const allFilterTabs = filterTabsContainer.querySelectorAll('.filter-tab');
        if (allFilterTabs.length > 0) {
            const currentTabIndex = Array.from(allFilterTabs).findIndex(tab => tab.classList.contains('active'));
            
            if (e.key === 'ArrowRight' && currentTabIndex < allFilterTabs.length - 1) {
                allFilterTabs[currentTabIndex + 1].click();
            } else if (e.key === 'ArrowLeft' && currentTabIndex > 0) {
                allFilterTabs[currentTabIndex - 1].click();
            }
        }
    }
});

// Animation de particules de fond (optionnel)
function createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
    `;
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            animation: float ${5 + Math.random() * 10}s linear infinite;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 5}s;
        `;
        particlesContainer.appendChild(particle);
    }
    
    document.body.appendChild(particlesContainer);
}

// Créer les particules après le chargement de la page SEULEMENT si on n'a pas "no-files"
if (launchCode !== 'no-files') {
    setTimeout(createParticles, 1000);
}

// Style pour l'animation des particules
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0; }
        10%, 90% { opacity: 1; }
        50% { transform: translateY(-20px) rotate(180deg); }
    }
    
    .app-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: auto;
    }
    
    .preload-indicator {
        font-size: 1.2rem;
        animation: pulse 2s infinite;
        color: var(--preload-indicator-color);
        text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.1); }
    }
    
    .preload-status {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--status-bg);
        backdrop-filter: blur(20px);
        border-radius: 15px;
        padding: 10px 15px;
        font-size: 0.9rem;
        color: var(--status-text);
        box-shadow: var(--shadow);
        border: 1px solid var(--border-color);
        transition: all 0.3s ease;
        z-index: 1000;
    }
    
    .preload-status:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }
    
    .card-loading {
        animation: spin 1s linear infinite !important;
    }
`;
document.head.appendChild(style);

// Fonction pour surveiller le statut du préchargement
async function startPreloadMonitoring() {
    // Créer un indicateur de statut
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'preload-status';
    statusIndicator.innerHTML = 'Préchargement en cours... ⏳';
    document.body.appendChild(statusIndicator);
    
    // Mettre à jour le statut périodiquement
    const updateInterval = setInterval(async () => {
        await updatePreloadStatus();
    }, 2000);
    
    // Cacher l'indicateur après 30 secondes
    setTimeout(() => {
        statusIndicator.style.opacity = '0';
        setTimeout(() => {
            statusIndicator.remove();
            clearInterval(updateInterval);
        }, 300);
    }, 30000);
}

// Fonction pour mettre à jour le statut du préchargement
async function updatePreloadStatus() {
    try {
        const status = await ipcRenderer.invoke('get-preload-status');
        preloadStatus = status;
        
        console.log(`Statut du préchargement: ${status.preloadedApps}/${status.totalApps} applications préchargées`);
        
        // Mettre à jour l'indicateur de statut s'il existe
        const statusIndicator = document.querySelector('.preload-status');
        if (statusIndicator) {
            const percentage = status.totalApps > 0 ? Math.round((status.preloadedApps / status.totalApps) * 100) : 0;
            
            if (status.preloadedApps === 0) {
                statusIndicator.innerHTML = 'Préchargement en cours... ⏳';
            } else if (status.preloadedApps < status.totalApps) {
                statusIndicator.innerHTML = `Préchargé: ${status.preloadedApps}/${status.totalApps} (${percentage}%) ⚡`;
            } else {
                statusIndicator.innerHTML = `✅ Toutes les apps préchargées ! ⚡`;
                statusIndicator.style.background = 'rgba(76, 175, 80, 0.9)';
                statusIndicator.style.color = 'white';
            }
        }
        
        // Mettre à jour seulement les indicateurs de préchargement sans recréer les cartes
        if (status.preloadedApps > 0) {
            updatePreloadIndicators();
        }
        
    } catch (error) {
        console.error('Erreur lors de la récupération du statut:', error);
    }
}

// Fonction pour mettre à jour uniquement les indicateurs de préchargement sur les cartes existantes
function updatePreloadIndicators() {
    const existingCards = appsGrid.querySelectorAll('.app-card');
    
    existingCards.forEach(card => {
        const appName = card.querySelector('.app-name').textContent;
        const app = allApps.find(a => a.name === appName);
        
        if (app) {
            const isPreloaded = preloadStatus.preloadedUrls.includes(app.url);
            const footer = card.querySelector('.app-footer');
            const existingIndicator = footer.querySelector('.preload-indicator');
            
            if (isPreloaded && !existingIndicator) {
                // Ajouter l'indicateur de préchargement
                const indicator = document.createElement('span');
                indicator.className = 'preload-indicator';
                indicator.title = 'Application préchargée - Ouverture instantanée !';
                indicator.textContent = '⚡';
                footer.appendChild(indicator);
                
                // Animation d'apparition de l'indicateur
                indicator.style.opacity = '0';
                indicator.style.transform = 'scale(0)';
                setTimeout(() => {
                    indicator.style.transition = 'all 0.3s ease';
                    indicator.style.opacity = '1';
                    indicator.style.transform = 'scale(1)';
                }, 100);
            }
        }
    });
}

// Fonction pour afficher des statistiques détaillées (pour le debug)
function showPreloadStats() {
    console.log('=== STATISTIQUES DE PRÉCHARGEMENT ===');
    console.log(`Total d'applications: ${preloadStatus.totalApps}`);
    console.log(`Applications préchargées: ${preloadStatus.preloadedApps}`);
    console.log('URLs préchargées:', preloadStatus.preloadedUrls);
    
    const percentage = preloadStatus.totalApps > 0 ? 
        Math.round((preloadStatus.preloadedApps / preloadStatus.totalApps) * 100) : 0;
    console.log(`Pourcentage de préchargement: ${percentage}%`);
}

// Exposer la fonction de stats pour le debug
window.showPreloadStats = showPreloadStats;

// ============ GESTION DES THÈMES ============

// Initialiser le thème au chargement de la page
async function initializeTheme() {
    try {
        // Récupérer le thème sauvegardé dans localStorage
        const savedTheme = localStorage.getItem('app-theme') || 'light';
        currentTheme = savedTheme;
        
        console.log(`Thème initialisé: ${currentTheme}`);
        applyTheme(currentTheme);
        
        // Écouter les changements de thème depuis le menu principal
        ipcRenderer.on('theme-changed', (event, theme) => {
            console.log(`Changement de thème reçu: ${theme}`);
            setTheme(theme);
        });
        
        // Écouter les mises à jour des applications depuis le gestionnaire
        ipcRenderer.on('apps-data-updated', async () => {
            console.log('Données des applications mises à jour, rechargement...');
            try {
                await loadApps();
                generateCategoryTabs();
                handleSearch(); // Réappliquer les filtres actuels
                console.log('Applications mises à jour avec succès');
            } catch (error) {
                console.error('Erreur lors du rechargement des applications:', error);
            }
        });
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation du thème:', error);
        // Fallback vers le thème clair
        setTheme('light');
    }
}

// Appliquer un thème
function applyTheme(theme) {
    const body = document.body;
    
    // Supprimer les anciens attributs de thème
    body.removeAttribute('data-theme');
    
    // Appliquer le nouveau thème
    if (theme !== 'light') {
        body.setAttribute('data-theme', theme);
    }
    
    console.log(`Thème appliqué: ${theme}`);
}

// Changer de thème
function setTheme(theme) {
    currentTheme = theme;
    applyTheme(theme);
    
    // Sauvegarder le thème
    localStorage.setItem('app-theme', theme);
    
    // Informer Electron de la sauvegarde
    ipcRenderer.invoke('save-theme', theme);
    
    // Animation de transition pour le changement de thème
    document.body.style.transition = 'all 0.3s ease';
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
    
    console.log(`Thème changé vers: ${theme}`);
}

// Détecter les changements de préférence système (pour le thème auto)
if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', (e) => {
        if (currentTheme === 'auto') {
            console.log(`Préférence système changée: ${e.matches ? 'sombre' : 'clair'}`);
            // Le CSS se charge automatiquement du changement avec @media
        }
    });
}

// Fonction utilitaire pour obtenir le thème effectif (utile pour le thème auto)
function getEffectiveTheme() {
    if (currentTheme === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return currentTheme;
}

// Exposer les fonctions de thème pour le debug
window.setTheme = setTheme;
window.getCurrentTheme = () => currentTheme;
window.getEffectiveTheme = getEffectiveTheme;
