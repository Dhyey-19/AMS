const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Resolve safe, writable temporary upload directory
function getUploadDir() {
  const customDir = process.env.UPLOADS_DIR || process.env.UPLOAD_DIR || process.env.TEMP_UPLOAD_DIR;
  if (customDir) {
    try {
      if (!fs.existsSync(customDir)) {
        fs.mkdirSync(customDir, { recursive: true });
      }
      return customDir;
    } catch (e) {
      console.warn('Failed to create custom upload dir, falling back to temp:', e.message);
    }
  }

  // If in packaged Electron or production, use system temp directory
  const isPackagedApp = Boolean(process.versions.electron || process.env.IS_ELECTRON || process.pkg);
  if (isPackagedApp) {
    const tempDir = path.join(os.tmpdir(), 'global-ivf-ams', 'uploads');
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      return tempDir;
    } catch (e) {
      return os.tmpdir();
    }
  }

  // In local development
  const localDir = path.resolve(process.cwd(), 'uploads');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return localDir;
  } catch (e) {
    return os.tmpdir();
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = getUploadDir();
    cb(null, dir);
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
    fileSize: 50 * 1024 * 1024 // 50 MB limit
  }
});

module.exports = upload;
