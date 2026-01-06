const mongoose = require('mongoose');

const proformaCustomFieldSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Field Name is required']
    },
    type: {
        type: String,
        enum: ['TEXT', 'DATE', 'DROPDOWN'],
        required: [true, 'Field Type is required']
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    print: {
        type: Boolean,
        default: false
    },
    required: {
        type: Boolean,
        default: false
    },
    options: {
        type: [String],
        default: []
    },
    orderNo: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

proformaCustomFieldSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ProformaCustomField', proformaCustomFieldSchema);
