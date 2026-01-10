const DispatchAddress = require('../models/Setting-Model/DispatchAddress');
const User = require('../models/User-Model/User');

/**
 * Calculates the Haversine distance between two sets of coordinates.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in kilometers
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return Math.round(d * 100) / 100;
};

/**
 * Mock helper to get coordinates for a pincode.
 * Since no existing mapping was found, this uses a weighted approach or random coordinates 
 * based on state/pincode prefix to simulate "existing helpers" requirement if it was a mock.
 * Ideally, this would use a real database or API.
 */
const getCoordinatesForPincode = (pincode, state) => {
    // This is a simplified mock. In a real scenario, you'd have a mapping.
    // For now, we will return deterministic values based on pincode for demonstration.
    if (!pincode) return { lat: 0, lng: 0 };

    // Use first two digits of pincode to shift lat/lng slightly
    const prefix = parseInt(pincode.substring(0, 2)) || 20;
    const suffix = parseInt(pincode.substring(pincode.length - 2)) || 50;

    // Base lat/lng for India roughly (20, 78)
    return {
        lat: 10 + (prefix / 2),
        lng: 70 + (suffix / 3)
    };
};

/**
 * Main helper to calculate distance for shipping address.
 * @param {string} userId 
 * @param {object} shippingAddress 
 * @param {string} branchId - Optional branch (DispatchAddress) ID
 */
const calculateShippingDistance = async (userId, shippingAddress, branchId = null) => {
    try {
        if (!shippingAddress || !shippingAddress.pincode) return 0;

        let branchAddress = null;
        if (branchId) {
            if (typeof branchId === 'string' || mongoose.Types.ObjectId.isValid(branchId)) {
                branchAddress = await DispatchAddress.findOne({ _id: branchId, userRef: userId });
            } else if (typeof branchId === 'object') {
                branchAddress = branchId;
            }
        }

        if (!branchAddress) {
            // Fallback to user profile address
            branchAddress = await User.findById(userId);
        }

        if (!branchAddress || !branchAddress.pincode) return 0;

        const fromCoord = getCoordinatesForPincode(branchAddress.pincode, branchAddress.state);
        const toCoord = getCoordinatesForPincode(shippingAddress.pincode, shippingAddress.state);

        return calculateHaversineDistance(fromCoord.lat, fromCoord.lng, toCoord.lat, toCoord.lng);
    } catch (error) {
        console.error('Distance calculation error:', error);
        return 0;
    }
};

module.exports = {
    calculateShippingDistance,
    getCoordinatesForPincode,
    calculateHaversineDistance
};
