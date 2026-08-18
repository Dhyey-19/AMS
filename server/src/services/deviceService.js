const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

class DeviceService {
  /**
   * Helper for Guaranteed Unique 10-Digit Device Code
   */
  static generateUnique10DigitCode() {
    const db = getDatabase();
    let isUnique = false;
    let code = '';
    let attempts = 0;
    
    while (!isUnique && attempts < 15) {
      attempts++;
      code = crypto.randomInt(1000000000, 10000000000).toString();
      const check = db.prepare('SELECT 1 FROM device_registrations WHERE random_number = ?').get(code);
      if (!check) {
        isUnique = true;
      }
    }
    return code;
  }

  /**
   * Deterministic Activation Key Calculation
   */
  static calculateActivationKey(randomNumber, appName = 'AMS') {
    const cleanAppName = (appName || 'AMS').toUpperCase().trim();
    const concatenated = (randomNumber + cleanAppName).trim();
    let asciiSum = 0;
    for (let i = 0; i < concatenated.length; i++) {
      asciiSum += concatenated.charCodeAt(i);
    }
    let finalSum = asciiSum * 10252;
    if (finalSum < 0) finalSum *= -1;
    return finalSum.toString();
  }

  /**
   * Build 7-day signed 1-Click approval URL
   */
  static buildApproveUrl(req, randomNumber, deviceId, origin = '') {
    const correctKey = this.calculateActivationKey(randomNumber);
    const approvalToken = jwt.sign(
      { randomNumber, deviceId, key: correctKey },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    const host = (req && req.get && req.get('host')) || 'localhost:5050';
    const protocol = (req && req.protocol) || 'http';
    const baseUrl = origin || (process.env.APP_URL ? process.env.APP_URL : `${protocol}://${host}`);
    return `${baseUrl}/api/auth/approve-activation?token=${encodeURIComponent(approvalToken)}`;
  }

  /**
   * Get or initialize registration status for a device
   */
  static getRegistrationStatus(deviceId, { currentUser = null, ip = '', userAgent = '', deviceName = '', req = null, origin = '' } = {}) {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }

    const db = getDatabase();
    const ua = String(userAgent || '');
    const autoDeviceName = deviceName || (
      ua.includes('iPhone') ? 'iPhone' :
      ua.includes('Android') ? 'Android Device' :
      ua.includes('Windows') ? 'Windows PC' :
      ua.includes('Mac') ? 'Mac' : 'Workstation'
    );

    const record = db.prepare(`
      SELECT device_id, is_registered, random_number, device_name, last_user, last_active_at, ip_address, user_agent, registered_at
      FROM device_registrations
      WHERE device_id = ?
    `).get(deviceId);

    if (record) {
      let isRegistered = record.is_registered === 1;
      let randomNumber = record.random_number;

      if (!isRegistered && !randomNumber) {
        randomNumber = this.generateUnique10DigitCode();
      }

      db.prepare(`
        UPDATE device_registrations
        SET last_active_at = CURRENT_TIMESTAMP,
            last_user = COALESCE(?, last_user),
            device_name = COALESCE(device_name, ?),
            ip_address = ?,
            user_agent = ?,
            random_number = COALESCE(?, random_number)
        WHERE device_id = ?
      `).run(
        currentUser || null,
        autoDeviceName,
        String(ip || ''),
        String(userAgent || '').substring(0, 255),
        randomNumber || null,
        deviceId
      );

      const approveUrl = !isRegistered && randomNumber ? this.buildApproveUrl(req, randomNumber, deviceId, origin) : null;
      return {
        success: true,
        isRegistered,
        randomNumber,
        approveUrl,
        deviceName: record.device_name || autoDeviceName,
        registeredAt: record.registered_at
      };
    } else {
      const randomNumber = this.generateUnique10DigitCode();
      db.prepare(`
        INSERT INTO device_registrations (
          device_id, is_registered, random_number, device_name, last_user, last_active_at, ip_address, user_agent, registered_at
        ) VALUES (?, 0, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        deviceId,
        randomNumber,
        autoDeviceName,
        currentUser || null,
        String(ip || ''),
        String(userAgent || '').substring(0, 255)
      );

      const approveUrl = this.buildApproveUrl(req, randomNumber, deviceId, origin);
      return {
        success: true,
        isRegistered: false,
        randomNumber,
        approveUrl,
        deviceName: autoDeviceName,
        registeredAt: new Date().toISOString()
      };
    }
  }

  /**
   * Request Activation via Email & Generate 1-Click Link
   */
  static async requestActivation({ randomNumber, appName = 'AMS', deviceId, origin, req }) {
    if (!randomNumber) {
      throw new Error('Device verification code (randomNumber) is required');
    }

    const correctKey = this.calculateActivationKey(randomNumber, appName);
    const approveUrl = this.buildApproveUrl(req, randomNumber, deviceId, origin);
    const adminEmail = process.env.ADMIN_EMAIL || 'softechit@gmail.com';
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const appDisplayName = process.env.APP_NAME || 'Global IVF Hospital - AMS';

    // HTML Email Template for Admin
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0f9ff; color: #0f172a; max-width: 620px; margin: 0 auto; border-radius: 16px; overflow: hidden; border: 1px solid #bae6fd; box-shadow: 0 10px 25px rgba(2, 132, 199, 0.08);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
          <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">
            🏥 Global IVF Hospital
          </div>
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">
            Device License Activation Request
          </h1>
          <p style="color: #e0f2fe; font-size: 13px; margin: 8px 0 0 0;">
            Attendance Management System (AMS)
          </p>
        </div>
        
        <!-- Content Body -->
        <div style="padding: 32px 28px; background-color: #ffffff;">
          <p style="font-size: 15px; margin-top: 0; color: #334155; line-height: 1.5;">
            Hello Administrator,
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            A new machine or browser workstation has requested authorization to access the <strong>Global IVF Hospital AMS Portal</strong>.
          </p>
          
          <!-- 1-Click Instant Activation Section -->
          <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 26px 20px; text-align: center; margin: 24px 0;">
            <div style="font-size: 13px; font-weight: 800; color: #166534; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px;">
              ⚡ 1-CLICK INSTANT APPROVAL
            </div>
            <p style="font-size: 13px; color: #15803d; margin: 0 0 18px 0; line-height: 1.4;">
              Click the button below to instantly approve this workstation and automatically unlock the user's screen:
            </p>
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 8px 0;">
              <tr>
                <td align="center">
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" bgcolor="#059669" style="border-radius: 10px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                        <a href="${approveUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: bold; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 32px; border-radius: 10px; border: 1px solid #059669;">
                          ✅ Click to Approve &amp; Activate Device
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="font-size: 11px; color: #64748b; margin: 16px 0 0 0; word-break: break-all; line-height: 1.4;">
              Direct activation link: <a href="${approveUrl}" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: underline;">${approveUrl}</a>
            </p>
          </div>

          <!-- Device Details Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <div>
                <p style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 4px 0; letter-spacing: 0.05em;">
                  DEVICE VERIFICATION CODE
                </p>
                <p style="font-size: 20px; font-weight: 800; font-family: 'Courier New', monospace; color: #0f172a; margin: 0; letter-spacing: 0.1em;">
                  ${randomNumber}
                </p>
              </div>
            </div>
            
            <div style="height: 1px; background-color: #e2e8f0; margin: 14px 0;"></div>
            
            <div>
              <p style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0 0 4px 0; letter-spacing: 0.05em;">
                MANUAL ACTIVATION KEY
              </p>
              <p style="font-size: 22px; font-weight: 800; font-family: 'Courier New', monospace; color: #0284c7; margin: 0 0 4px 0; letter-spacing: 0.05em;">
                ${correctKey}
              </p>
              <p style="font-size: 12px; color: #64748b; margin: 0;">
                (Use this key if the user prefers to enter the code manually)
              </p>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">
            Global IVF Hospital &bull; Attendance Management System &bull; Secure License Gate
          </p>
        </div>
      </div>
    `;

    let emailSent = false;
    if (emailUser && emailPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUser,
            pass: emailPass
          }
        });

        await transporter.sendMail({
          from: emailUser,
          to: adminEmail,
          subject: `[Approve Device] Activation Request | Global IVF AMS | Code: ${randomNumber}`,
          html: htmlBody
        });
        emailSent = true;
      } catch (mailErr) {
        console.warn('⚠️ Could not send activation email via SMTP:', mailErr.message);
      }
    }

    // Always log approval URL in development console for easy 1-click verification
    console.log('\n======================================================');
    console.log('⚡ 1-CLICK ACTIVATION REQUEST INITIATED:');
    console.log(`📱 Device Code: ${randomNumber}`);
    console.log(`🔑 Manual Key : ${correctKey}`);
    console.log(`🔗 1-Click Approve Link: ${approveUrl}`);
    console.log('======================================================\n');

    return {
      success: true,
      message: emailSent
        ? `Activation request sent to Administrator (${adminEmail}).`
        : 'Activation request registered. Administrator can approve via email or 1-Click link.',
      emailSent,
      approveUrl,
      randomNumber
    };
  }

  /**
   * Approve activation via 1-Click Magic Link (HTML Response)
   */
  static approveActivation(token) {
    if (!token) {
      return {
        success: false,
        statusCode: 400,
        html: this.renderActivationPage({
          isSuccess: false,
          title: 'Invalid Request',
          message: 'Missing or invalid activation token.'
        })
      };
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const { randomNumber, deviceId } = decoded;
      const db = getDatabase();

      if (deviceId) {
        db.prepare(`
          UPDATE device_registrations 
          SET is_registered = 1, random_number = NULL 
          WHERE device_id = ?
        `).run(deviceId);
      } else if (randomNumber) {
        db.prepare(`
          UPDATE device_registrations 
          SET is_registered = 1, random_number = NULL 
          WHERE random_number = ?
        `).run(randomNumber);
      } else {
        throw new Error('Invalid token payload');
      }

      return {
        success: true,
        statusCode: 200,
        html: this.renderActivationPage({
          isSuccess: true,
          title: 'Device Successfully Activated!',
          code: randomNumber,
          message: "The workstation has been approved and granted immediate access. The user's screen will automatically unlock and proceed to the application."
        })
      };
    } catch (err) {
      return {
        success: false,
        statusCode: 400,
        html: this.renderActivationPage({
          isSuccess: false,
          title: 'Link Expired or Invalid',
          message: 'This activation link is invalid or has expired (7 days validity). Please submit a new activation request from the device.'
        })
      };
    }
  }

  /**
   * Manual activation using activation key
   */
  static registerApp({ deviceId, activationKey, appName = 'AMS' }) {
    if (!deviceId) throw new Error('Device ID is required');
    if (!activationKey) throw new Error('Activation key is required');

    const db = getDatabase();
    const record = db.prepare('SELECT random_number FROM device_registrations WHERE device_id = ?').get(deviceId);
    if (!record) {
      throw new Error('Device registration record not found. Please refresh.');
    }

    const randomNumber = record.random_number;
    if (!randomNumber) {
      throw new Error('Device already activated or pending verification code missing.');
    }

    const expectedKey = this.calculateActivationKey(randomNumber, appName);
    if (activationKey.trim() !== expectedKey) {
      throw new Error('Invalid activation key. Please verify with the administrator.');
    }

    db.prepare(`
      UPDATE device_registrations 
      SET is_registered = 1, random_number = NULL 
      WHERE device_id = ?
    `).run(deviceId);

    return {
      success: true,
      message: 'Workstation registered and activated successfully.'
    };
  }

  /**
   * Surrender application license / de-authorize device
   */
  static surrenderApp(deviceId) {
    if (!deviceId) throw new Error('Device ID is required');
    const db = getDatabase();
    const randomNumber = this.generateUnique10DigitCode();

    const existing = db.prepare('SELECT device_id FROM device_registrations WHERE device_id = ?').get(deviceId);
    if (existing) {
      db.prepare(`
        UPDATE device_registrations 
        SET is_registered = 0, random_number = ? 
        WHERE device_id = ?
      `).run(randomNumber, deviceId);
    } else {
      db.prepare(`
        INSERT INTO device_registrations (device_id, is_registered, random_number) 
        VALUES (?, 0, ?)
      `).run(deviceId, randomNumber);
    }

    return {
      success: true,
      message: 'Workstation license surrendered successfully.'
    };
  }

  /**
   * Device Management (Admin Panel)
   */
  static getAllDevices() {
    const db = getDatabase();
    const records = db.prepare(`
      SELECT device_id, is_registered, random_number, device_name, last_user, last_active_at, ip_address, user_agent, registered_at
      FROM device_registrations
      ORDER BY last_active_at DESC
    `).all();
    return records;
  }

  static updateDevice(deviceId, { deviceName }) {
    if (!deviceId) throw new Error('Device ID is required');
    const db = getDatabase();
    db.prepare(`
      UPDATE device_registrations
      SET device_name = ?
      WHERE device_id = ?
    `).run(deviceName || 'Workstation', deviceId);

    return { success: true, message: 'Device updated successfully.' };
  }

  static revokeDevice(deviceId) {
    if (!deviceId) throw new Error('Device ID is required');
    const db = getDatabase();
    const randomNumber = this.generateUnique10DigitCode();
    db.prepare(`
      UPDATE device_registrations
      SET is_registered = 0, random_number = ?
      WHERE device_id = ?
    `).run(randomNumber, deviceId);

    return { success: true, message: 'Device authorization revoked.' };
  }

  static deleteDevice(deviceId) {
    if (!deviceId) throw new Error('Device ID is required');
    const db = getDatabase();
    db.prepare('DELETE FROM device_registrations WHERE device_id = ?').run(deviceId);
    return { success: true, message: 'Device deleted successfully.' };
  }

  static batchRevoke(deviceIds) {
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      throw new Error('No devices selected for revocation');
    }
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE device_registrations
      SET is_registered = 0, random_number = ?
      WHERE device_id = ?
    `);

    const updateMany = db.transaction((ids) => {
      for (const id of ids) {
        const code = this.generateUnique10DigitCode();
        stmt.run(code, id);
      }
    });

    updateMany(deviceIds);
    return { success: true, message: `${deviceIds.length} device(s) revoked successfully.` };
  }

  static batchDelete(deviceIds) {
    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      throw new Error('No devices selected for deletion');
    }
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM device_registrations WHERE device_id = ?');

    const deleteMany = db.transaction((ids) => {
      for (const id of ids) {
        stmt.run(id);
      }
    });

    deleteMany(deviceIds);
    return { success: true, message: `${deviceIds.length} device(s) deleted successfully.` };
  }

  /**
   * Render HTML page for 1-Click Email activation feedback
   */
  static renderActivationPage({ isSuccess, title, message, code }) {
    const primaryColor = isSuccess ? '#0284c7' : '#ef4444';
    const iconBg = isSuccess ? '#ecfdf5' : '#fff1f2';
    const iconColor = isSuccess ? '#059669' : '#e11d48';
    const iconSvg = isSuccess ? '✓' : '✕';

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${title} - Global IVF Hospital AMS</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background-color: #0f172a;
              color: #f8fafc;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .card {
              background-color: #1e293b;
              border: 1px solid #334155;
              border-radius: 20px;
              padding: 44px 36px;
              max-width: 480px;
              width: 100%;
              text-align: center;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
              position: relative;
              overflow: hidden;
            }
            .card::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 4px;
              background: ${isSuccess ? 'linear-gradient(90deg, #0284c7, #10b981)' : '#ef4444'};
            }
            .icon-wrapper {
              width: 72px;
              height: 72px;
              background-color: ${iconBg};
              color: ${iconColor};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px auto;
              font-size: 36px;
              font-weight: 800;
              box-shadow: 0 0 20px rgba(${isSuccess ? '16, 185, 129' : '239, 68, 68'}, 0.2);
            }
            .brand-badge {
              display: inline-block;
              background: rgba(2, 132, 199, 0.15);
              color: #38bdf8;
              padding: 4px 14px;
              border-radius: 999px;
              font-weight: 700;
              font-size: 12px;
              letter-spacing: 0.05em;
              text-transform: uppercase;
              margin-bottom: 16px;
              border: 1px solid rgba(56, 189, 248, 0.2);
            }
            h1 {
              margin: 0 0 12px 0;
              font-size: 24px;
              font-weight: 800;
              color: #ffffff;
              letter-spacing: -0.02em;
            }
            p {
              color: #94a3b8;
              font-size: 14.5px;
              line-height: 1.6;
              margin: 0 0 24px 0;
            }
            .code-badge {
              background: #0f172a;
              border: 1px dashed #0284c7;
              color: #38bdf8;
              padding: 10px 16px;
              border-radius: 8px;
              font-family: 'Courier New', monospace;
              font-size: 16px;
              font-weight: 700;
              letter-spacing: 0.1em;
              margin-bottom: 20px;
              display: inline-block;
            }
            .close-tip {
              font-size: 13px;
              color: #64748b;
              border-top: 1px solid #334155;
              padding-top: 18px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-wrapper">${iconSvg}</div>
            <div class="brand-badge">Global IVF Hospital &bull; License System</div>
            <h1>${title}</h1>
            ${code ? `<div class="code-badge">Device Code: ${code}</div>` : ''}
            <p>${message}</p>
            <div class="close-tip">You can safely close this browser window.</div>
          </div>
        </body>
      </html>
    `;
  }
}

module.exports = DeviceService;
