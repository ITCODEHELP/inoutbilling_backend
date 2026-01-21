const mongoose = require('mongoose');

const expenseCategorySchema = new mongoose.Schema({
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
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index to ensure unique category names per user
expenseCategorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
