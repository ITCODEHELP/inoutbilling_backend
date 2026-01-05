const CustomHeaderDesign = require('../models/CustomHeaderDesign');
const multer = require('multer');
const path = require('path');
const uploadsDir = require('../utils/uploadsDir');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File Filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only images are allowed (jpeg, jpg, png, gif, svg)!'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
}).single('image');

/**
 * @desc    Upload Header Image
 * @route   POST /api/custom-header-design/upload-image
 * @access  Private
 */
const uploadImage = (req, res) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json({ success: false, message: err.message });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        // Return relative path and usable URL
        const relativePath = `/uploads/${req.file.filename}`;
        // Assuming server runs on the host specified in headers or default localhost
        const protocol = req.protocol;
        const host = req.get('host');
        const fullUrl = `${protocol}://${host}${relativePath}`;

        res.status(200).json({
            success: true,
            message: "Image uploaded successfully",
            image_url: fullUrl,
            image_id: req.file.filename,
            filePath: relativePath // valid for internal usage if needed
        });
    });
};

/**
 * @desc    Save Custom Header Design
 * @route   POST /api/custom-header-design
 * @access  Private
 */
const saveDesign = async (req, res) => {
    try {
        const userId = req.user._id;
        const updateData = req.body;
        const docType = updateData.document_type; // Optional: "Sales Invoice", etc.

        // Find existing design
        let designDoc = await CustomHeaderDesign.findOne({ userId });

        if (!designDoc) {
            designDoc = await CustomHeaderDesign.create({ userId });
        }

        if (docType) {
            // Save to configurations map
            let currentConfigs = designDoc.configurations || {};
            // If currentConfigs is a Map? In Mixed type, usually POJO.
            // Ensure we handle it if it's undefined
            if (!currentConfigs) currentConfigs = {};

            // Merge logic for specific document type
            // Get existing or init new
            const existingConfig = currentConfigs[docType] || {};

            // Merge fields
            const newConfig = {
                layout_type: updateData.layout_type !== undefined ? updateData.layout_type : existingConfig.layout_type,
                design_variant: updateData.design_variant !== undefined ? updateData.design_variant : existingConfig.design_variant,
                header_height: updateData.header_height !== undefined ? updateData.header_height : existingConfig.header_height,
                options: updateData.options !== undefined ? { ...existingConfig.options, ...updateData.options } : existingConfig.options,
                layers: updateData.layers !== undefined ? updateData.layers : existingConfig.layers,
                settings: updateData.settings !== undefined ? { ...existingConfig.settings, ...updateData.settings } : existingConfig.settings
            };

            currentConfigs[docType] = newConfig;
            designDoc.configurations = currentConfigs;
            designDoc.markModified('configurations');

        } else {
            // Backward compatibility: Save to root fields
            if (updateData.layout_type !== undefined) {
                designDoc.layout_type = updateData.layout_type;
            }
            if (updateData.design_variant !== undefined) {
                designDoc.design_variant = updateData.design_variant;
            }
            if (updateData.header_height !== undefined) {
                designDoc.header_height = updateData.header_height;
            }
            if (updateData.layers !== undefined) {
                designDoc.layers = updateData.layers;
            }
            if (updateData.options !== undefined) {
                designDoc.options = { ...designDoc.options, ...updateData.options };
            }
            if (updateData.settings !== undefined) {
                designDoc.settings = { ...designDoc.settings, ...updateData.settings };
            }

            designDoc.markModified('layers');
            designDoc.markModified('options');
            designDoc.markModified('settings');
        }

        await designDoc.save();

        res.status(200).json({
            success: true,
            message: "Custom header design saved successfully"
        });

    } catch (error) {
        console.error("Error saving custom header design:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Get Custom Header Design
 * @route   GET /api/custom-header-design
 * @access  Private
 */
const getDesign = async (req, res) => {
    try {
        const userId = req.user._id;
        const designDoc = await CustomHeaderDesign.findOne({ userId });

        if (designDoc) {
            res.status(200).json({
                layout_type: designDoc.layout_type,
                design_variant: designDoc.design_variant,
                header_height: designDoc.header_height,
                options: designDoc.options,
                layers: designDoc.layers,
                settings: designDoc.settings,
                configurations: designDoc.configurations || {} // Return map too
            });
        } else {
            // Return empty/defaults
            res.status(200).json({
                layout_type: '',
                design_variant: '',
                header_height: 100,
                options: {},
                layers: [],
                settings: {},
                configurations: {}
            });
        }
    } catch (error) {
        console.error("Error fetching custom header design:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

module.exports = {
    saveDesign,
    getDesign,
    uploadImage
};
