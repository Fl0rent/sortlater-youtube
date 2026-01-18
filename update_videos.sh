#!/bin/bash

# Chemin de l'environnement virtuel local
VENV_DIR="./.venv"

# 1. Vérifier si l'environnement virtuel existe, sinon le créer
if [ ! -d "$VENV_DIR" ]; then
    echo "⚙️  Création de l'environnement virtuel..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install -r requirements.txt
fi

# 2. Lancer le serveur
echo "🚀 Lancement du serveur SortLater Tube..."
echo "📍 Adresse : http://localhost:8000"

if [[ "$1" == "--background" ]]; then
    echo "⚙️ Mode arrière-plan activé. Les sorties seront dans server.log"
    nohup "$VENV_DIR/bin/python3" main.py >> server.log 2>&1 &
    echo "✅ Serveur lancé avec le PID $!"
    exit 0
fi

echo " (Laisse cette fenêtre ouverte tant que tu utilises l'application)"
echo " (Appuie sur CTRL+C pour arrêter)"
echo ""
"$VENV_DIR/bin/python3" main.py

# 3. Pause en cas d'erreur
if [ $? -ne 0 ]; then
    echo "❌ Le serveur s'est arrêté avec une erreur."
    read -p "Appuie sur Entrée pour fermer..."
fi
