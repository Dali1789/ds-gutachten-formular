# Google Drive API Setup - DS Gutachten Formular

## Schritt 1: Google Cloud Projekt erstellen/auswählen
1. Gehe zu: https://console.cloud.google.com/
2. Erstelle neues Projekt oder wähle existierendes aus
3. Projektname: "DS Gutachten System" (oder ähnlich)

## Schritt 2: Google Drive API aktivieren
1. Gehe zu: https://console.cloud.google.com/apis/library
2. Suche nach "Google Drive API"
3. Klicke "Aktivieren"

## Schritt 3: Service Account erstellen
1. Gehe zu: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Klicke "Service Account erstellen"
3. Name: "ds-gutachten-drive-service"
4. Beschreibung: "Service Account für DS Gutachten PDF Upload"
5. Klicke "Erstellen und fortfahren"

## Schritt 4: Service Account Berechtigung (optional)
- Rolle: "Editor" oder "Storage Admin" (für Drive Zugriff)
- Klicke "Weiter" > "Fertig"

## Schritt 5: JSON Key generieren
1. Klicke auf den erstellten Service Account
2. Gehe zu "Keys" Tab
3. Klicke "Add Key" > "Create new key"
4. Wähle "JSON"
5. Datei wird heruntergeladen (z.B. "ds-gutachten-drive-service-abc123.json")

## Schritt 6: Service Account zu Google Drive Ordner hinzufügen
1. Öffne den JSON Key und kopiere die "client_email" (z.B. ds-gutachten-drive-service@projekt-name.iam.gserviceaccount.com)
2. Gehe zu: https://drive.google.com/drive/folders/1GaAWZT6leiJoMh4rhpKDHr0NnvEKveF6
3. Rechtsklick auf Ordner > "Freigeben"
4. Füge die Service Account Email hinzu
5. Berechtigung: "Bearbeiter" 
6. Klicke "Senden"

## Schritt 7: JSON Content kopieren
- Öffne die heruntergeladene JSON Datei
- Kopiere den gesamten Inhalt (alle {...} Klammern)
- Das wird als GOOGLE_CREDENTIALS environment variable verwendet

## Beispiel JSON Struktur:
```json
{
  "type": "service_account",
  "project_id": "dein-projekt-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "ds-gutachten-drive-service@dein-projekt.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

## Nächste Schritte:
Nach dem Setup füge die JSON Credentials über `/configure-google-credentials` endpoint hinzu.