const mongoose = require('mongoose');

const otherIncomeCategorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

// Compound index to ensure unique category names per user
otherIncomeCategorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('OtherIncomeCategory', otherIncomeCategorySchema);
