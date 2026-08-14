const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public auth routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Protected route
router.get('/me', authenticateToken, AuthController.getMe);

module.exports = router;
