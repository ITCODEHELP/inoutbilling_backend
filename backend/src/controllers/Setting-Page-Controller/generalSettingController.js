const GeneralSettings = require('../../models/Setting-Model/GeneralSetting');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Configure Multer for settings images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/settings';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, JPEG, and PNG are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

const uploadFields = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'background', maxCount: 1 },
    { name: 'footer', maxCount: 1 }
]);

// @desc    Get general settings
// @route   GET /api/general-settings
// @access  Private
const getGeneralSettings = async (req, res) => {
    try {
        let settings = await GeneralSettings.findOne({ userId: req.user._id });

        if (!settings) {
            settings = await GeneralSettings.create({ userId: req.user._id });
        }

        res.status(200).json({
            success: true,
            message: 'General settings fetched successfully',
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Update general settings
// @route   POST /api/general-settings/update
// @access  Private
const updateGeneralSettings = async (req, res) => {
    try {
        const settings = await GeneralSettings.findOneAndUpdate(
            { userId: req.user._id },
            { ...req.body, userId: req.user._id },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'General settings updated successfully',
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Upload settings images
// @route   POST /api/general-settings/upload-images
// @access  Private
const uploadSettingsImages = (req, res) => {
    uploadFields(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        try {
            // Define maximum dimensions for each image type
            const maxDimensions = {
                logo: { width: 400, height: 200 },
                signature: { width: 540, height: 150 },
                background: { width: 1400, height: 1400 },
                footer: { width: 1400, height: 300 }
            };

            // Validate image dimensions
            const uploadedFiles = req.files;
            for (const fieldName in uploadedFiles) {
                if (uploadedFiles[fieldName] && uploadedFiles[fieldName][0]) {
                    const file = uploadedFiles[fieldName][0];
                    const metadata = await sharp(file.path).metadata();
                    const maxDim = maxDimensions[fieldName];

                    if (metadata.width > maxDim.width || metadata.height > maxDim.height) {
                        // Delete the uploaded file
                        fs.unlinkSync(file.path);

                        // Delete all other uploaded files in this request
                        for (const field in uploadedFiles) {
                            if (uploadedFiles[field] && uploadedFiles[field][0]) {
                                const filePath = uploadedFiles[field][0].path;
                                if (fs.existsSync(filePath)) {
                                    fs.unlinkSync(filePath);
                                }
                            }
                        }

                        return res.status(400).json({
                            success: false,
                            message: `Please upload ${fieldName} image size between ${maxDim.width}x${maxDim.height} pixels. Your image is ${metadata.width}x${metadata.height} pixels.`
                        });
                    }
                }
            }

            const settings = await GeneralSettings.findOne({ userId: req.user._id }) || new GeneralSettings({ userId: req.user._id });

            // Handle logo upload
            if (req.files['logo']) {
                if (settings.logoPath && fs.existsSync(settings.logoPath)) {
                    fs.unlinkSync(settings.logoPath);
                }
                settings.logoPath = req.files['logo'][0].path;
            }

            // Handle signature upload
            if (req.files['signature']) {
                if (settings.signaturePath && fs.existsSync(settings.signaturePath)) {
                    fs.unlinkSync(settings.signaturePath);
                }
                settings.signaturePath = req.files['signature'][0].path;
            }

            // Handle background upload
            if (req.files['background']) {
                if (settings.invoiceBackgroundPath && fs.existsSync(settings.invoiceBackgroundPath)) {
                    fs.unlinkSync(settings.invoiceBackgroundPath);
                }
                settings.invoiceBackgroundPath = req.files['background'][0].path;
            }

            // Handle footer upload
            if (req.files['footer']) {
                if (settings.invoiceFooterPath && fs.existsSync(settings.invoiceFooterPath)) {
                    fs.unlinkSync(settings.invoiceFooterPath);
                }
                settings.invoiceFooterPath = req.files['footer'][0].path;
            }

            await settings.save();

            res.status(200).json({
                success: true,
                message: 'Images uploaded successfully',
                data: settings
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

module.exports = {
    getGeneralSettings,
    updateGeneralSettings,
    uploadSettingsImages
};
