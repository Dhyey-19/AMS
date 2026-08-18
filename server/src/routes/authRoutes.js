const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// --- User Account Authentication Routes ---
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', authenticateToken, AuthController.getMe);

// --- Device Registration & 1-Click Activation Routes ---
router.get('/registration-status', AuthController.getRegistrationStatus);
router.post('/request-activation', AuthController.requestActivation);
router.get('/approve-activation', AuthController.approveActivation);
router.post('/register-app', AuthController.registerApp);
router.post('/activate', AuthController.registerApp); // Convenient alias
router.post('/surrender-app', AuthController.surrenderApp);

// --- Admin Device Management Routes ---
router.get('/devices', authenticateToken, AuthController.getAllDevices);
router.put('/devices/:deviceId', authenticateToken, AuthController.updateDevice);
router.post('/devices/:deviceId/revoke', authenticateToken, AuthController.revokeDevice);
router.delete('/devices/:deviceId', authenticateToken, AuthController.deleteDevice);
router.post('/devices/batch-revoke', authenticateToken, AuthController.batchRevokeDevices);
router.post('/devices/batch-delete', authenticateToken, AuthController.batchDeleteDevices);

module.exports = router;
