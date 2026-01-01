const User = require('../models/User');

// @desc    Update user profile (GST, Company, Address, Pincode)
// @route   POST /api/user/update-profile
// @access  Private
const updateProfile = async (req, res) => {
    const { gstNumber, companyName, address, pincode, city, state } = req.body;

    // req.user is set by authMiddleware
    const userId = req.user._id;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.gstNumber = gstNumber || user.gstNumber;
        user.companyName = companyName || user.companyName;
        user.address = address || user.address;
        user.pincode = pincode || user.pincode;
        user.city = city || user.city;
        user.state = state || user.state;

        const updatedUser = await user.save();

        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                _id: updatedUser._id,
                userId: updatedUser.userId,
                phone: updatedUser.phone,
                email: updatedUser.email,
                gstNumber: updatedUser.gstNumber,
                companyName: updatedUser.companyName,
                address: updatedUser.address,
                pincode: updatedUser.pincode,
                city: updatedUser.city,
                state: updatedUser.state
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    updateProfile
};
