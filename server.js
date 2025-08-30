// DS Gutachten Formular - Modern Node.js Server
// Complete rebuild with Notion and Google Drive integration

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { Client } = require('@notionhq/client');
const { google } = require('googleapis');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');

class DSGutachtenServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // Initialize APIs
        this.initializeNotionClient();
        this.initializeGoogleDrive();
        
        // Setup middleware
        this.setupMiddleware();
        
        // Setup routes
        this.setupRoutes();
        
        // Setup error handling
        this.setupErrorHandling();
    }

    initializeNotionClient() {
        if (!process.env.NOTION_TOKEN) {
            console.warn('⚠️  NOTION_TOKEN not provided - Notion integration disabled');
            this.notion = null;
            return;
        }

        try {
            this.notion = new Client({
                auth: process.env.NOTION_TOKEN,
            });
            console.log('✅ Notion client initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Notion client:', error.message);
            this.notion = null;
        }
    }

    async initializeGoogleDrive() {
        if (!process.env.GOOGLE_CREDENTIALS) {
            console.warn('⚠️  GOOGLE_CREDENTIALS not provided - Google Drive integration disabled');
            this.drive = null;
            return;
        }

        try {
            // Initialize with Service Account JSON file - no impersonation
            // User has shared the folder with the Service Account directly
            const auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_CREDENTIALS,
                scopes: ['https://www.googleapis.com/auth/drive'],
            });

            this.drive = google.drive({
                version: 'v3',
                auth,
            });
            
            console.log('✅ Google Drive client initialized with Service Account');
        } catch (error) {
            console.error('❌ Failed to initialize Google Drive client:', error.message);
            this.drive = null;
        }
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                },
            },
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: {
                error: 'Zu viele Anfragen von dieser IP-Adresse. Versuchen Sie es später erneut.',
            },
        });
        this.app.use(limiter);

        // Stricter rate limiting for form submissions
        const submitLimiter = rateLimit({
            windowMs: 10 * 60 * 1000, // 10 minutes
            max: 5, // limit each IP to 5 submissions per 10 minutes
            message: {
                error: 'Zu viele Formulareinsendungen. Bitte warten Sie 10 Minuten.',
            },
        });

        // CORS
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? ['https://ds-gutachten-formular-production.up.railway.app']
                : ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true,
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Logging
        this.app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

        // Static files
        this.app.use(express.static('public'));

        // Apply submit rate limiting to specific route
        this.app.use('/api/submit-gutachten', submitLimiter);
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    notion: !!this.notion,
                    googleDrive: !!this.drive,
                },
            });
        });

        // Main form page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Form submission endpoint
        this.app.post('/api/submit-gutachten', async (req, res) => {
            try {
                const result = await this.processGutachtenSubmission(req.body);
                res.json({
                    success: true,
                    message: 'Gutachten erfolgreich übermittelt',
                    data: result,
                });
            } catch (error) {
                console.error('Form submission error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Ein Fehler ist aufgetreten',
                });
            }
        });

        // Admin endpoint for setting Notion token (optional)
        this.app.get('/admin/set-notion-token', (req, res) => {
            const { token } = req.query;
            if (token && token.startsWith('ntn_')) {
                process.env.NOTION_TOKEN = token;
                this.initializeNotionClient();
                res.json({ success: true, message: 'Notion token updated' });
            } else {
                res.status(400).json({ success: false, message: 'Invalid token format' });
            }
        });
    }

    async processGutachtenSubmission(formData) {
        console.log('Processing gutachten submission...');
        
        // Normalize field names from frontend to backend format
        formData = this.normalizeFormData(formData);
        
        // Validate required fields
        this.validateFormData(formData);

        const results = {
            timestamp: new Date().toISOString(),
            gutachten_nr: formData.gutachten_nr,
        };

        // 1. Generate PDF file
        let pdfFilePath;
        try {
            pdfFilePath = await this.generatePDFFile(formData);
            results.pdf = { generated: true, filePath: pdfFilePath };
            console.log('✅ PDF file generation completed');
        } catch (error) {
            console.error('❌ PDF generation failed:', error.message);
            results.pdf = { error: error.message };
            throw new Error('PDF-Generierung fehlgeschlagen');
        }

        // 2. Upload to Google Drive (create folder with Kennzeichen)
        let googleDriveFileLink = null;
        if (this.drive && pdfFilePath) {
            try {
                const driveResult = await this.uploadToGoogleDrive(formData, pdfFilePath);
                results.googleDrive = driveResult;
                googleDriveFileLink = driveResult.fileLink;
                console.log('✅ Google Drive upload completed');
            } catch (error) {
                console.error('❌ Google Drive upload failed:', error.message);
                results.googleDrive = { error: error.message };
            }
        } else {
            results.googleDrive = { skipped: 'Google Drive client not initialized or PDF failed' };
        }

        // 3. Process Notion integration (with Google Drive link)
        if (this.notion) {
            try {
                const notionResult = await this.processNotionIntegration(formData, googleDriveFileLink);
                results.notion = notionResult;
                console.log('✅ Notion integration completed');
            } catch (error) {
                console.error('❌ Notion integration failed:', error.message);
                results.notion = { error: error.message };
            }
        } else {
            results.notion = { skipped: 'Notion client not initialized' };
        }

        return results;
    }

    normalizeFormData(data) {
        const normalized = {};
        
        // Process each field from the frontend data
        Object.keys(data).forEach(key => {
            const value = data[key];
            
            // Handle nested field names (e.g., "auftraggeber.name" -> "auftraggeber_name")
            if (key.includes('.')) {
                const parts = key.split('.');
                if (parts.length === 2) {
                    const [prefix, suffix] = parts;
                    const normalizedKey = `${prefix}_${suffix}`;
                    normalized[normalizedKey] = value;
                } else {
                    // For deeper nesting, just replace dots with underscores
                    normalized[key.replace(/\./g, '_')] = value;
                }
            } else {
                // Direct mapping for simple fields
                const fieldMapping = {
                    gutachtenNr: 'gutachten_nr'
                };
                
                const mappedKey = fieldMapping[key] || key;
                normalized[mappedKey] = value;
            }
        });
        
        // Auto-generate gutachten_nr if missing
        if (!normalized.gutachten_nr) {
            normalized.gutachten_nr = `DS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        }
        
        return normalized;
    }

    validateFormData(data) {
        const required = [
            'gutachten_nr', 'auftraggeber_name', 'auftraggeber_adresse',
            'auftraggeber_kontakt', 'auftraggeber_kennzeichen', 'unfall_tag', 'unfall_ort'
        ];

        for (const field of required) {
            if (!data[field] || data[field].toString().trim() === '') {
                throw new Error(`Erforderliches Feld fehlt: ${field}`);
            }
        }

        // Validate email format (extract from kontakt field)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (data.auftraggeber_kontakt && !emailRegex.test(data.auftraggeber_kontakt.split('/')[0].trim())) {
            // Skip email validation if contact doesn't contain email format
        }

        // Note: Signature validation temporarily disabled for testing
    }

    async processNotionIntegration(formData, googleDriveFileLink = null) {
        const kontakteId = process.env.KONTAKTE_DATABASE_ID;
        const businessResourcesId = process.env.BUSINESS_RESOURCES_DATABASE_ID;
        
        try {
            let customer = null;
            let businessResource = null;

            // 1. Create customer entry in KONTAKTE database
            if (kontakteId) {
                try {
                    // Check if customer already exists by Kennzeichen
                    const existingCustomer = await this.findCustomerByKennzeichen(kontakteId, formData.auftraggeber_kennzeichen);
                    
                    if (existingCustomer) {
                        customer = {
                            id: existingCustomer.id,
                            action: 'found_existing',
                        };
                        console.log('✅ Customer already exists in KONTAKTE');
                    } else {
                        // Create new customer
                        const customerResponse = await this.notion.pages.create({
                            parent: { database_id: kontakteId },
                            properties: this.buildKontakteProperties(formData),
                        });
                        customer = {
                            id: customerResponse.id,
                            action: 'created',
                        };
                        console.log('✅ Customer created in KONTAKTE database');
                    }
                } catch (error) {
                    console.error('❌ KONTAKTE customer creation failed:', error);
                    customer = { error: error.message };
                }
            }

            // 2. Create Business Resource entry for Gutachten
            if (businessResourcesId) {
                try {
                    const resourceResponse = await this.notion.pages.create({
                        parent: { database_id: businessResourcesId },
                        properties: this.buildGutachtenResourceProperties(formData, googleDriveFileLink, customer?.id),
                    });
                    businessResource = {
                        id: resourceResponse.id,
                        action: 'created',
                    };
                    console.log('✅ Gutachten Business Resource created');
                } catch (error) {
                    console.error('❌ Business Resource creation failed:', error);
                    businessResource = { error: error.message };
                }
            }

            return {
                customer,
                businessResource,
            };
        } catch (error) {
            console.error('Notion API error:', error);
            throw new Error(`Notion-Integration fehlgeschlagen: ${error.message}`);
        }
    }

    async findCustomerByKennzeichen(databaseId, kennzeichen) {
        try {
            const response = await this.notion.databases.query({
                database_id: databaseId,
                filter: {
                    property: 'Kennzeichen',
                    rich_text: {
                        equals: kennzeichen,
                    },
                },
            });
            
            return response.results.length > 0 ? response.results[0] : null;
        } catch (error) {
            console.error('Error searching for customer:', error);
            return null;
        }
    }

    buildKontakteProperties(formData) {
        // Extract email and phone from the combined field
        const kontaktParts = formData.auftraggeber_kontakt ? formData.auftraggeber_kontakt.split('/') : ['', ''];
        const email = kontaktParts[0] ? kontaktParts[0].trim() : '';
        const phone = kontaktParts[1] ? kontaktParts[1].trim() : '';

        return {
            'Name': {
                title: [
                    {
                        text: {
                            content: formData.auftraggeber_name || '',
                        },
                    },
                ],
            },
            'Kennzeichen': {
                rich_text: [
                    {
                        text: {
                            content: formData.auftraggeber_kennzeichen || '',
                        },
                    },
                ],
            },
            'Email': {
                email: email,
            },
            'Phone': {
                phone_number: phone || null,
            },
            'Address': {
                rich_text: [
                    {
                        text: {
                            content: formData.auftraggeber_adresse || '',
                        },
                    },
                ],
            },
            'Bereich ': {
                relation: [
                    {
                        id: '25b5e4b8-4c44-81b6-b25d-f0cf2e1ec15d', // Gutachten Bereich ID
                    },
                ],
            },
            'Priority': {
                select: {
                    name: 'Medium',
                },
            },
            'Archive': {
                checkbox: false,
            },
        };
    }

    buildGutachtenResourceProperties(formData, googleDriveFileLink, customerId = null) {
        const properties = {
            'Name': {
                title: [
                    {
                        text: {
                            content: `Gutachten ${formData.auftraggeber_kennzeichen} - ${formData.auftraggeber_name} (${formData.gutachten_nr})`,
                        },
                    },
                ],
            },
            'Type': {
                select: {
                    name: 'Auftrag Gutachten',
                },
            },
            'Archive': {
                checkbox: false,
            },
            'Favourite': {
                checkbox: false,
            },
        };

        // Add Google Drive link if available
        if (googleDriveFileLink) {
            properties['Link'] = {
                url: googleDriveFileLink,
            };
        }

        // Add customer relation if customer ID is provided
        if (customerId) {
            properties['Kontakte'] = {
                relation: [
                    {
                        id: customerId,
                    },
                ],
            };
        }

        return properties;
    }

    buildBusinessResourceProperties(formData, customerId, googleDriveFileLink) {
        return {
            'Name': {
                title: [
                    {
                        text: {
                            content: `Gutachten ${formData.kennzeichen} - ${formData.auftraggeber_name}`,
                        },
                    },
                ],
            },
            'Bereich': {
                relation: [
                    {
                        id: '25b5e4b8-4c44-81b6-b25d-f0cf2e1ec15d', // Gutachten Bereich ID
                    },
                ],
            },
            'Type': {
                select: {
                    name: 'Auftrag Gutachten',
                },
            },
            'Kontakte': {
                relation: [
                    {
                        id: customerId,
                    },
                ],
            },
            'Link': {
                url: googleDriveFileLink,
            },
            'Erstellungsdatum': {
                date: {
                    start: new Date().toISOString().split('T')[0],
                },
            },
            'Beschreibung': {
                rich_text: [
                    {
                        text: {
                            content: `Gutachten für Kennzeichen ${formData.kennzeichen}. Unfall am ${formData.unfalltag} in ${formData.unfallort}.`,
                        },
                    },
                ],
            },
        };
    }

    async generatePDFFile(formData) {
        return new Promise((resolve, reject) => {
            // Create temp directory if it doesn't exist
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Create unique filename
            const fileName = `Gutachten_${formData.gutachten_nr}_${Date.now()}.pdf`;
            const filePath = path.join(tempDir, fileName);
            
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(filePath);
            
            doc.pipe(stream);
            
            stream.on('close', () => {
                resolve(filePath);
            });
            doc.on('error', reject);
            stream.on('error', reject);

            try {
                // Header
                doc.fontSize(20)
                   .font('Helvetica-Bold')
                   .text('DS SACHVERSTÄNDIGENBÜRO', 50, 50);
                
                doc.fontSize(12)
                   .font('Helvetica')
                   .text('Mühlenstr. 49 - 33609 Bielefeld', 50, 80)
                   .text('Tel.: 0151-11738834', 50, 95)
                   .text('E-Mail: info@unfallschaden-bielefeld.de', 50, 110);

                // Title
                doc.fontSize(16)
                   .font('Helvetica-Bold')
                   .text('Auftrag zur Gutachtenerstellung', 50, 150);

                let yPos = 190;

                // Gutachten Info
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Gutachten Nr.:', 50, yPos);
                doc.font('Helvetica').text(formData.gutachten_nr, 150, yPos);
                yPos += 20;

                if (formData.abtretung) {
                    doc.text('✓ Abtretung', 50, yPos);
                    yPos += 20;
                }

                yPos += 10;

                // Auftraggeber
                doc.fontSize(14).font('Helvetica-Bold');
                doc.text('Auftraggeber (Geschädigter)', 50, yPos);
                yPos += 25;

                doc.fontSize(12).font('Helvetica');
                doc.text(`Name: ${formData.auftraggeber_name}`, 50, yPos);
                yPos += 15;
                doc.text(`Adresse: ${formData.auftraggeber_adresse || ''}`, 50, yPos);
                yPos += 15;
                
                // Parse contact field (email / phone)
                const kontakt = formData.auftraggeber_kontakt || '';
                const kontaktParts = kontakt.split('/').map(p => p.trim());
                const email = kontaktParts[0] || '';
                const phone = kontaktParts[1] || '';
                
                doc.text(`E-Mail: ${email}`, 50, yPos);
                yPos += 15;
                doc.text(`Telefon: ${phone}`, 50, yPos);
                yPos += 15;
                doc.text(`Kennzeichen: ${formData.auftraggeber_kennzeichen}`, 50, yPos);
                yPos += 25;

                // Vehicle Info
                if (formData.kilometerstand || formData.reifen || formData.fahrzeugstellnummer) {
                    doc.fontSize(14).font('Helvetica-Bold');
                    doc.text('Fahrzeugdaten', 50, yPos);
                    yPos += 20;

                    doc.fontSize(12).font('Helvetica');
                    if (formData.kilometerstand) {
                        doc.text(`Kilometerstand: ${formData.kilometerstand}`, 50, yPos);
                        yPos += 15;
                    }
                    if (formData.reifen) {
                        doc.text(`Reifen/Profiltiefe: ${formData.reifen}`, 50, yPos);
                        yPos += 15;
                    }
                    if (formData.fahrzeugstellnummer) {
                        doc.text(`Fahrzeugstellnummer: ${formData.fahrzeugstellnummer}`, 50, yPos);
                        yPos += 15;
                    }
                    yPos += 10;
                }

                // Accident Info
                doc.fontSize(14).font('Helvetica-Bold');
                doc.text('Unfalldaten', 50, yPos);
                yPos += 20;

                doc.fontSize(12).font('Helvetica');
                doc.text(`Unfalltag: ${formData.unfall_tag}`, 50, yPos);
                yPos += 15;
                if (formData.uhrzeit) {
                    doc.text(`Uhrzeit: ${formData.uhrzeit}`, 50, yPos);
                    yPos += 15;
                }
                doc.text(`Unfallort: ${formData.unfall_ort}`, 50, yPos);
                yPos += 15;

                if (formData.schadenbeschreibung) {
                    doc.text('Schadenbeschreibung:', 50, yPos);
                    yPos += 15;
                    const description = doc.heightOfString(formData.schadenbeschreibung, { width: 500 });
                    doc.text(formData.schadenbeschreibung, 50, yPos, { width: 500 });
                    yPos += description + 15;
                }

                // Check if we need a new page
                if (yPos > 700) {
                    doc.addPage();
                    yPos = 50;
                }

                // Signature
                yPos += 20;
                doc.fontSize(12).font('Helvetica-Bold');
                doc.text('Ort/Datum und Unterschrift:', 50, yPos);
                yPos += 20;

                if (formData.ort) {
                    doc.font('Helvetica').text(`${formData.ort}, ${new Date().toLocaleDateString('de-DE')}`, 50, yPos);
                } else {
                    doc.font('Helvetica').text(new Date().toLocaleDateString('de-DE'), 50, yPos);
                }

                // Add signature if provided
                if (formData.unterschrift && formData.unterschrift !== 'data:,') {
                    try {
                        const signatureData = formData.unterschrift.replace(/^data:image\/png;base64,/, '');
                        const signatureBuffer = Buffer.from(signatureData, 'base64');
                        doc.image(signatureBuffer, 300, yPos - 10, { width: 200, height: 60 });
                    } catch (error) {
                        console.error('Error adding signature to PDF:', error);
                    }
                }

                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    async uploadToGoogleDrive(formData, pdfFilePath) {
        const folderName = formData.auftraggeber_kennzeichen || formData.kennzeichen;
        const fileName = `Gutachten_${formData.gutachten_nr}.pdf`;

        try {
            // Use the root folder from environment variables - this is a shared drive folder
            const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER;
            
            if (!rootFolderId) {
                throw new Error('GOOGLE_DRIVE_ROOT_FOLDER not configured');
            }

            // First, get information about the root folder to determine if it's in a shared drive
            const rootFolderInfo = await this.drive.files.get({
                fileId: rootFolderId,
                fields: 'id, name, parents, driveId',
                supportsAllDrives: true,
            });

            const isSharedDrive = !!rootFolderInfo.data.driveId;
            console.log(`📁 Root folder info: ${rootFolderInfo.data.name}, Shared Drive: ${isSharedDrive}`);

            // Check if customer folder exists (using Kennzeichen as folder name)
            const existingFolders = await this.drive.files.list({
                q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents`,
                fields: 'files(id, name)',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                ...(isSharedDrive && { corpora: 'drive', driveId: rootFolderInfo.data.driveId }),
            });

            let customerFolderId;
            if (existingFolders.data.files.length > 0) {
                customerFolderId = existingFolders.data.files[0].id;
                console.log(`📁 Using existing folder: ${folderName}`);
            } else {
                // Create customer folder with Kennzeichen as name
                const customerFolder = await this.drive.files.create({
                    requestBody: {
                        name: folderName,
                        parents: [rootFolderId],
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    supportsAllDrives: true,
                });
                customerFolderId = customerFolder.data.id;
                console.log(`📁 Created new folder: ${folderName}`);
            }

            // Upload PDF to the folder (whether in shared drive or regular drive)
            const fileResponse = await this.drive.files.create({
                requestBody: {
                    name: fileName,
                    parents: [customerFolderId],
                    mimeType: 'application/pdf',
                },
                media: {
                    mimeType: 'application/pdf',
                    body: fs.createReadStream(pdfFilePath),
                },
                supportsAllDrives: true,
            });

            // Make the file shareable with a link
            await this.drive.permissions.create({
                fileId: fileResponse.data.id,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
                supportsAllDrives: true,
            });

            const fileLink = `https://drive.google.com/file/d/${fileResponse.data.id}/view`;

            console.log(`✅ PDF uploaded to Google Drive: ${fileLink}`);

            return {
                fileId: fileResponse.data.id,
                fileName: fileName,
                folderName: folderName,
                folderId: customerFolderId,
                fileLink: fileLink,
            };

        } catch (error) {
            console.error('Google Drive upload error:', error);
            throw new Error(`Google Drive Upload fehlgeschlagen: ${error.message}`);
        }
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Route nicht gefunden',
                path: req.path,
            });
        });

        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('Global error handler:', error);
            
            res.status(error.status || 500).json({
                success: false,
                message: process.env.NODE_ENV === 'production' 
                    ? 'Ein interner Serverfehler ist aufgetreten' 
                    : error.message,
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
            });
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🚀 DS Gutachten Server läuft auf Port ${this.port}`);
            console.log(`📍 URL: http://localhost:${this.port}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            
            if (process.env.NODE_ENV === 'production') {
                console.log('🔒 Production security features enabled');
            }
        });
    }
}

// Create and start server
const server = new DSGutachtenServer();
server.start();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully');
    process.exit(0);
});