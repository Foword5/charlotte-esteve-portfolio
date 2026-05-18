Ceci est un portfolio de journalisme

Il y a 5 pages :
- `index.html` : l'accueil
- `audio.html` : présentation des reportage audio
- `video.html` : présentation des reportage video
- `articles.html` : présentation des articles PDF
- `cv.html` : le CV

Chaque élément est tiré depuis le `content.json` qui contient les valeurs pour pouvoir facilement les changer.

## Médias

Les documents (PDF, MP3, MP4, MOV…) sont stockés en local dans `media/{articles,audio,video}/`. Chaque entrée de `content.json` référence son fichier via le champ `file` (chemin relatif depuis la racine), p. ex. :

```json
{ "title": "…", "file": "media/articles/le-nord-en-guise-d-eldorado.pdf" }
```

Le champ legacy `driveUrl` (lien Google Drive) est encore supporté en fallback dans `app.js` (`mediaSrc()` / `hasMedia()`) — utile si une entrée n'a pas encore été migrée.

### Rendu

`app.js` choisit le bon player selon la rubrique :
- articles → `<iframe>` (PDF natif du navigateur)
- audio → `<audio controls>`
- video → `<video controls>`

### Script d'import

`scripts/download_drive_assets.py` télécharge les fichiers depuis les `driveUrl` de `content.json`, les écrit dans `media/<rubrique>/`, détecte le type par magic bytes, puis remplace `driveUrl` par `file`. Idempotent. Options : `--dry-run`, `--force`.

### Limite de taille

Les fichiers > **75 Mo** ne sont **pas** téléchargés (limite GitHub : 100 Mo dur, 50 Mo warning). Dans ce cas le script :
- laisse `driveUrl` en place,
- ajoute `"skipDownload": true` sur l'entrée — futures exécutions du script ignorent cette entrée même avec `--dry-run` (à contourner avec `--force`).

Côté rendu, `app.js` détecte l'absence de `file` et bascule sur une `<iframe>` Drive (lecteur Google) au lieu du player natif `<video>`/`<audio>`.
