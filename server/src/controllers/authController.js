const AuthService = require('../services/authService');

class AuthController {
  static async register(req, res) {
    try {
      const { username, password, fullName, email, role } = req.body;
      const result = await AuthService.register({ username, password, fullName, email, role });
      return res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        data: result
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  static async login(req, res) {
    try {
      const { username, password } = req.body;
      const result = await AuthService.login({ username, password });
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err.message
      });
    }
  }

  static async getMe(req, res) {
    try {
      const user = await AuthService.getProfile(req.user.id);
      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
  }
}

module.exports = AuthController;
