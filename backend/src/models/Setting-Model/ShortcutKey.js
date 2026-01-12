const mongoose = require('mongoose');

const shortcutKeySchema = new mongoose.Schema({
    moduleName: {
        type: String,
        required: true,
        index: true
    },
    actionLabel: {
        type: String,
        required: true
    },
    keyCombination: {
        type: String,
        required: true,
        unique: true
    },
    targetRoute: {
        type: String,
        required: true
    },
    queryParams: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    description: {
        type: String
    }
}, {
    timestamps: true,
    collection: 'shortcut_keys'
});

// Static helper to seed/get default shortcuts
shortcutKeySchema.statics.getSeedData = () => [
    { moduleName: 'Sales', actionLabel: 'Create Invoice', keyCombination: 'Alt+S+I', targetRoute: '/sales/invoice/create' },
    { moduleName: 'Dashboard', actionLabel: 'Go to Dashboard', keyCombination: 'Alt+D', targetRoute: '/dashboard' },
    { moduleName: 'Product', actionLabel: 'Add Product', keyCombination: 'Alt+P+A', targetRoute: '/product/add' },
    { moduleName: 'Setting', actionLabel: 'Open Settings', keyCombination: 'Alt+G+S', targetRoute: '/settings' }
];

module.exports = mongoose.model('ShortcutKey', shortcutKeySchema);
