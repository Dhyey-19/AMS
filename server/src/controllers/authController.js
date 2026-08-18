const AuthService = require('../services/authService');
const DeviceService = require('../services/deviceService');

class AuthController {
  // --- User Account Authentication ---
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

  // --- Device Registration & 1-Click Activation ---

  /**
   * Check or initialize device registration status
   */
  static async getRegistrationStatus(req, res) {
    try {
      const deviceId = req.query.deviceId || req.headers['x-device-id'];
      const currentUser = req.query.user || req.headers['x-user'] || null;
      const deviceName = req.query.deviceName || null;
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';
      const origin = req.headers['origin'] || req.headers['referer'] || '';

      const status = DeviceService.getRegistrationStatus(deviceId, {
        currentUser,
        ip,
        userAgent,
        deviceName,
        req,
        origin
      });

      return res.status(200).json(status);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Request Activation from Administrator (sends 1-Click approval email)
   */
  static async requestActivation(req, res) {
    try {
      const { randomNumber, appName, deviceId, origin } = req.body;
      const result = await DeviceService.requestActivation({
        randomNumber,
        appName,
        deviceId,
        origin: origin || req.headers['origin'] || '',
        req
      });

      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * 1-Click Magic Link Approval Endpoint
   */
  static async approveActivation(req, res) {
    try {
      const { token } = req.query;
      const result = DeviceService.approveActivation(token);
      res.status(result.statusCode).send(result.html);
    } catch (err) {
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh;">
            <div style="background: #1e293b; padding: 32px; border-radius: 12px; text-align: center;">
              <h2>Server Error</h2>
              <p>${err.message}</p>
            </div>
          </body>
        </html>
      `);
    }
  }

  /**
   * Manual Device Activation with Key
   */
  static async registerApp(req, res) {
    try {
      const { deviceId, activationKey, appName } = req.body;
      const result = DeviceService.registerApp({ deviceId, activationKey, appName });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  /**
   * Surrender application license on device
   */
  static async surrenderApp(req, res) {
    try {
      const deviceId = req.body.deviceId || req.query.deviceId || req.headers['x-device-id'];
      const result = DeviceService.surrenderApp(deviceId);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  // --- Administrator Device Management Endpoints ---

  static async getAllDevices(req, res) {
    try {
      const devices = DeviceService.getAllDevices();
      return res.status(200).json({
        success: true,
        data: devices
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  static async updateDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const { deviceName } = req.body;
      const result = DeviceService.updateDevice(deviceId, { deviceName });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  static async revokeDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const result = DeviceService.revokeDevice(deviceId);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  static async deleteDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const result = DeviceService.deleteDevice(deviceId);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  static async batchRevokeDevices(req, res) {
    try {
      const { deviceIds } = req.body;
      const result = DeviceService.batchRevoke(deviceIds);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  static async batchDeleteDevices(req, res) {
    try {
      const { deviceIds } = req.body;
      const result = DeviceService.batchDelete(deviceIds);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }
}

module.exports = AuthController;
