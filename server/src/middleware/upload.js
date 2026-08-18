const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create temp uploads directory if not exists
const uploadDir = process.env.UPLOAD_DIR || (
  fs.existsSync(path.resolve(process.cwd(), 'uploads'))
    ? path.resolve(process.cwd(), 'uploads')
    : path.resolve(__dirname, '../../uploads')
);
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {}
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext) || file.mimetype === 'text/csv' || file.mimetype.includes('spreadsheet')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV and Excel (.xlsx, .xls) files are supported.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB limit
  }
});

module.exports = upload;
