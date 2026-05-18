# Portfolio de Charlotte Esteve

Portfolio statique de la journaliste [Charlotte Esteve](https://www.linkedin.com/in/charlotte-esteve-80b4b3253/).

## Pages

- `index.html` — accueil
- `articles.html` — articles PDF
- `audio.html` — reportages audio
- `video.html` — reportages vidéo
- `cv.html` — CV

Le contenu de chaque page (titres, descriptions, dates, fichiers) est centralisé dans `content.json`.

## Médias

Les documents (PDF, audio, vidéo) sont stockés localement dans `media/` :

```
media/
├── articles/   *.pdf
├── audio/      *.mp3
└── video/      *.mp4, *.mov
```

Chaque entrée de `content.json` référence son fichier via le champ `file` (chemin relatif) :

```json
{
  "title": "...",
  "description": "...",
  "date": "2025-04-01",
  "file": "media/articles/quand-les-toits-se-transforment-en-jardins.pdf"
}
```

### Ajouter / mettre à jour un média

Deux options selon la source :

**Depuis Google Drive** — ajouter une entrée dans `content.json` avec `driveUrl` (lien `/file/d/.../preview`) puis lancer :

```bash
python3 scripts/download_drive_assets.py
```

Le script télécharge le fichier dans `media/<rubrique>/`, détecte le type (PDF / audio / vidéo) et remplace `driveUrl` par `file`. Il est idempotent : ré-exécutable sans télécharger deux fois. Options : `--dry-run`, `--force`.

> Les fichiers > 75 Mo ne sont pas téléchargés (limite GitHub). Le script ajoute alors `"skipDownload": true` sur l'entrée, garde `driveUrl`, et `app.js` affiche le lecteur Drive en iframe.

**Manuellement** — déposer le fichier dans `media/<rubrique>/` et renseigner son chemin dans `file`.
