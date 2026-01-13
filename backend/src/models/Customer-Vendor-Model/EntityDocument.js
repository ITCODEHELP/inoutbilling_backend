const mongoose = require('mongoose');

const entityDocumentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    entityType: {
        type: String,
        required: true,
        enum: ['Customer', 'Vendor', 'CustomerVendor'],
        index: true
    },
    originalName: {
        type: String,
        required: true
    },
    storedName: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    filePath: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    collection: 'entitydocuments'
});

// Simplified search for documents by entity
entityDocumentSchema.index({ userId: 1, entityId: 1 });

module.exports = mongoose.model('EntityDocument', entityDocumentSchema);
