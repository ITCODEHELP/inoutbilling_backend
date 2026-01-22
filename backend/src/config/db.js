const mongoose = require('mongoose');

// Flag to ensure connection log appears only once
let connectionLogged = false;

const connectDB = async () => {
    try {
        // Check if already connected to avoid duplicate connections
        if (mongoose.connection.readyState === 1) {
            // Already connected, only log if not already logged
            if (!connectionLogged) {
                console.log(`MongoDB Connected: ${mongoose.connection.host}`);
                connectionLogged = true;
            }
            return;
        }
        
        const conn = await mongoose.connect(process.env.MONGO_URI);
        // Only log if not already logged
        if (!connectionLogged) {
            console.log(`MongoDB Connected: ${conn.connection.host}`);
            connectionLogged = true;
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
