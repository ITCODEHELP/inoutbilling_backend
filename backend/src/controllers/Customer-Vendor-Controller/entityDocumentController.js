const EntityDocument = require('../../models/Customer-Vendor-Model/EntityDocument');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Helper to resolve entity by ID or name
 */
const _resolveEntity = async (userId, entityRef) => {
    if (!entityRef) throw new Error("Entity ID or Name is required");

    let entity = null;
    let type = '';

    // Try ID first
    if (entityRef.match(/^[0-9a-fA-F]{24}$/)) {
        entity = await Customer.findOne({ _id: entityRef, userId }).lean();
        if (entity) type = 'Customer';

        if (!entity) {
            entity = await Vendor.findOne({ _id: entityRef, userId }).lean();
            if (entity) type = entity.isCustomerVendor ? 'CustomerVendor' : 'Vendor';
        }
    }

    // Try Name if not found by ID
    if (!entity) {
        entity = await Customer.findOne({
            userId,
            companyName: { $regex: new RegExp(`^${entityRef.trim()}$`, 'i') }
        }).lean();
        if (entity) type = 'Customer';

        if (!entity) {
            entity = await Vendor.findOne({
                userId,
                companyName: { $regex: new RegExp(`^${entityRef.trim()}$`, 'i') }
            }).lean();
            if (entity) type = entity.isCustomerVendor ? 'CustomerVendor' : 'Vendor';
        }
    }

    if (!entity) throw new Error(`Entity '${entityRef}' not found`);
    return { entity, type };
};

/**
 * @desc    Upload Document
 * @route   POST /api/customer-vendor/documents/upload
 */
const uploadDocument = async (req, res) => {
    try {
        const { entityRef } = req.body;
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const { entity, type } = await _resolveEntity(req.user._id, entityRef);

        const newDoc = new EntityDocument({
            userId: req.user._id,
            entityId: entity._id,
            entityType: type,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            filePath: req.file.path.replace(/\\/g, '/') // Ensure forward slashes for URLs
        });

        await newDoc.save();

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: {
                ...newDoc.toObject(),
                previewUrl: `${req.protocol}://${req.get('host')}/${newDoc.filePath}`
            }
        });
    } catch (error) {
        // Clean up file if DB save fails
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    List Documents
 * @route   GET /api/customer-vendor/documents/:entityRef
 */
const listDocuments = async (req, res) => {
    try {
        const { entityRef } = req.params;
        const { entity } = await _resolveEntity(req.user._id, entityRef);

        const documents = await EntityDocument.find({
            userId: req.user._id,
            entityId: entity._id
        }).sort({ createdAt: -1 }).lean();

        const data = documents.map(doc => ({
            ...doc,
            previewUrl: `${req.protocol}://${req.get('host')}/${doc.filePath}`
        }));

        res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Document
 * @route   DELETE /api/customer-vendor/documents/delete/:documentId
 */
const deleteDocument = async (req, res) => {
    try {
        const { documentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ success: false, message: "Invalid Document ID" });
        }

        const document = await EntityDocument.findOne({
            _id: documentId,
            userId: req.user._id
        });

        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found or unauthorized" });
        }

        // 1. Delete physical file
        if (fs.existsSync(document.filePath)) {
            fs.unlinkSync(document.filePath);
        }

        // 2. Delete DB record
        await EntityDocument.findByIdAndDelete(documentId);

        res.status(200).json({ success: true, message: "Document deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    uploadDocument,
    listDocuments,
    deleteDocument
};
