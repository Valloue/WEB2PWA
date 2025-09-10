// Variables globales
let appsData = { apps: [] };
let filteredApps = [];
let availableCategories = [];
let availableIcons = [];
let currentFilter = 'all';
let editingAppIndex = -1;
let selectedIconType = 'file'; // ✅ CHANGÉ : 'emoji' → 'file'

// Éléments DOM
const { ipcRenderer } = require('electron');
const appsList = document.getElementById('appsList');
const searchInput = document.getElementById('searchInput');
const categoryFilters = document.getElementById('categoryFilters');
const totalAppsElement = document.getElementById('totalApps');
const totalCategoriesElement = document.getElementById('totalCategories');

// Boutons
const addAppBtn = document.getElementById('addAppBtn');
const saveBtn = document.getElementById('saveBtn');

// Modal
const appModal = document.getElementById('appModal');
const modalTitle = document.getElementById('modalTitle');
const appForm = document.getElementById('appForm');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');

// Champs du formulaire
const appNameInput = document.getElementById('appName');
const appDescriptionInput = document.getElementById('appDescription');
const appUrlInput = document.getElementById('appUrl');
const appIconInput = document.getElementById('appIcon');
const appCategorySelect = document.getElementById('appCategory');
const newCategoryInput = document.getElementById('newCategory');
const testUrlBtn = document.getElementById('testUrlBtn');

// Éléments pour les icônes fichiers
const iconTypeRadios = document.querySelectorAll('input[name="iconType"]');
// ✅ SUPPRIMÉ : const emojiSection = document.getElementById('emojiSection');
const fileSection = document.getElementById('fileSection');
const faviconSection = document.getElementById('faviconSection');
const iconFileInput = document.getElementById('iconFileInput');
const uploadIconBtn = document.getElementById('uploadIconBtn');
const selectedFileName = document.getElementById('selectedFileName');
const availableIconsContainer = document.getElementById('availableIcons');
const iconGrid = document.getElementById('iconGrid');
const iconPreview = document.getElementById('iconPreview');
const previewImage = document.getElementById('previewImage');
const selectedIconFile = document.getElementById('selectedIconFile');

// Éléments pour le favicon
const fetchFaviconBtn = document.getElementById('fetchFaviconBtn');
const faviconPreview = document.getElementById('faviconPreview');
const faviconPreviewImage = document.getElementById('faviconPreviewImage');
const faviconFileName = document.getElementById('faviconFileName');
const faviconStatus = document.getElementById('faviconStatus');
const faviconStatusMessage = document.getElementById('faviconStatusMessage');

// Modal de suppression
const deleteModal = document.getElementById('deleteModal');
const deleteAppName = document.getElementById('deleteAppName');
const deleteModalClose = document.getElementById('deleteModalClose');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// Toast
// Supprimer la fonction showToast et tous ses appels
// Supprimer les éléments DOM toast et toastMessage

// Variables pour la suppression
let deleteAppIndex = -1;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Gestionnaire d\'applications initialisé');
    
    try {
        await loadAppsData();
        await loadCategories();
        await loadAvailableIcons();
        setupEventListeners();
        generateCategoryFilters();
        updateStats();
        displayApps();
        
        // ✅ SUPPRIMÉ : showToast('Gestionnaire chargé avec succès', 'success');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        // Initialiser avec des données vides si erreur
        appsData = { apps: [] };
        filteredApps = [];
    }
});

// Charger les données des applications
async function loadAppsData() {
    try {
        const result = await ipcRenderer.invoke('load-apps-data');
        
        if (result.success) {
            appsData = result.data;
            filteredApps = [...appsData.apps];
            console.log(`${appsData.apps.length} applications chargées`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        // Initialiser avec des données vides si erreur
        appsData = { apps: [] };
        filteredApps = [];
    }
}

// Charger les catégories disponibles
async function loadCategories() {
    try {
        availableCategories = await ipcRenderer.invoke('get-available-categories');
        populateCategorySelect();
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
        availableCategories = ['Productivité', 'Communication', 'Développement', 'Divertissement'];
        populateCategorySelect();
    }
}

// Charger les icônes disponibles
async function loadAvailableIcons() {
    try {
        availableIcons = await ipcRenderer.invoke('get-available-icons');
        populateIconGrid();
        console.log(`${availableIcons.length} icônes chargées`);
    } catch (error) {
        console.error('Erreur lors du chargement des icônes:', error);
        availableIcons = [];
    }
}

// Peupler le select des catégories
function populateCategorySelect() {
    appCategorySelect.innerHTML = '<option value="">Sélectionner une catégorie...</option>';
    
    availableCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        appCategorySelect.appendChild(option);
    });
    
    // Option pour créer une nouvelle catégorie
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = '+ Créer une nouvelle catégorie';
    appCategorySelect.appendChild(newOption);
}

// Peupler la grille des icônes disponibles
function populateIconGrid() {
    iconGrid.innerHTML = '';
    
    if (availableIcons.length === 0) {
        iconGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">Aucune icône disponible</p>';
        return;
    }
    
    availableIcons.forEach(iconFile => {
        const iconOption = createIconFileOption(iconFile);
        iconGrid.appendChild(iconOption);
    });
}

// Créer une option d'icône fichier
function createIconFileOption(iconFile) {
    const option = document.createElement('div');
    option.className = 'icon-file-option';
    option.dataset.iconFile = iconFile;
    
    const img = document.createElement('img');
    img.src = `./icon/${iconFile}`;
    img.alt = iconFile;
    img.onerror = function() {
        this.style.display = 'none';
        this.nextSibling.style.display = 'flex';
    };
    
    const fallback = document.createElement('div');
    fallback.textContent = '📁';
    fallback.style.display = 'none';
    fallback.style.fontSize = '24px';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-icon';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Supprimer cette icône';
    
    option.appendChild(img);
    option.appendChild(fallback);
    option.appendChild(deleteBtn);
    
    // Événement de sélection
    option.addEventListener('click', (e) => {
        if (e.target === deleteBtn) return;
        
        // Désélectionner toutes les autres icônes
        document.querySelectorAll('.icon-file-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Sélectionner cette icône
        option.classList.add('selected');
        selectedIconFile.value = iconFile;
        
        // Afficher l'aperçu
        showIconPreview(iconFile);
    });
    
    // Événement de suppression
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        if (confirm(`Supprimer l'icône "${iconFile}" ?`)) {
            const result = await ipcRenderer.invoke('delete-icon', iconFile);
            if (result.success) {
                // showToast(`Icône "${iconFile}" supprimée`, 'success'); // Supprimé
                await loadAvailableIcons();
            } else {
                // showToast('Erreur lors de la suppression', 'error'); // Supprimé
            }
        }
    });
    
    return option;
}

// Afficher l'aperçu d'une icône
function showIconPreview(iconFile) {
    previewImage.src = `./icon/${iconFile}`;
    previewImage.alt = iconFile;
    iconPreview.style.display = 'block';
}

// Générer les filtres de catégories
function generateCategoryFilters() {
    categoryFilters.innerHTML = '';
    
    // Filtre "Toutes"
    const allFilter = createCategoryFilter('all', 'Toutes les applications', true);
    categoryFilters.appendChild(allFilter);
    
    // Extraire les catégories uniques des applications
    const usedCategories = [...new Set(appsData.apps.map(app => app.category).filter(Boolean))];
    
    usedCategories.sort().forEach(category => {
        const filter = createCategoryFilter(category, category, false);
        categoryFilters.appendChild(filter);
    });
}

// Créer un filtre de catégorie
function createCategoryFilter(value, text, isActive) {
    const button = document.createElement('button');
    button.className = `category-filter ${isActive ? 'active' : ''}`;
    button.textContent = text;
    button.dataset.category = value;
    
    button.addEventListener('click', () => {
        // Retirer la classe active de tous les filtres
        document.querySelectorAll('.category-filter').forEach(f => f.classList.remove('active'));
        // Ajouter la classe active au filtre cliqué
        button.classList.add('active');
        
        currentFilter = value;
        filterApps();
    });
    
    return button;
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Recherche
    searchInput.addEventListener('input', debounce(filterApps, 300));
    
    // Boutons principaux
    addAppBtn.addEventListener('click', () => openAppModal());
    saveBtn.addEventListener('click', saveAllApps);
    
    // Modal
    modalClose.addEventListener('click', closeAppModal);
    cancelBtn.addEventListener('click', closeAppModal);
    appForm.addEventListener('submit', handleFormSubmit);
    
    // Modal de suppression
    deleteModalClose.addEventListener('click', closeDeleteModal);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Fermer les modals en cliquant à l'extérieur
    appModal.addEventListener('click', (e) => {
        if (e.target === appModal) closeAppModal();
    });
    
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });
    
    // Gestion des catégories
    appCategorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'new') {
            newCategoryInput.style.display = 'block';
            newCategoryInput.focus();
        } else {
            newCategoryInput.style.display = 'none';
        }
    });
    
    // Gestion du type d'icône
    iconTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedIconType = e.target.value;
            toggleIconSections();
        });
    });
    
    // Upload d'icône
    uploadIconBtn.addEventListener('click', () => {
        iconFileInput.click();
    });
    
    iconFileInput.addEventListener('change', handleFileUpload);
    
    // Favicon
    fetchFaviconBtn.addEventListener('click', handleFaviconFetch);
    
    // Suggestions d'icônes emoji
    document.querySelectorAll('.icon-option').forEach(icon => {
        icon.addEventListener('click', (e) => {
            appIconInput.value = e.target.dataset.icon;
        });
    });
    
    // Test d'URL
    testUrlBtn.addEventListener('click', testUrl);

    // Écouter le code de lancement pour ouvrir automatiquement la popup d'ajout
    if (window.require) {
      const { ipcRenderer } = require('electron');
      
      console.log('=== MISE EN PLACE DE L\'ÉCOUTEUR ==='); // Debug
      console.log('ipcRenderer disponible:', !!ipcRenderer); // Debug
      
      ipcRenderer.on('launch-code', (event, code) => {
        console.log('=== CODE DE LANCEMENT REÇU ==='); // Debug
        console.log('Code reçu:', code); // Debug
        console.log('Type de code:', typeof code); // Debug
        
        if (code === 'add-app-modal') {
          console.log('Code add-app-modal reçu, ouverture automatique de la popup...'); // Debug
          // Attendre un peu que tout soit initialisé
          setTimeout(() => {
            console.log('Tentative d\'ouverture de la popup...'); // Debug
            openAppModal();
          }, 10); // ✅ Réduire de 1000ms à 100ms
        } else {
          console.log('Code normal reçu:', code); // Debug
        }
      });
    }
}

// Filtrer les applications
function filterApps() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    filteredApps = appsData.apps.filter(app => {
        const matchesSearch = !searchTerm || 
            app.name.toLowerCase().includes(searchTerm) ||
            app.description.toLowerCase().includes(searchTerm) ||
            app.url.toLowerCase().includes(searchTerm) ||
            app.category.toLowerCase().includes(searchTerm);
        
        const matchesCategory = currentFilter === 'all' || app.category === currentFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    displayApps();
}

// Afficher les applications
function displayApps() {
    if (filteredApps.length === 0) {
        showEmptyState();
        return;
    }
    
    appsList.innerHTML = '';
    
    filteredApps.forEach((app, index) => {
        const originalIndex = appsData.apps.findIndex(a => 
            a.name === app.name && a.url === app.url
        );
        const appCard = createAppCard(app, originalIndex);
        appsList.appendChild(appCard);
    });
}

// Créer une carte d'application
function createAppCard(app, originalIndex) {
    const card = document.createElement('div');
    card.className = 'app-card';
    
    // Créer l'icône (emoji ou fichier)
    let iconHtml;
    if (app.iconFile) {
        iconHtml = `<img class="app-icon-file" src="./icon/${app.iconFile}" alt="${app.name}" onerror="this.style.display='none'; this.nextSibling.style.display='inline';">
                   <span class="app-icon" style="display:none;">📱</span>`;
    } else {
        iconHtml = `<span class="app-icon">${app.icon || '📱'}</span>`;
    }
    
    card.innerHTML = `
        <div class="app-card-header">
            <div class="app-info">
                ${iconHtml}
                <h3 class="app-name">${escapeHtml(app.name)}</h3>
                <p class="app-description">${escapeHtml(app.description)}</p>
                <div class="app-url">${escapeHtml(app.url)}</div>
                <span class="app-category">${escapeHtml(app.category)}</span>
            </div>
            <div class="app-actions">
                <button class="action-btn edit-btn" title="Modifier"><img src="./icons/edit.png" alt="Modifier" style="width: 20px; height: 20px;"></button>
                <button class="action-btn delete-btn" title="Supprimer"><img src="./icons/delete.png" alt="Supprimer" style="width: 20px; height: 20px;"></button>
            </div>
        </div>
    `;
    
    // Événements pour les boutons d'action
    const editBtn = card.querySelector('.edit-btn');
    const deleteBtn = card.querySelector('.delete-btn');
    
    editBtn.addEventListener('click', () => openAppModal(originalIndex));
    deleteBtn.addEventListener('click', () => openDeleteModal(originalIndex));
    
    return card;
}

// Basculer entre les sections d'icônes
function toggleIconSections() {
    // Cacher toutes les sections
    // ✅ SUPPRIMÉ : emojiSection.style.display = 'none';
    fileSection.style.display = 'none';
    faviconSection.style.display = 'none';
    
    // Afficher la section sélectionnée
    // ✅ SUPPRIMÉ : if (selectedIconType === 'emoji') { emojiSection.style.display = 'block'; }
    if (selectedIconType === 'file') {
        fileSection.style.display = 'block';
    } else if (selectedIconType === 'favicon') {
        faviconSection.style.display = 'block';
    }
}

// Gérer l'upload de fichier
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vérifier le type de fichier
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/x-icon'];
    if (!allowedTypes.includes(file.type)) {
        // showToast('Type de fichier non supporté. Utilisez PNG, JPG, SVG, WebP ou ICO.', 'error'); // Supprimé
        return;
    }
    
    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        // showToast('Fichier trop volumineux. Maximum 2MB.', 'error'); // Supprimé
        return;
    }
    
    try {
        // Lire le fichier
        const reader = new FileReader();
        reader.onload = async function(e) {
            const result = await ipcRenderer.invoke('save-icon', e.target.result, file.name);
            
            if (result.success) {
                // showToast(`Icône "${result.fileName}" ajoutée avec succès`, 'success'); // Supprimé
                selectedFileName.textContent = result.fileName;
                selectedIconFile.value = result.fileName;
                
                // Recharger les icônes
                await loadAvailableIcons();
                
                // Sélectionner automatiquement la nouvelle icône
                setTimeout(() => {
                    const newIconOption = document.querySelector(`[data-icon-file="${result.fileName}"]`);
                    if (newIconOption) {
                        newIconOption.click();
                    }
                }, 100);
            } else {
                // showToast('Erreur lors de l\'ajout de l\'icône', 'error'); // Supprimé
            }
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
        // showToast('Erreur lors de l\'upload', 'error'); // Supprimé
    }
}

// Gérer la récupération du favicon
async function handleFaviconFetch() {
    try {
        const url = appUrlInput.value.trim();
        if (!url) {
            // showToast('Veuillez saisir une URL', 'error'); // Supprimé
            return;
        }

        fetchFaviconBtn.disabled = true;
        fetchFaviconBtn.innerHTML = '<span class="btn-icon">⏳</span> Récupération...';
        
        console.log('🔍 Début de la récupération du favicon pour:', url);

        const result = await ipcRenderer.invoke('fetch-favicon', url);
        
        console.log('📡 Résultat reçu:', result);

        if (result.success) {
            const qualityInfo = result.quality ? ` (${result.quality})` : '';
            // showToast(`Favicon récupéré avec succès${qualityInfo}`, 'success'); // Supprimé
            
            // Afficher l'aperçu avec les données base64
            faviconPreviewImage.src = result.base64Data;
            faviconFileName.textContent = `Icône en mémoire${qualityInfo}`;
            faviconPreview.style.display = 'block';
            
            // Stocker temporairement les données base64 pour la sauvegarde ultérieure
            window.selectedFaviconData = {
                base64Data: result.base64Data,
                mimeType: result.mimeType,
                originalUrl: url,
                quality: result.quality
            };
            
            // Indiquer qu'une icône est sélectionnée mais pas encore sauvegardée
            selectedIconFile.value = 'favicon_en_memoire';
            
        } else if (result.needsUserChoice) {
            console.log('🎯 Demande de choix utilisateur détectée');
            console.log(' Icônes disponibles:', result.icons);
            
            // L'utilisateur doit choisir entre plusieurs icônes
            showIconChoiceDialog(result.icons, url);
        } else {
            console.log('❌ Erreur:', result.error);
            // showToast(`Erreur : ${result.error}`, 'error'); // Supprimé
        }
        
    } catch (error) {
        console.error('❌ Erreur lors de la récupération du favicon:', error);
        // showToast('Erreur lors de la récupération du favicon', 'error'); // Supprimé
    } finally {
        fetchFaviconBtn.disabled = false;
        fetchFaviconBtn.innerHTML = '🌐 Récupérer le favicon automatiquement';
    }
}

// Afficher l'état vide
function showEmptyState() {
    appsList.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📱</div>
            <h3>Aucune application trouvée</h3>
            <p>Ajoutez votre première application ou modifiez vos critères de recherche.</p>
        </div>
    `;
}

// Ouvrir le modal d'ajout/édition
function openAppModal(appIndex = -1) {
    editingAppIndex = appIndex;
    
    // Si c'est le premier lancement (pas d'apps), créer app.json
    if (appIndex === -1 && (!appsData || !appsData.apps || appsData.apps.length === 0)) {
        console.log('Premier lancement détecté, création d\'app.json...'); // Debug
        
        // Créer app.json via IPC
        if (window.require) {
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('createDefaultAppJson').then(result => {
                if (result.success) {
                    console.log('App.json créé avec succès'); // Debug
                    // Recharger les données
                    loadAppsData();
                }
            });
        }
    }
    
    if (appIndex >= 0) {
        // Mode édition
        const app = appsData.apps[appIndex];
        modalTitle.textContent = 'Modifier l\'application';
        appNameInput.value = app.name;
        appDescriptionInput.value = app.description;
        appUrlInput.value = app.url;
        appCategorySelect.value = app.category;
        
        // Gérer l'icône
        if (app.iconFile) {
            // Déterminer si c'est un favicon ou un fichier normal
            if (app.iconFile.startsWith('favicon_')) {
                selectedIconType = 'favicon';
                document.querySelector('input[name="iconType"][value="favicon"]').checked = true;
                
                // Afficher l'aperçu du favicon
                if (faviconPreviewImage && faviconFileName && faviconPreview) {
                    faviconPreviewImage.src = `./icon/${app.iconFile}`;
                    faviconFileName.textContent = app.iconFile;
                    faviconPreview.style.display = 'block';
                }
            } else {
                selectedIconType = 'file';
                document.querySelector('input[name="iconType"][value="file"]').checked = true;
                showIconPreview(app.iconFile);
                
                // Sélectionner l'icône dans la grille
                setTimeout(() => {
                    const iconOption = document.querySelector(`[data-icon-file="${app.iconFile}"]`);
                    if (iconOption) {
                        iconOption.click();
                    }
                }, 100);
            }
            
            selectedIconFile.value = app.iconFile;
        } else {
            // ✅ SUPPRIMÉ : Icône emoji - maintenant par défaut fichier
            selectedIconType = 'file';
            document.querySelector('input[name="iconType"][value="file"]').checked = true;
        }
    } else {
        // Mode ajout
        modalTitle.textContent = 'Ajouter une application';
        appForm.reset();
        // ✅ CHANGÉ : 'emoji' → 'file'
        selectedIconType = 'file';
        document.querySelector('input[name="iconType"][value="file"]').checked = true;
        selectedIconFile.value = '';
        
        // Vérifier que les éléments existent avant de les manipuler
        if (iconPreview) {
            iconPreview.style.display = 'none';
        }
        if (faviconPreview) {
            faviconPreview.style.display = 'none';
        }
        if (faviconStatus) {
            faviconStatus.style.display = 'none';
        }
        
        // Nettoyer les données temporaires de favicon
        if (window.selectedFaviconData) {
            delete window.selectedFaviconData;
        }
    }
    
    toggleIconSections();
    if (newCategoryInput) {
        newCategoryInput.style.display = 'none';
    }
    appModal.classList.add('show');
    if (appNameInput) {
        appNameInput.focus();
    }
}

// Fermer le modal d'ajout/édition
function closeAppModal() {
    appModal.classList.remove('show');
    editingAppIndex = -1;
    appForm.reset();
    
    // Nettoyer les données temporaires de favicon
    if (window.selectedFaviconData) {
        delete window.selectedFaviconData;
    }
}

// Gérer la soumission du formulaire
function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        name: appNameInput.value.trim(),
        description: appDescriptionInput.value.trim(),
        url: appUrlInput.value.trim(),
        category: appCategorySelect.value === 'new' ? newCategoryInput.value.trim() : appCategorySelect.value
    };
    
    // Gérer l'icône selon le type sélectionné
    if (selectedIconType === 'file' || selectedIconType === 'favicon') {
        if (selectedIconFile.value) {
            formData.iconFile = selectedIconFile.value;
            // ✅ SUPPRIMÉ : Supprimer l'icône emoji si on utilise un fichier
            delete formData.icon;
        } else {
            const errorMsg = selectedIconType === 'favicon' 
                ? 'Veuillez récupérer le favicon du site' 
                : 'Veuillez sélectionner une icône fichier';
            // showToast(errorMsg, 'error'); // Supprimé
            return;
        }
    } else {
        // ✅ SUPPRIMÉ : formData.icon = appIconInput.value.trim() || '📱';
        // ✅ SUPPRIMÉ : Supprimer l'iconFile si on utilise un emoji
        // showToast('Veuillez sélectionner un type d\'icône valide', 'error'); // Supprimé
        return;
    }
    
    // Validation
    if (!formData.name || !formData.description || !formData.url || !formData.category) {
        // showToast('Veuillez remplir tous les champs', 'error'); // Supprimé
        return;
    }
    
    // Vérifier que l'URL est valide
    try {
        new URL(formData.url);
    } catch {
        // showToast('URL invalide', 'error'); // Supprimé
        return;
    }
    
    if (editingAppIndex >= 0) {
        // Modifier l'application existante
        appsData.apps[editingAppIndex] = formData;
        // showToast('Application modifiée avec succès', 'success'); // Supprimé
    } else {
        // Ajouter une nouvelle application
        appsData.apps.push(formData);
        // showToast('Application ajoutée avec succès', 'success'); // Supprimé
    }
    
    closeAppModal();
    refreshData();
}

// Ouvrir le modal de suppression
function openDeleteModal(appIndex) {
    deleteAppIndex = appIndex;
    const app = appsData.apps[appIndex];
    deleteAppName.textContent = app.name;
    deleteModal.classList.add('show');
}

// Fermer le modal de suppression
function closeDeleteModal() {
    deleteModal.classList.remove('show');
    deleteAppIndex = -1;
}

// Confirmer la suppression
function confirmDelete() {
    if (deleteAppIndex >= 0) {
        const deletedApp = appsData.apps[deleteAppIndex];
        appsData.apps.splice(deleteAppIndex, 1);
        // showToast(`Application "${deletedApp.name}" supprimée`, 'success'); // Supprimé
        closeDeleteModal();
        refreshData();
    }
}

// Tester une URL
function testUrl() {
    const url = appUrlInput.value.trim();
    if (!url) {
        // showToast('Veuillez entrer une URL', 'error'); // Supprimé
        return;
    }
    
    try {
        new URL(url);
        // Ouvrir l'URL dans le navigateur par défaut
        require('electron').shell.openExternal(url);
        // showToast('URL ouverte dans le navigateur', 'success'); // Supprimé
    } catch {
        // showToast('URL invalide', 'error'); // Supprimé
    }
}

// Sauvegarder toutes les applications
async function saveAllApps() {
    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="btn-icon">⏳</span> Sauvegarde...';
        
        // Si une icône favicon a été choisie mais pas encore sauvegardée, la sauvegarder maintenant
        if (window.selectedFaviconData && selectedIconFile.value === 'favicon_en_memoire') {
            try {
                console.log('Sauvegarde de l\'icône favicon choisie sur disque...');
                const iconResult = await ipcRenderer.invoke(
                    'save-base64-icon', 
                    window.selectedFaviconData.base64Data, 
                    window.selectedFaviconData.originalUrl, 
                    window.selectedFaviconData.mimeType
                );
                
                if (iconResult.success) {
                    // Mettre à jour la référence de l'icône dans l'application en cours d'édition
                    if (editingAppIndex >= 0) {
                        appsData.apps[editingAppIndex].iconFile = iconResult.fileName;
                    }
                    
                    // Nettoyer les données temporaires
                    delete window.selectedFaviconData;
                    selectedIconFile.value = iconResult.fileName;
                    
                    // showToast(`Icône favicon sauvegardée : ${iconResult.fileName}`, 'success'); // Supprimé
                } else {
                    throw new Error(`Erreur lors de la sauvegarde de l'icône : ${iconResult.error}`);
                }
            } catch (iconError) {
                console.error('Erreur lors de la sauvegarde de l\'icône:', iconError);
                // showToast(`Erreur lors de la sauvegarde de l'icône : ${iconError.message}`, 'error'); // Supprimé
                throw iconError; // Arrêter la sauvegarde des applications
            }
        }
        
        const result = await ipcRenderer.invoke('save-apps-data', appsData);
        
        if (result.success) {
            // showToast('Applications sauvegardées avec succès', 'success'); // Supprimé
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        // showToast('Erreur lors de la sauvegarde', 'error'); // Supprimé
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="btn-icon">��</span> Sauvegarder';
    }
}

// Rafraîchir les données après modification
function refreshData() {
    filteredApps = [...appsData.apps];
    generateCategoryFilters();
    updateStats();
    filterApps();
}

// Mettre à jour les statistiques
function updateStats() {
    const categoriesCount = new Set(appsData.apps.map(app => app.category).filter(Boolean)).size;
    totalAppsElement.textContent = appsData.apps.length;
    totalCategoriesElement.textContent = categoriesCount;
}

// Afficher un toast
// Supprimer la fonction showToast et tous ses appels
// Supprimer les éléments DOM toast et toastMessage

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

// Fonction utilitaire pour débouncer
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

// Raccourcis clavier
document.addEventListener('keydown', (e) => {
    // Ctrl+N pour ajouter une nouvelle application
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        openAppModal();
    }
    
    // Ctrl+S pour sauvegarder
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveAllApps();
    }
    
    // Échap pour fermer les modals
    if (e.key === 'Escape') {
        if (appModal.classList.contains('show')) {
            closeAppModal();
        }
        if (deleteModal.classList.contains('show')) {
            closeDeleteModal();
        }
    }
});

// Afficher le dialogue de choix d'icône
function showIconChoiceDialog(icons, originalUrl) {
    // Créer le modal de choix
    const choiceModal = document.createElement('div');
    choiceModal.className = 'modal show';
    choiceModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>🎯 Choisissez l'icône de votre choix</h3>
                <span class="modal-close">&times;</span>
            </div>
            <div class="modal-body">
                <p>Plusieurs icônes de bonne qualité ont été trouvées. Choisissez celle qui vous convient le mieux :</p>
                <div class="icon-choice-grid">
                    ${icons.map((icon, index) => `
                        <div class="icon-choice-option" data-index="${index}">
                            <div class="icon-choice-preview">
                                <img src="${icon.base64Data}" alt="Aperçu" onerror="this.style.display='none'">
                                <div class="icon-choice-fallback">🖼️</div>
                            </div>
                            <div class="icon-choice-info">
                                <div class="icon-choice-quality">${icon.quality}</div>
                                <div class="icon-choice-priority">Priorité: ${icon.priority}/100</div>
                                <button class="icon-choice-btn">Choisir cette icône</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Ajouter au DOM
    document.body.appendChild(choiceModal);
    
    // Gestionnaires d'événements
    const closeBtn = choiceModal.querySelector('.modal-close');
    const iconOptions = choiceModal.querySelectorAll('.icon-choice-option');
    
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(choiceModal);
    });
    
    // Fermer en cliquant à l'extérieur
    choiceModal.addEventListener('click', (e) => {
        if (e.target === choiceModal) {
            document.body.removeChild(choiceModal);
        }
    });
    
    // Gestion du choix d'icône
    iconOptions.forEach((option, index) => {
        const chooseBtn = option.querySelector('.icon-choice-btn');
        const icon = icons[index];
        
        chooseBtn.addEventListener('click', async () => {
            try {
                chooseBtn.disabled = true;
                chooseBtn.innerHTML = '⏳ Téléchargement...';
                
                // Télécharger l'icône choisie ET la sauvegarder sur disque
                const result = await ipcRenderer.invoke('download-specific-icon', icon.url, originalUrl);
                
                if (result.success) {
                    // Maintenant sauvegarder l'icône sur disque
                    const saveResult = await ipcRenderer.invoke('save-base64-icon', result.base64Data, originalUrl, result.mimeType);
                    
                    if (saveResult.success) {
                        const qualityInfo = result.quality ? ` (${result.quality})` : '';
                        // ✅ SUPPRIMÉ : showToast(`Icône choisie et sauvegardée : ${saveResult.fileName}`, 'success');
                        
                        // Afficher l'aperçu avec les données base64
                        faviconPreviewImage.src = result.base64Data;
                        faviconFileName.textContent = saveResult.fileName;
                        faviconPreview.style.display = 'block';
                        
                        // Stocker les données pour la sauvegarde ultérieure
                        window.selectedFaviconData = {
                            base64Data: result.base64Data,
                            mimeType: result.mimeType,
                            originalUrl: originalUrl,
                            quality: result.quality,
                            fileName: saveResult.fileName // Ajouter le nom du fichier
                        };
                        
                        // Indiquer que l'icône est sélectionnée et sauvegardée
                        selectedIconFile.value = saveResult.fileName;
                        
                        // Fermer le modal
                        document.body.removeChild(choiceModal);
                    } else {
                        throw new Error(`Erreur lors de la sauvegarde : ${saveResult.error}`);
                    }
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Erreur lors du téléchargement de l\'icône choisie:', error);
                // showToast(`Erreur : ${error.message}`, 'error'); // Supprimé
                
                // Réactiver le bouton
                chooseBtn.disabled = false;
                chooseBtn.innerHTML = 'Choisir cette icône';
            }
        });
    });
}

console.log('Script du gestionnaire d\'applications chargé');
