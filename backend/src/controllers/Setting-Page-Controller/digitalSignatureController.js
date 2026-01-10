const DigitalSignature = require('../../models/Setting-Model/DigitalSignature');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Encryption logic (AES-256-CBC)
const ENCRYPTION_KEY = crypto.createHash('sha256')
    .update(String(process.env.DIGITAL_SIGNATURE_SECRET || 'fallback_secret_keep_it_safe_2026'))
    .digest(); // Properly derived 32-byte key
const IV_LENGTH = 16;

const encrypt = (text) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

const decrypt = (text) => {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        return null; // Handle decryption failure
    }
};

// Configure Multer for .pfx files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/certificates';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `cert_${req.user._id}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pfx') {
        cb(null, true);
    } else {
        cb(new Error('Invalid certificate file. Only .pfx files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single('pfxFile');

// @desc    Upload digital signature certificate
// @route   POST /api/setting-digital-signature/upload
// @access  Private
const uploadCertificate = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'Error uploading file'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Certificate file is required'
            });
        }

        const { password } = req.body;
        if (!password) {
            // Remove uploaded file if password missing
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Password required'
            });
        }

        try {
            // Find existing certificate to delete file
            const existing = await DigitalSignature.findOne({ userId: req.user._id });
            if (existing && fs.existsSync(existing.filePath)) {
                fs.unlinkSync(existing.filePath);
            }

            // Encrypt certificate password
            const encryptedPassword = encrypt(password);

            // Update or Create
            const certData = {
                userId: req.user._id,
                fileName: req.file.originalname,
                filePath: req.file.path,
                certificatePassword: encryptedPassword,
                isEnabled: true
            };

            const digitalSignature = await DigitalSignature.findOneAndUpdate(
                { userId: req.user._id },
                certData,
                { upsert: true, new: true }
            );

            res.status(200).json({
                success: true,
                message: 'Digital signature certificate uploaded successfully',
                data: {
                    fileName: digitalSignature.fileName,
                    uploadDate: digitalSignature.uploadDate,
                    isEnabled: digitalSignature.isEnabled
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server Error',
                data: error.message
            });
        }
    });
};

// @desc    Toggle digital signature enabled/disabled
// @route   POST /api/setting-digital-signature/toggle
// @access  Private
const toggleDigitalSignature = async (req, res) => {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: 'Enabled state must be a boolean'
        });
    }

    try {
        const digitalSignature = await DigitalSignature.findOne({ userId: req.user._id });

        if (!digitalSignature) {
            return res.status(404).json({
                success: false,
                message: 'No certificate found. Please upload one first'
            });
        }

        digitalSignature.isEnabled = enabled;
        await digitalSignature.save();

        res.status(200).json({
            success: true,
            message: `Digital signature ${enabled ? 'enabled' : 'disabled'} successfully`,
            data: { isEnabled: digitalSignature.isEnabled }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Get current digital signature status
// @route   GET /api/setting-digital-signature/status
// @access  Private
const getDigitalSignatureStatus = async (req, res) => {
    try {
        const digitalSignature = await DigitalSignature.findOne({ userId: req.user._id });

        res.status(200).json({
            success: true,
            message: 'Digital signature status fetched successfully',
            data: digitalSignature ? {
                fileName: digitalSignature.fileName,
                uploadDate: digitalSignature.uploadDate,
                isEnabled: digitalSignature.isEnabled
            } : null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

module.exports = {
    uploadCertificate,
    toggleDigitalSignature,
    getDigitalSignatureStatus
};
