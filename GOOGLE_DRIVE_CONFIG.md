# Google Drive Integration - DS Gutachten Formular

## Ziel-Ordner
- **URL:** https://drive.google.com/drive/folders/1GaAWZT6leiJoMh4rhpKDHr0NnvEKveF6
- **Folder-ID:** `1GaAWZT6leiJoMh4rhpKDHr0NnvEKveF6`
- **Name:** [Ordnername aus dem Link]

## Aktueller Status
⚠️ **Google Drive Integration deaktiviert** - Server-Log: "GOOGLE_CREDENTIALS not provided"

## Benötigte Konfiguration

### 1. Google Cloud Console Setup
1. Google Cloud Console besuchen
2. Projekt erstellen/auswählen  
3. Google Drive API aktivieren
4. Service Account erstellen
5. JSON Key-Datei herunterladen

### 2. Environment Variables
```bash
# In .env Datei hinzufügen:
GOOGLE_CREDENTIALS=path/to/service-account-key.json
# oder als JSON string:
GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"...",...}'

# Optional - Root Folder ID
GOOGLE_DRIVE_ROOT_FOLDER=1GaAWZT6leiJoMh4rhpKDHr0NnvEKveF6
```

### 3. Workflow
Das System erstellt automatisch:
1. **Ordner** mit Kennzeichen als Name (z.B. "B-MM-2025")
2. **PDF-Upload** in den Ordner  
3. **Link** wird in Notion Business Resources gespeichert

## Aktueller Code-Status
✅ Google Drive Integration bereits implementiert in `server.js`
✅ Ordner-Erstellung mit Kennzeichen
✅ PDF-Upload Funktionalität
✅ Link-Generierung für Notion

**Fehlt nur:** GOOGLE_CREDENTIALS Environment Variable

## Test-Bereit
Sobald GOOGLE_CREDENTIALS gesetzt ist, funktioniert die komplette Integration:
- PDF → Google Drive → Notion Link

## Sicherheit
- Service Account Key niemals in Git committen
- .env Datei ist bereits in .gitignore
- Minimale Berechtigung: nur Drive API Zugriff