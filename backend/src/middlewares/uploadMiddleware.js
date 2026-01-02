const multer = require('multer');
const path = require('path');

// Set storage engine
const storage = multer.memoryStorage();

// Check file type
const checkFileType = (file, cb) => {
    // Allowed ext
    const filetypes = /xlsx|xls|csv/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/csv'
    ];
    const mimetype = mimetypes.includes(file.mimetype);

    if (mimetype || extname) {
        return cb(null, true);
    } else {
        cb('Error: Excel or CSV Files Only!');
    }
};

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
});

module.exports = upload;
