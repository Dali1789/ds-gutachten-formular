# 🚗 DS Sachverständigenbüro - Gutachten Formular

Professionelle Web-Anwendung für digitale Gutachtenaufträge mit automatischer Notion- und Google Drive-Integration.

## ✨ Features

- 🎨 **Exaktes Corporate Design** - 1:1 Nachbildung des Original-Formulars
- ✍️ **Digitale Unterschrift** - Touch/Maus-kompatible Signatur-Erfassung  
- 📱 **Mobile-optimiert** - Responsive Design für alle Geräte
- 🔗 **Notion Integration** - Automatische Kontakt-Erstellung in Notion
- 📁 **Google Drive** - Automatischer PDF-Upload in strukturierte Ordner
- 📄 **PDF-Generierung** - Original-Layout mit ausgefüllten Formulardaten
- 🔒 **Sicherheit** - Rate Limiting, CORS, Helmet Middleware
- ⚡ **Railway Ready** - One-Click Deployment

## 🚀 Quick Start

### 1. Repository klonen
```bash
git clone https://github.com/yourusername/ds-gutachten-formular.git
cd ds-gutachten-formular
npm install
```

### 2. Environment Variables
Kopieren Sie `.env.example` zu `.env` und füllen Sie aus:
```bash
cp .env.example .env
# Bearbeiten Sie .env mit Ihren API Keys
```

### 3. Lokal starten
```bash
npm start
# Server läuft auf http://localhost:3000
```

### 4. Railway Deployment
1. Repository auf GitHub pushen
2. Railway.app → "Deploy from GitHub"
3. Repository auswählen: `ds-gutachten-formular`
4. Environment Variables in Railway Dashboard setzen
5. Automatisches Deployment ✅

## 📊 API Endpoints

| Endpoint | Method | Beschreibung |
|----------|--------|--------------|
| `/` | GET | Hauptformular |
| `/health` | GET | Server Status |
| `/api/submit-gutachten` | POST | Formular Submit |

## 🔧 Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Notion Integration
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
KONTAKTE_DATABASE_ID=25b5e4b84c4481d39e4fc8bbf27edf01
BUSINESS_RESOURCES_DATABASE_ID=25b5e4b84c448133ba41f551dd68717b

# Google Drive Integration  
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"your-project"...}
GOOGLE_DRIVE_PARENT_FOLDER=1GaAWZT6leiJoMh4rhpKDHr0NnvEKveF6
```

## 🏗️ Technischer Stack

- **Backend:** Node.js + Express.js
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **PDF:** PDFKit für Dokument-Generierung
- **Storage:** Google Drive API
- **Database:** Notion API
- **Deployment:** Railway.app
- **Security:** Helmet, CORS, Rate Limiting

## 📁 Projektstruktur

```
ds-gutachten-formular/
├── public/
│   ├── index.html          # Hauptformular
│   ├── styles.css          # Responsive Styles
│   ├── script.js           # Frontend JavaScript
│   └── logo.png            # Firmen-Logo
├── server.js               # Express Server + APIs
├── package.json            # Dependencies
├── .env.example           # Environment Template
├── .gitignore             # Git Ignore
└── README.md              # Diese Dokumentation
```

## 🔄 Workflow

1. **Kunde** → Scannt QR-Code / klickt WhatsApp Link
2. **Formular** → Füllt alle Gutachten-Daten aus + Unterschrift  
3. **Server** → Verarbeitet Daten automatisch:
   - Erstellt Notion Kontakt in Kontakte-Database
   - Generiert PDF mit Original-Layout
   - Erstellt Google Drive Ordner (Kennzeichen - Name)
   - Upload PDF in Kundenordner
   - Erstellt Business Resource Entry
   - Verknüpft alle Daten automatisch

4. **Ergebnis** → Vollständig dokumentierter Gutachten-Auftrag

## 🎯 WhatsApp Integration

Nach Deployment QR-Code erstellen für:
```
Gutachten beauftragen: 
https://ihre-domain.railway.app
```

## ⚠️ Setup Voraussetzungen

### Notion Integration
1. Notion.so → Integrationen → Neue Integration
2. Internal Integration Secret kopieren
3. Kontakte- und Business Resources-Datenbank Zugriff geben

### Google Drive Setup
1. Google Cloud Console → Neues Projekt
2. Drive API aktivieren  
3. Service Account erstellen
4. JSON Credentials downloaden
5. Drive-Ordner für Service Account freigeben

## 🏆 Production Ready

✅ Error Handling & Logging  
✅ Rate Limiting & Security  
✅ Health Checks  
✅ Environment Configuration  
✅ Docker kompatibel  
✅ Railway optimiert  

## 📞 Support

Entwickelt für: **DS Sachverständigenbüro**  
Projekt: **Digitales Gutachten-System**  
Status: **Production Ready** ✅# Railway Redeploy Sat Aug 30 00:08:22 CEST 2025
