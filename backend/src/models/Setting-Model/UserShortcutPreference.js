const mongoose = require('mongoose');

const userShortcutPreferenceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    isEnabled: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'user_shortcut_preferences'
});

module.exports = mongoose.model('UserShortcutPreference', userShortcutPreferenceSchema);
