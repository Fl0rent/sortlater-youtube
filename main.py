import os
import csv
import isodate
from googleapiclient.discovery import build
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional

import json

# --- CONFIGURATION ---
CONFIG_FILE = "config.json"
CSV_FILE = "mes_videos.csv"

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    return {"api_key": "", "playlist_id": ""}

def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)

app = FastAPI()

# Models
class VideoUpdate(BaseModel):
    url: str
    status: Optional[str] = None
    category: Optional[str] = None

class SettingsUpdate(BaseModel):
    api_key: str
    playlist_id: str

def get_youtube_service():
    """Connecte le script à YouTube."""
    config = load_config()
    return build('youtube', 'v3', developerKey=config.get('api_key'))

def get_videos_from_playlist(youtube, playlist_id):
    """Récupère les vidéos de la playlist."""
    videos = []
    next_page_token = None

    print("🔍 Récupération des vidéos en cours...")

    while True:
        # 1. Récupérer les items de la playlist
        pl_request = youtube.playlistItems().list(
            part='snippet,contentDetails',
            playlistId=playlist_id,
            maxResults=50,
            pageToken=next_page_token
        )
        pl_response = pl_request.execute()

        # Récupérer les IDs des vidéos pour avoir la durée (info non dispo dans playlistItems)
        video_ids = [item['contentDetails']['videoId'] for item in pl_response['items']]
        
        # 2. Récupérer les détails complets (notamment la durée)
        vid_request = youtube.videos().list(
            part='contentDetails,snippet,statistics',
            id=','.join(video_ids)
        )
        vid_response = vid_request.execute()

        for item in vid_response['items']:
            # Traitement de la durée
            duration_iso = item['contentDetails']['duration']
            duration = isodate.parse_duration(duration_iso)
            
            video_data = {
                'title': item['snippet']['title'],
                'author': item['snippet']['channelTitle'],
                'thumbnail': item['snippet']['thumbnails'].get('high', {}).get('url', ''),
                'url': f"https://www.youtube.com/watch?v={item['id']}",
                'duration': str(duration), # Converti en texte lisible
                'views': item['statistics'].get('viewCount', 0),
                'date': item['snippet']['publishedAt'][:10] # Date au format YYYY-MM-DD
            }
            videos.append(video_data)

        next_page_token = pl_response.get('nextPageToken')
        if not next_page_token:
            break
            
    return videos

def sync_csv_and_get_videos(videos):
    """
    1. Lit le CSV existant pour récupérer les statuts 'Vu' et 'Categorie'.
    2. Ajoute les nouvelles vidéos récupérées de YouTube.
    3. Met à jour le fichier CSV.
    4. Renvoie la liste complète des vidéos avec leur statut.
    """
    csv_file = "mes_videos.csv"
    csv_data = {} # URL -> {data...}
    fieldnames = ['Titre', 'Auteur', 'URL', 'Durée', 'Date', 'Statut', 'Categorie']
    
    # 1. Lire les données existantes
    if os.path.exists(csv_file):
        with open(csv_file, mode='r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            # Vérifier si la colonne Statut existe
            if reader.fieldnames:
                # Normalisation des noms de colonnes (si ancien fichier sans Statut)
                current_fields = reader.fieldnames
            
            for row in reader:
                url = row.get('URL')
                if url:
                    csv_data[url] = row
                    if 'Statut' not in row:
                        csv_data[url]['Statut'] = ''
                    if 'Categorie' not in row:
                        csv_data[url]['Categorie'] = ''

    # 2. Fusionner avec les données fraîches de YouTube
    final_list = []
    
    # On parcourt les vidéos YouTube (ordre de la playlist)
    for v in videos:
        url = v['url']
        status = ''
        category = ''
        
        if url in csv_data:
            # On garde le statut et la catégorie connus
            status = csv_data[url].get('Statut', '')
            category = csv_data[url].get('Categorie', '')
        
        # On prépare l'objet pour le CSV et le HTML
        v['status'] = status
        v['category'] = category
        
        row_data = {
            'Titre': v['title'],
            'Auteur': v['author'],
            'URL': v['url'],
            'Durée': v['duration'],
            'Date': v['date'],
            'Statut': status,
            'Categorie': category
        }
        final_list.append(row_data)

    # 3. Réécrire le CSV (pour ajouter les nouvelles vidéos et la colonne Statut si absente)
    # Note : On conserve l'ordre de la playlist YouTube
    with open(csv_file, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(final_list)
        
    print(f"✅ Fichier CSV synchronisé ({len(final_list)} vidéos, avec support Catégories).")
    return final_list

def update_video_in_csv(url: str, status: Optional[str] = None, category: Optional[str] = None):
    """Met à jour une vidéo spécifique dans le CSV."""
    if not os.path.exists(CSV_FILE):
        return False
    
    updated_rows = []
    fieldnames = ['Titre', 'Auteur', 'URL', 'Durée', 'Date', 'Statut', 'Categorie']
    found = False

    with open(CSV_FILE, mode='r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['URL'] == url:
                if status is not None:
                    row['Statut'] = "Vu" if status == "Vu" else ""
                if category is not None:
                    row['Categorie'] = category
                found = True
            updated_rows.append(row)

    if found:
        with open(CSV_FILE, mode='w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(updated_rows)
    return found

# --- API ENDPOINTS ---

@app.get("/api/videos")
async def get_videos():
    try:
        config = load_config()
        if not config.get('api_key') or not config.get('playlist_id'):
            return [] # Or return error
        service = get_youtube_service()
        videos_from_yt = get_videos_from_playlist(service, config.get('playlist_id'))
        final_videos = sync_csv_and_get_videos(videos_from_yt)
        return final_videos
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/settings")
async def get_settings():
    return load_config()

@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    save_config(settings.dict())
    return {"status": "success"}

@app.post("/api/update")
async def update_video(data: VideoUpdate):
    success = update_video_in_csv(data.url, data.status, data.category)
    if not success:
        raise HTTPException(status_code=404, detail="Video not found in CSV")
    return {"status": "success"}

# Serve Frontend
@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

# Mount static files
if os.path.exists('static'):
    app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
