# 📺 SortLater Tube

Un outil moderne et puissant pour gérer, trier et redécouvrir tes playlists YouTube localement.

## 🚀 Fonctionnalités

- **🌐 Serveur Local (FastAPI)** : Une interface web réactive et rapide.
- **🔄 Sync YouTube** : Récupère automatiquement les vidéos d'une playlist (Titre, Auteur, Durée, Date).
- **✅ Suivi de lecture** : Marque tes vidéos comme "Vu" en un clic.
- **🏷️ Multi-Tags & Catégories** : 
  - Crée tes propres catégories (ex: `Code, Fun, Tuto`).
  - Support du **Multi-Tagging** (plusieurs tags séparés par une virgule).
  - Autocomplétion intelligente des catégories existantes.
- **🔍 Navigation Avancée** :
  - Recherche instantanée par titre ou nom de chaîne.
  - **Vue par Chaîne** : Clique sur un créateur pour filtrer toutes ses vidéos.
  - **Réinitialisation rapide** : Clique sur le titre "SortLater Tube" pour tout remettre à zéro.
- **✨ Interface Premium** :
  - Thème Sombre / Clair.
  - Effets de lueur (Glow) au survol.
  - Limitation intelligente des colonnes pour une meilleure lisibilité.

## 🛠️ Installation

1. Assure-toi d'avoir Python 3 installé.
2. Installe les dépendances :
   ```bash
   pip install -r requirements.txt
   ```
3. (Optionnel) Configure ta clé API et ton ID de playlist via l'icône ⚙️ dans l'interface ou directement dans `config.json`.

## 📖 Utilisation

1. **Lancer le serveur** :
   ```bash
   python3 main.py
   ```
2. **Accéder à l'interface** :
   Ouvre ton navigateur sur [http://localhost:8000](http://localhost:8000).

3. **Synchronisation & Sauvegarde** :
   Les données sont synchronisées automatiquement au lancement. Tes modifications de tags et de statut "Vu" sont enregistrées en temps réel dans `mes_videos.csv`.

## 📁 Structure du projet

- `main.py` : Le serveur backend (FastAPI).
- `static/` : L'interface frontend (HTML, CSS moderne, JavaScript).
- `mes_videos.csv` : Ta base de données locale.
- `config.json` : Stockage de la clé API et de la configuration de playlist.
- `requirements.txt` : Dépendances Python nécessaires.
