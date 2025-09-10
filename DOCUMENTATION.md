# 📱 Documentation Complète - Mes Applications PWA

## 🎯 Vue d'ensemble

**Mes Applications** est une application PWA (Progressive Web App) développée avec Electron qui permet de créer un lanceur d'applications moderne avec une interface glassmorphism. L'application offre un accès rapide et organisé à vos applications web préférées.

### ✨ Caractéristiques principales

- 🚀 **Interface moderne** avec design glassmorphism
- ⚡ **Préchargement intelligent** des applications pour une ouverture instantanée
- 🎨 **Thèmes multiples** (clair, sombre, automatique)
- 🔍 **Recherche et filtrage** avancés par catégorie
- 📱 **Gestionnaire d'applications** intégré
- 🌐 **Récupération automatique de favicons**
- 💾 **Sauvegarde et restauration** de configuration
- 🖥️ **Mode desktop et web** (via serveur Express)

---

## 🏗️ Architecture de l'application

### Structure des fichiers

```
PWA/
├── 📁 icon/                    # Dossier des icônes des applications
├── 📁 icons/                   # Icônes de l'interface utilisateur
├── 📁 node_modules/            # Dépendances Node.js
├── 📄 main.js                  # Processus principal Electron
├── 📄 preload.js              # Script de préchargement
├── 📄 index.html              # Interface principale
├── 📄 script.js               # Logique frontend principale
├── 📄 style.css               # Styles de l'interface principale
├── 📄 app-manager.html        # Interface du gestionnaire
├── 📄 app-manager.js          # Logique du gestionnaire
├── 📄 app-manager.css         # Styles du gestionnaire
├── 📄 app.json                # Configuration des applications
├── 📄 package.json            # Configuration du projet
├── 📄 installation.md         # Instructions d'installation
└── 📄 start.vbs              # Script de démarrage Windows
```

### Technologies utilisées

- **Frontend** : HTML5, CSS3, JavaScript (ES6+)
- **Backend** : Node.js, Express.js
- **Desktop** : Electron
- **Styling** : CSS Variables, Glassmorphism, Animations CSS
- **Gestion des données** : JSON, localStorage

---

## 🚀 Installation et Configuration

### Prérequis

1. **Node.js** (version 14 ou supérieure)
2. **npm** (gestionnaire de paquets Node.js)
3. **Git** (optionnel, pour cloner le repository)

### Installation

1. **Cloner ou télécharger** le projet
2. **Ouvrir un terminal** dans le dossier du projet
3. **Installer les dépendances** :
   ```bash
   npm install
   ```

### Démarrage

#### Mode développement
```bash
npm run dev
```

#### Mode production
```bash
npm start
```

#### Construction pour distribution
```bash
npm run build
```

---

## 🎮 Guide d'utilisation

### Premier lancement

Lors du premier lancement, l'application affiche une popup de bienvenue avec deux options :

1. **Premier pas** : Ouvre automatiquement le gestionnaire d'applications
2. **Importer** : Permet d'importer une configuration existante

### Interface principale

#### Barre de recherche
- **Recherche en temps réel** dans les noms, descriptions et catégories
- **Raccourci clavier** : `Ctrl+F` ou `/`
- **Effacement** : `Échap`

#### Filtres par catégorie
- **Navigation** : Flèches gauche/droite
- **Catégories automatiques** basées sur les applications configurées
- **Icônes** spécifiques pour chaque catégorie

#### Grille des applications
- **Clic** pour ouvrir une application
- **Animation** au survol et au clic
- **Indicateur de préchargement** (⚡) pour les apps prêtes

### Gestionnaire d'applications

#### Accès
- **Menu** : Fichier → Modifier la liste des apps
- **Raccourci** : `Ctrl+Shift+O`
- **Bouton** "Ajouter une application" dans l'interface principale

#### Fonctionnalités

##### Ajout/Modification d'application
1. **Nom** : Nom affiché de l'application
2. **Description** : Description courte
3. **URL** : Adresse web de l'application
4. **Catégorie** : Classification (IA, Productivité, etc.)
5. **Icône** : Trois types disponibles :
   - **Fichier image** : Upload d'un fichier local
   - **Favicon automatique** : Récupération depuis l'URL
   - **Emoji** : Sélection d'un emoji

##### Gestion des icônes
- **Upload** : PNG, JPG, SVG, WebP, ICO (max 2MB)
- **Favicon intelligent** : Analyse HTML + services externes
- **Choix multiple** : Sélection parmi plusieurs options de qualité
- **Aperçu** en temps réel

##### Filtres et recherche
- **Recherche** dans tous les champs
- **Filtrage** par catégorie
- **Statistiques** en temps réel

---

## ⚙️ Configuration avancée

### Fichier app.json

Structure de configuration des applications :

```json
{
  "apps": [
    {
      "name": "Nom de l'application",
      "description": "Description courte",
      "url": "https://exemple.com",
      "category": "Catégorie",
      "iconFile": "nom_du_fichier.png"
    }
  ]
}
```

### Variables CSS personnalisables

L'application utilise des variables CSS pour la personnalisation :

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --accent-color: #f093fb;
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* ... autres variables */
}
```

### Thèmes

#### Thème clair (par défaut)
- Couleurs vives et contrastées
- Arrière-plan dégradé bleu-violet

#### Thème sombre
- Couleurs sombres et apaisantes
- Arrière-plan dégradé gris foncé

#### Thème automatique
- Suit les préférences système
- Bascule automatiquement jour/nuit

---

## 🔧 Fonctionnalités techniques

### Préchargement intelligent

L'application précharge automatiquement les 5 premières applications pour une ouverture instantanée :

- **Fenêtres invisibles** créées en arrière-plan
- **Gestion des erreurs** SSL et de certificats
- **Timeout de sécurité** (8 secondes)
- **Indicateurs visuels** de statut

### Gestion des erreurs

- **Certificats SSL** auto-signés ignorés
- **Fallback** vers le navigateur par défaut
- **Messages d'erreur** informatifs
- **Récupération automatique** des erreurs

### Performance

- **Débouncing** de la recherche (300ms)
- **Animations CSS** optimisées
- **Lazy loading** des icônes
- **Cache** intelligent des données

### Sécurité

- **Validation** des URLs
- **Échappement** HTML pour éviter les XSS
- **Contrôle** des types de fichiers uploadés
- **Isolation** des processus Electron

---

## 🌐 Mode Web

L'application peut également fonctionner comme une application web via un serveur Express intégré :

### Démarrage du serveur
- **Port par défaut** : 6979
- **URL** : http://localhost:6979
- **API REST** disponible

### Endpoints API

#### GET /api/apps
Récupère la liste des applications

#### POST /api/apps
Met à jour la liste des applications

#### GET /icon/:filename
Sert les icônes des applications

---

## 📱 Raccourcis clavier

### Interface principale
- `Ctrl+F` ou `/` : Focus sur la recherche
- `Échap` : Effacer la recherche
- `←/→` : Navigation entre les catégories

### Gestionnaire d'applications
- `Ctrl+N` : Ajouter une nouvelle application
- `Ctrl+S` : Sauvegarder les modifications
- `Échap` : Fermer les modals

### Menu principal
- `Ctrl+R` : Actualiser
- `Ctrl+Shift+R` : Forcer l'actualisation
- `Ctrl+Shift+O` : Ouvrir le gestionnaire
- `Ctrl+Shift+W` : Ouvrir dans le navigateur
- `Ctrl+Shift+E` : Exporter la configuration
- `Ctrl+Shift+I` : Importer la configuration
- `F12` : Outils de développement

---

## 🔄 Sauvegarde et Restauration

### Export de configuration

1. **Menu** : Options → Exporter la configuration
2. **Sélectionner** un dossier de destination
3. **Création automatique** d'un dossier `Backup_JJ-MM-AAAA_WEB2PWA`
4. **Contenu** : `app.json` + dossier `icon/`

### Import de configuration

1. **Menu** : Options → Importer la configuration
2. **Sélectionner** le dossier de sauvegarde
3. **Restauration** automatique des fichiers
4. **Redémarrage** de l'application

---

## 🐛 Dépannage

### Problèmes courants

#### L'application ne se lance pas
- Vérifier que Node.js est installé
- Exécuter `npm install` pour installer les dépendances
- Vérifier les permissions du dossier

#### Les icônes ne s'affichent pas
- Vérifier que le dossier `icon/` existe
- Vérifier les permissions de lecture
- Recharger l'application

#### Erreurs de certificat SSL
- L'application ignore automatiquement les certificats auto-signés
- Vérifier la connexion internet
- Tester l'URL dans un navigateur

#### Problèmes de préchargement
- Vérifier la connectivité réseau
- Certains sites peuvent bloquer le préchargement
- Les erreurs sont automatiquement gérées

### Logs de débogage

- **Console** : `F12` pour ouvrir les DevTools
- **Logs** : Affichés dans la console du terminal
- **Statut** : Indicateur de préchargement en bas à droite

---

## 🚀 Développement

### Structure du code

#### main.js
- Processus principal Electron
- Gestion des fenêtres
- Communication IPC
- Serveur Express

#### script.js
- Interface utilisateur principale
- Gestion des événements
- Communication avec Electron
- Animations et interactions

#### app-manager.js
- Interface du gestionnaire
- Gestion des formulaires
- Upload et gestion des icônes
- API de récupération de favicons

### Ajout de fonctionnalités

1. **Modifier** les fichiers correspondants
2. **Tester** avec `npm run dev`
3. **Construire** avec `npm run build`
4. **Documenter** les changements

---

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. **Fork** le projet
2. **Créer** une branche pour votre fonctionnalité
3. **Commiter** vos changements
4. **Pousser** vers la branche
5. **Ouvrir** une Pull Request

---

## 📞 Support

Pour obtenir de l'aide :

1. **Consulter** cette documentation
2. **Vérifier** les issues existantes
3. **Créer** une nouvelle issue avec :
   - Description du problème
   - Étapes pour reproduire
   - Logs d'erreur
   - Configuration système

---

## 🎉 Conclusion

**Mes Applications PWA** est une solution complète pour organiser et accéder rapidement à vos applications web préférées. Avec son interface moderne, ses fonctionnalités avancées et sa facilité d'utilisation, elle s'adapte à tous les besoins.

Que vous soyez un utilisateur occasionnel ou un power user, cette application vous offrira une expérience fluide et moderne pour gérer vos applications web.

---

*Documentation générée automatiquement - Version 1.0*
