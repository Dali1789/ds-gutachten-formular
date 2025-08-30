const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { Client } = require('@notionhq/client');
const { google } = require('googleapis');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://ds-gutachten-formular-production.up.railway.app'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000']
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
        error: 'Zu viele Anfragen. Bitte versuchen Sie es in 15 Minuten erneut.'
    }
});

app.use('/api/', limiter);

// Middleware
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Services
let notion, googleDrive, auth;

try {
    // Notion Client
    if (process.env.NOTION_TOKEN) {
        notion = new Client({
            auth: process.env.NOTION_TOKEN
        });
        console.log('✅ Notion client initialized successfully');
    } else {
        console.warn('⚠️  NOTION_TOKEN environment variable not set. Notion features will be disabled.');
    }

    // Google Drive Setup
    if (process.env.GOOGLE_CREDENTIALS) {
        try {
            const credentialsString = process.env.GOOGLE_CREDENTIALS;
            
            // Check if it's placeholder data
            if (credentialsString.includes('your-project-id') || 
                credentialsString.includes('XXX') || 
                credentialsString.trim() === '{}' ||
                credentialsString.includes('placeholder')) {
                console.log('⚠️  GOOGLE_CREDENTIALS contains placeholder data - Google Drive features will be disabled');
            } else {
                const credentials = JSON.parse(credentialsString);
                auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/drive.file']
                });
                googleDrive = google.drive({ version: 'v3', auth });
                console.log('✅ Google Drive service initialized successfully');
            }
        } catch (parseError) {
            console.error('❌ Failed to parse GOOGLE_CREDENTIALS:', parseError.message);
            console.log('⚠️  Google Drive features will be disabled');
        }
    } else {
        console.log('⚠️  GOOGLE_CREDENTIALS environment variable not set - Google Drive features will be disabled');
    }
} catch (error) {
    console.error('Service initialization error:', error.message);
}

// Helper Functions
async function findExistingCustomerByKennzeichen(kennzeichen) {
    if (!notion || !kennzeichen) return null;
    
    try {
        console.log(`🔍 Searching for existing customer with Kennzeichen: ${kennzeichen}`);
        
        const response = await notion.databases.query({
            database_id: '25b5e4b8-4c44-81d3-9e4f-c8bbf27edf01', // KONTAKTE Database
            filter: {
                property: 'Kennzeichen',
                rich_text: {
                    contains: kennzeichen
                }
            }
        });
        
        if (response.results && response.results.length > 0) {
            console.log(`✅ Found existing customer: ${response.results[0].id}`);
            return response.results[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error searching for existing customer:', error);
        return null;
    }
}

async function updateExistingCustomer(existingCustomer, formData) {
    try {
        console.log(`🔄 Updating existing customer: ${existingCustomer.id}`);
        
        const updateData = {
            page_id: existingCustomer.id,
            properties: {
                'Email': {
                    email: extractEmail(formData.auftraggeber?.kontakt)
                },
                'Phone': {
                    phone_number: extractPhone(formData.auftraggeber?.kontakt)
                },
                'Address': {
                    rich_text: [
                        {
                            text: {
                                content: formData.auftraggeber?.adresse || ''
                            }
                        }
                    ]
                },
                'Description': {
                    rich_text: [
                        {
                            text: {
                                content: `Gutachtenauftrag über Webformular erstellt am ${new Date().toLocaleDateString('de-DE')}\n\nGutachten Nr.: ${formData.gutachtenNr || ''}\nUnfalldatum: ${formData.unfall?.tag || ''}\nUnfallort: ${formData.unfall?.ort || ''}`
                            }
                        }
                    ]
                },
                'Last Contact': {
                    date: {
                        start: new Date().toISOString().split('T')[0]
                    }
                }
            }
        };

        const response = await notion.pages.update(updateData);
        console.log(`✅ Customer updated successfully: ${response.id}`);
        return response;
    } catch (error) {
        console.error('Error updating existing customer:', error);
        throw new Error('Fehler beim Aktualisieren des bestehenden Kunden');
    }
}

async function findExistingGoogleDriveFolder(kennzeichen) {
    if (!googleDrive) {
        console.warn('Google Drive not configured');
        return null;
    }

    try {
        console.log(`🔍 Searching for existing Google Drive folder with Kennzeichen: ${kennzeichen}`);
        
        const response = await googleDrive.files.list({
            q: `name contains '${kennzeichen}' and mimeType = 'application/vnd.google-apps.folder' and parents in '${process.env.GOOGLE_DRIVE_PARENT_FOLDER}'`,
            fields: 'files(id, name)'
        });

        if (response.data.files && response.data.files.length > 0) {
            console.log(`📁 Found existing folder: ${response.data.files[0].name} (${response.data.files[0].id})`);
            return response.data.files[0].id;
        }

        return null;
    } catch (error) {
        console.error('Error searching for existing Google Drive folder:', error);
        return null;
    }
}

async function createNotionContact(formData) {
    try {
        const contactData = {
            parent: {
                database_id: '25b5e4b8-4c44-81d3-9e4f-c8bbf27edf01' // KONTAKTE Database
            },
            properties: {
                'Name': {
                    title: [
                        {
                            text: {
                                content: formData.auftraggeber?.name || 'Unbekannt'
                            }
                        }
                    ]
                },
                'Email': {
                    email: extractEmail(formData.auftraggeber?.kontakt)
                },
                'Phone': {
                    phone_number: extractPhone(formData.auftraggeber?.kontakt)
                },
                'Address': {
                    rich_text: [
                        {
                            text: {
                                content: formData.auftraggeber?.adresse || ''
                            }
                        }
                    ]
                },
                'Kennzeichen': {
                    rich_text: [
                        {
                            text: {
                                content: formData.auftraggeber?.kennzeichen || ''
                            }
                        }
                    ]
                },
                'Description': {
                    rich_text: [
                        {
                            text: {
                                content: `Gutachten-Auftrag: ${formData.gutachtenNr || ''} - Schadensdatum: ${formData.schadensdaten?.datum || ''}`
                            }
                        }
                    ]
                },
                'Priority': {
                    select: {
                        name: 'High'
                    }
                },
                'Last Contact': {
                    date: {
                        start: new Date().toISOString().split('T')[0]
                    }
                },
                'Bereich ': {
                    relation: [
                        {
                            id: '25b5e4b8-4c44-81ad-b170-d53b3d487ada' // Gutachten Bereich
                        }
                    ]
                }
            }
        };

        const response = await notion.pages.create(contactData);
        return response;
    } catch (error) {
        console.error('Notion contact creation error:', error);
        throw new Error('Fehler beim Erstellen des Notion-Kontakts');
    }
}

async function createGoogleDriveFolder(folderName, formData) {
    if (!googleDrive) {
        console.warn('Google Drive not configured');
        return null;
    }

    try {
        const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [process.env.GOOGLE_DRIVE_PARENT_FOLDER]
        };

        const folder = await googleDrive.files.create({
            resource: folderMetadata
        });

        return folder.data.id;
    } catch (error) {
        console.error('Google Drive folder creation error:', error);
        throw new Error('Fehler beim Erstellen des Google Drive Ordners');
    }
}

async function generateGutachtenPDF(formData) {
    return new Promise((resolve, reject) => {
        try {
            console.log('📄 Starting PDF generation with data keys:', Object.keys(formData));
            
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                console.log('📄 PDF generation completed successfully');
                resolve(pdfData);
            });
            doc.on('error', (error) => {
                console.error('📄 PDF generation error:', error);
                reject(error);
            });

            // PDF Header
            doc.fontSize(20).text('DS Sachverständigenbüro', 50, 50);
            doc.fontSize(12).text('Mühlenstr.49 - 33609 Bielefeld', 50, 75);
            doc.text('Tel.: 0151-11738834 | mail: info@unfallschaden-bielefeld.de', 50, 90);
            
            doc.fontSize(16).text('Auftrag zur Gutachtenerstellung', 50, 120);
            doc.text(`Gutachten Nr.: ${formData.gutachtenNr || ''}`, 50, 140);

            let yPosition = 170;

            // Auftraggeber Section
            doc.fontSize(14).text('Auftraggeber (Geschädigter)', 50, yPosition, { underline: true });
            yPosition += 25;
            
            doc.fontSize(11);
            doc.text(`Name: ${formData.auftraggeber?.name || ''}`, 50, yPosition);
            yPosition += 15;
            doc.text(`Adresse: ${formData.auftraggeber?.adresse || ''}`, 50, yPosition);
            yPosition += 15;
            doc.text(`Kontakt: ${formData.auftraggeber?.kontakt || ''}`, 50, yPosition);
            yPosition += 15;
            doc.text(`Kennzeichen: ${formData.auftraggeber?.kennzeichen || ''}`, 50, yPosition);
            yPosition += 25;

            // Fahrzeugdaten
            if (formData.sonstiges) {
                console.log('📄 Adding Fahrzeugdaten section');
                doc.fontSize(14).text('Fahrzeugdaten', 50, yPosition, { underline: true });
                yPosition += 25;
                doc.fontSize(11);
                doc.text(`Kilometerstand: ${formData.sonstiges.kilometerstand || ''}`, 50, yPosition);
                yPosition += 15;
                doc.text(`Reifen/Profiltiefe: ${formData.sonstiges.reifen || ''}`, 50, yPosition);
                yPosition += 15;
                doc.text(`Fahrzeugstellnummer: ${formData.sonstiges.fahrzeugstellnummer || ''}`, 50, yPosition);
                yPosition += 25;
            }

            // Unfalldaten
            if (formData.unfall) {
                console.log('📄 Adding Unfall section, available fields:', Object.keys(formData.unfall));
                doc.fontSize(14).text('Unfallereignis', 50, yPosition, { underline: true });
                yPosition += 25;
                doc.fontSize(11);
                doc.text(`Unfalltag: ${formData.unfall.tag || ''}`, 50, yPosition);
                yPosition += 15;
                doc.text(`Uhrzeit: ${formData.unfall.uhrzeit || formData.unfall.zeit || ''}`, 50, yPosition);
                yPosition += 15;
                doc.text(`Unfallort: ${formData.unfall.ort || ''}`, 50, yPosition);
                yPosition += 15;
                if (formData.unfall.beschreibung) {
                    doc.text(`Beschreibung: ${formData.unfall.beschreibung}`, 50, yPosition, { width: 500 });
                    yPosition += Math.max(30, formData.unfall.beschreibung.length / 80 * 15);
                }
            }

            // Gegner
            if (formData.gegner?.name) {
                console.log('📄 Adding Gegner section');
                doc.fontSize(14).text('Gegnerisches Fahrzeug', 50, yPosition, { underline: true });
                yPosition += 25;
                doc.fontSize(11);
                doc.text(`Name: ${formData.gegner.name}`, 50, yPosition);
                yPosition += 15;
                doc.text(`Adresse: ${formData.gegner.adresse || ''}`, 50, yPosition);
                yPosition += 15;
                doc.text(`Kennzeichen: ${formData.gegner.kennzeichen || ''}`, 50, yPosition);
                yPosition += 25;
            }

            // Versicherung
            if (formData.versicherung?.name) {
                console.log('📄 Adding Versicherung section');
                doc.fontSize(14).text('Versicherung des Verursachers', 50, yPosition, { underline: true });
                yPosition += 25;
                doc.fontSize(11);
                doc.text(`Versicherung: ${formData.versicherung.name}`, 50, yPosition);
                yPosition += 15;
                doc.text(`Schadennummer: ${formData.versicherung.schadennummer || ''}`, 50, yPosition);
                yPosition += 25;
            }

            // Notizen
            if (formData.notizen) {
                console.log('📄 Adding Notizen section');
                doc.fontSize(14).text('Notizen', 50, yPosition, { underline: true });
                yPosition += 25;
                doc.fontSize(11);
                doc.text(formData.notizen, 50, yPosition, { width: 500 });
                yPosition += Math.max(30, formData.notizen.length / 80 * 15);
            }

            // Unterschrift
            if (formData.signature) {
                console.log('📄 Adding Unterschrift section');
                doc.fontSize(14).text('Unterschrift', 50, yPosition, { underline: true });
                yPosition += 25;
                doc.text(`Ort: ${formData.unterschrift?.ort || ''}`, 50, yPosition);
                yPosition += 20;
                
                try {
                    // Add signature image if provided
                    const signatureData = formData.signature.replace(/^data:image\/png;base64,/, '');
                    const signatureBuffer = Buffer.from(signatureData, 'base64');
                    doc.image(signatureBuffer, 50, yPosition, { width: 200 });
                    console.log('📄 Signature embedded successfully');
                } catch (signatureError) {
                    console.error('📄 Signature embedding error:', signatureError);
                    doc.text('Unterschrift (digital erfasst)', 50, yPosition);
                }
            }

            // Footer
            doc.fontSize(8).text(`Erstellt am: ${new Date().toLocaleString('de-DE')}`, 50, 750);
            doc.text('DS Sachverständigenbüro - Digitaler Gutachtenauftrag', 50, 765);

            console.log('📄 PDF document finalized, ending...');
            doc.end();
        } catch (error) {
            console.error('📄 PDF generation critical error:', error);
            reject(error);
        }
    });
}

async function uploadPDFToDrive(pdfBuffer, fileName, folderId) {
    if (!googleDrive) {
        console.warn('Google Drive not configured');
        return null;
    }

    try {
        const media = {
            mimeType: 'application/pdf',
            body: pdfBuffer
        };

        const fileMetadata = {
            name: fileName,
            parents: folderId ? [folderId] : [process.env.GOOGLE_DRIVE_PARENT_FOLDER]
        };

        const file = await googleDrive.files.create({
            resource: fileMetadata,
            media: media
        });

        return file.data.id;
    } catch (error) {
        console.error('PDF upload error:', error);
        throw new Error('Fehler beim Upload der PDF');
    }
}

// Helper functions
function extractEmail(contact) {
    if (!contact) return null;
    const emailMatch = contact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return emailMatch ? emailMatch[0] : null;
}

function extractPhone(contact) {
    if (!contact) return null;
    const phoneMatch = contact.match(/[\d\s\-\+\(\)]+/);
    return phoneMatch ? phoneMatch[0].trim() : null;
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        services: {
            notion: !!notion,
            googleDrive: !!googleDrive
        },
        environment: {
            nodeEnv: process.env.NODE_ENV,
            hasNotionToken: !!process.env.NOTION_TOKEN,
            hasGoogleCredentials: !!process.env.GOOGLE_CREDENTIALS,
            hasGoogleDriveFolder: !!process.env.GOOGLE_DRIVE_PARENT_FOLDER
        }
    });
});

// Temporary configuration endpoint
app.get('/configure-notion', (req, res) => {
    const { token } = req.query;
    
    if (!token || !token.startsWith('ntn_')) {
        return res.json({ 
            error: 'Missing or invalid token parameter',
            usage: '/configure-notion?token=ntn_...'
        });
    }
    
    try {
        // Set environment variable temporarily
        process.env.NOTION_TOKEN = token;
        
        // Re-initialize Notion client
        notion = new Client({
            auth: token
        });
        
        console.log('✅ Notion client configured via admin endpoint');
        
        res.json({ 
            success: true, 
            message: 'Notion token configured successfully',
            services: {
                notion: !!notion,
                googleDrive: !!googleDrive
            }
        });
    } catch (error) {
        console.error('Failed to configure Notion client:', error);
        res.status(500).json({ 
            error: 'Failed to configure Notion client',
            details: error.message
        });
    }
});

app.get('/configure-google-drive', (req, res) => {
    const { folder_id } = req.query;
    
    if (!folder_id) {
        return res.json({
            error: 'Missing folder_id parameter',
            usage: '/configure-google-drive?folder_id=1GaAWZT6leiJoMh4rhpKDHr0NnvEKveF6'
        });
    }
    
    try {
        // Set Google Drive parent folder
        process.env.GOOGLE_DRIVE_PARENT_FOLDER = folder_id;
        
        console.log('✅ Google Drive parent folder configured:', folder_id);
        
        res.json({
            success: true,
            message: 'Google Drive parent folder configured successfully',
            folder_id: folder_id,
            services: {
                notion: !!notion,
                googleDrive: true
            }
        });
    } catch (error) {
        console.error('Error configuring Google Drive:', error);
        res.status(500).json({
            error: 'Failed to configure Google Drive'
        });
    }
});

app.post('/configure-google-credentials', (req, res) => {
    const { credentials } = req.body;
    
    if (!credentials) {
        return res.json({
            error: 'Missing credentials in request body',
            usage: 'POST with JSON: {"credentials": {...google-service-account-json...}}'
        });
    }
    
    try {
        // Validate JSON structure
        if (typeof credentials === 'string') {
            JSON.parse(credentials);
            process.env.GOOGLE_CREDENTIALS = credentials;
        } else if (typeof credentials === 'object') {
            process.env.GOOGLE_CREDENTIALS = JSON.stringify(credentials);
        } else {
            throw new Error('Invalid credentials format');
        }
        
        // Re-initialize Google Drive client
        const auth = new google.auth.GoogleAuth({
            credentials: typeof credentials === 'string' ? JSON.parse(credentials) : credentials,
            scopes: ['https://www.googleapis.com/auth/drive.file']
        });
        googleDrive = google.drive({ version: 'v3', auth });
        
        console.log('✅ Google Drive credentials configured successfully');
        
        res.json({
            success: true,
            message: 'Google Drive credentials configured successfully',
            services: {
                notion: !!notion,
                googleDrive: !!googleDrive
            }
        });
    } catch (error) {
        console.error('Error configuring Google Drive credentials:', error);
        res.status(500).json({
            error: 'Failed to configure Google Drive credentials',
            details: error.message
        });
    }
});

app.get('/test-notion', async (req, res) => {
    try {
        if (!notion) {
            return res.status(500).json({ error: 'Notion client not initialized' });
        }

        // Test Notion database access
        const response = await notion.databases.query({
            database_id: '240ee517-627c-8076-aaeb-ea82ff40c672', // MIETER Database
            page_size: 1
        });

        res.json({
            status: 'OK',
            database: '240ee517-627c-8076-aaeb-ea82ff40c672',
            accessible: true,
            recordCount: response.results.length,
            hasMore: response.has_more
        });
    } catch (error) {
        console.error('Notion test error:', error);
        res.status(500).json({
            error: 'Notion database test failed',
            message: error.message,
            code: error.code
        });
    }
});

app.post('/api/submit-gutachten', async (req, res) => {
    try {
        const formData = req.body;
        
        console.log('🔍 Received form data:', JSON.stringify(formData, null, 2));
        
        // Check if Notion is available
        if (!notion) {
            console.error('❌ Notion client not initialized - missing NOTION_TOKEN');
            return res.status(500).json({
                error: 'Server-Konfigurationsfehler: Notion-Verbindung nicht verfügbar'
            });
        }
        
        // Validation
        if (!formData.auftraggeber?.name || !formData.auftraggeber?.kennzeichen) {
            console.log('❌ Validation failed:', {
                name: formData.auftraggeber?.name,
                kennzeichen: formData.auftraggeber?.kennzeichen
            });
            return res.status(400).json({
                error: 'Name und Kennzeichen sind erforderlich'
            });
        }

        console.log('✅ Processing gutachten submission:', {
            name: formData.auftraggeber.name,
            kennzeichen: formData.auftraggeber.kennzeichen,
            timestamp: formData.timestamp
        });

        console.log('🔍 Step 1: Starting customer search...');
        // Check for existing customer by Kennzeichen
        const existingCustomer = await findExistingCustomerByKennzeichen(formData.auftraggeber.kennzeichen);
        
        console.log('🔍 Step 2: Creating/updating Notion contact...');
        let notionContact = null;
        if (existingCustomer) {
            console.log('🔄 Updating existing customer:', existingCustomer.id);
            notionContact = await updateExistingCustomer(existingCustomer, formData);
        } else {
            console.log('👤 Creating new customer');
            notionContact = await createNotionContact(formData);
        }
        console.log('✅ Notion contact processed:', notionContact?.id);

        console.log('🔍 Step 3: Handling Google Drive folder...');
        // Handle Google Drive folder (find existing or create new)
        const folderName = `${formData.auftraggeber.kennzeichen} - ${formData.auftraggeber.name}`;
        let folderId = null;
        
        if (existingCustomer) {
            // Try to find existing folder for this Kennzeichen
            folderId = await findExistingGoogleDriveFolder(formData.auftraggeber.kennzeichen);
        }
        
        if (!folderId) {
            try {
                folderId = await createGoogleDriveFolder(folderName, formData);
                console.log('📁 Google Drive folder created:', folderId);
            } catch (driveError) {
                console.error('Google Drive error (non-blocking):', driveError.message);
            }
        } else {
            console.log('📁 Using existing Google Drive folder:', folderId);
        }

        console.log('🔍 Step 4: Generating PDF...');
        // Generate PDF
        const pdfBuffer = await generateGutachtenPDF(formData);
        console.log('✅ PDF generated, size:', pdfBuffer.length);

        console.log('🔍 Step 5: Uploading PDF to Drive...');
        // Upload PDF to Drive
        let pdfFileId = null;
        if (folderId) {
            try {
                const fileName = `Gutachtenauftrag_${formData.auftraggeber.kennzeichen}_${new Date().toISOString().split('T')[0]}.pdf`;
                pdfFileId = await uploadPDFToDrive(pdfBuffer, fileName, folderId);
                console.log('📁 PDF uploaded to Drive:', pdfFileId);
            } catch (uploadError) {
                console.error('PDF upload error (non-blocking):', uploadError.message);
            }
        }

        console.log('✅ All steps completed successfully!');
        
        // Success response
        res.json({
            success: true,
            message: 'Gutachtenauftrag erfolgreich verarbeitet',
            data: {
                gutachtenNr: formData.gutachtenNr,
                notionContactId: notionContact?.id,
                googleDriveFolderId: folderId,
                pdfFileId: pdfFileId,
                timestamp: formData.timestamp
            }
        });

    } catch (error) {
        console.error('❌ Form submission error:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            error: 'Interner Server-Fehler beim Verarbeiten des Auftrags',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error Handling
app.use((req, res) => {
    res.status(404).json({ error: 'Seite nicht gefunden' });
});

app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Interner Server-Fehler',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Temporary admin endpoint for setting environment variables (will be removed)
app.post('/admin/set-notion-token', (req, res) => {
    const { token, adminKey } = req.body;
    
    // Basic security check
    if (adminKey !== 'temp-admin-2025') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    if (!token || !token.startsWith('ntn_')) {
        return res.status(400).json({ error: 'Invalid Notion token format' });
    }
    
    // Set environment variable temporarily
    process.env.NOTION_TOKEN = token;
    
    // Re-initialize Notion client
    try {
        notion = new Client({
            auth: token
        });
        console.log('✅ Notion client re-initialized with new token');
        
        res.json({ 
            success: true, 
            message: 'Notion token set successfully. Server configuration updated.' 
        });
    } catch (error) {
        console.error('Failed to initialize Notion client:', error);
        res.status(500).json({ 
            error: 'Failed to initialize Notion client with provided token' 
        });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DS Gutachten Formular Server läuft auf Port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Notion: ${notion ? '✅ Verbunden' : '❌ Nicht konfiguriert'}`);
    console.log(`📁 Google Drive: ${googleDrive ? '✅ Verbunden' : '❌ Nicht konfiguriert'}`);
    
    // Log environment status for debugging
    if (!process.env.NOTION_TOKEN) {
        console.log('⚠️  To configure Notion token, POST to /admin/set-notion-token with:');
        console.log('   { "token": "ntn_...", "adminKey": "temp-admin-2025" }');
    }
});

module.exports = app;