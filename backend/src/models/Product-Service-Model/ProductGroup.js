const mongoose = require('mongoose');

const productGroupSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    groupName: {
        type: String,
        required: [true, 'Group Name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Compound index to ensure unique group names per user
productGroupSchema.index({ userId: 1, groupName: 1 }, { unique: true });

module.exports = mongoose.model('ProductGroup', productGroupSchema);
