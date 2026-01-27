const mongoose = require('mongoose');

const letterSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    letterNumber: {
        prefix: { type: String, trim: true },
        number: {
            type: String,
            required: [true, 'Letter number is required'],
            trim: true
        },
        postfix: { type: String, trim: true }
    },
    letterDate: {
        type: Date,
        required: [true, 'Letter date is required']
    },
    templateType: {
        type: String,
        required: [true, 'Template type is required'],
        enum: {
            values: ['BLANK', 'LETTER_OF_INTENT', 'JOB_WORK', 'NO_OBJECTION', 'QUOTATION', 'SALES_CONTRACT'],
            message: 'Invalid template type'
        }
    },
    letterBody: {
        type: String,
        default: ""
    },
    blocks: [{
        id: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: ['text', 'heading', 'pageBreak', 'list', 'table', 'image', 'delimiter', 'entitySelector', 'productSelector', 'multiProductSelector']
        },
        content: mongoose.Schema.Types.Mixed,
        style: mongoose.Schema.Types.Mixed, // e.g. { level: 1 } for heading
        metadata: mongoose.Schema.Types.Mixed // e.g. for selectors or uploaded images
    }],
    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for performance
letterSchema.index({ userId: 1, isDeleted: 1 });
letterSchema.index({ 'letterNumber.number': 1 });

module.exports = mongoose.model('Letter', letterSchema);
