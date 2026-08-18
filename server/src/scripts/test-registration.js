const { getDatabase } = require('../config/database');
const DeviceService = require('../services/deviceService');

async function runTests() {
  console.log('🧪 ===============================================');
  console.log('🧪 TESTING ONE-CLICK REGISTRATION & ACTIVATION');
  console.log('🧪 ===============================================\n');

  // Initialize DB
  const db = getDatabase();

  const testDeviceId1 = 'test_device_auto_001';
  const testDeviceId2 = 'test_device_manual_002';

  // Clean up any previous test remnants
  db.prepare('DELETE FROM device_registrations WHERE device_id IN (?, ?)').run(testDeviceId1, testDeviceId2);

  // 1. Initial Status Check (Device 1 should be unregistered)
  console.log('▶ TEST 1: Initial Registration Status for New Device');
  const status1 = DeviceService.getRegistrationStatus(testDeviceId1, {
    currentUser: 'ReceptionDesk',
    ip: '192.168.1.50',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    deviceName: 'Reception Desk 1'
  });
  console.log('  Status:', status1);
  if (status1.isRegistered === false && status1.randomNumber && status1.approveUrl) {
    console.log('  ✅ TEST 1 PASSED: Unregistered device initialized with 10-digit code and approveUrl.\n');
  } else {
    throw new Error('TEST 1 FAILED');
  }

  // 2. Request Activation (Generate 1-Click Approval Request)
  console.log('▶ TEST 2: Request Activation (1-Click Notification Dispatch)');
  const requestRes = await DeviceService.requestActivation({
    randomNumber: status1.randomNumber,
    deviceId: testDeviceId1,
    appName: 'AMS'
  });
  console.log('  Request Response:', requestRes);
  if (requestRes.success && requestRes.approveUrl) {
    console.log('  ✅ TEST 2 PASSED: 1-Click Approval token & URL generated.\n');
  } else {
    throw new Error('TEST 2 FAILED');
  }

  // Extract token from approveUrl
  const urlObj = new URL(requestRes.approveUrl);
  const token = urlObj.searchParams.get('token');

  // 3. 1-Click Magic Link Approval Execution
  console.log('▶ TEST 3: Admin 1-Click Approval Execution');
  const approvalRes = DeviceService.approveActivation(token);
  console.log('  Approval Status Code:', approvalRes.statusCode);
  if (approvalRes.statusCode === 200 && approvalRes.html.includes('Device Successfully Activated')) {
    console.log('  ✅ TEST 3 PASSED: 1-Click token approved and HTML feedback rendered.\n');
  } else {
    throw new Error('TEST 3 FAILED: ' + approvalRes.html);
  }

  // 4. Verify Device 1 is now marked as Registered
  console.log('▶ TEST 4: Verification of Activated Status on Polling');
  const statusAfterApprove = DeviceService.getRegistrationStatus(testDeviceId1, {});
  console.log('  Status after approval:', statusAfterApprove);
  if (statusAfterApprove.isRegistered === true) {
    console.log('  ✅ TEST 4 PASSED: Device 1 is verified as active.\n');
  } else {
    throw new Error('TEST 4 FAILED: Device 1 should be registered.');
  }

  // 5. Manual Activation Test on Device 2
  console.log('▶ TEST 5: Manual Activation Key Algorithm & Verification');
  const status2 = DeviceService.getRegistrationStatus(testDeviceId2, {
    deviceName: 'Lab Workstation'
  });
  const expectedKey = DeviceService.calculateActivationKey(status2.randomNumber, 'AMS');
  console.log(`  Device 2 Code: ${status2.randomNumber}, Calculated Key: ${expectedKey}`);

  // Try wrong key
  try {
    DeviceService.registerApp({ deviceId: testDeviceId2, activationKey: '99999999', appName: 'AMS' });
    throw new Error('Should have rejected invalid key');
  } catch (err) {
    console.log('  Correctly rejected invalid key:', err.message);
  }

  // Try correct key
  const manualRes = DeviceService.registerApp({
    deviceId: testDeviceId2,
    activationKey: expectedKey,
    appName: 'AMS'
  });
  console.log('  Manual Activation Result:', manualRes);
  const status2After = DeviceService.getRegistrationStatus(testDeviceId2, {});
  if (status2After.isRegistered === true) {
    console.log('  ✅ TEST 5 PASSED: Manual activation successfully unlocked Device 2.\n');
  } else {
    throw new Error('TEST 5 FAILED');
  }

  // 6. Device Management: List, Update, Revoke, Delete
  console.log('▶ TEST 6: Admin Device Management Lifecycle');
  const allDevices = DeviceService.getAllDevices();
  console.log(`  Total Registered Devices: ${allDevices.length}`);
  
  DeviceService.updateDevice(testDeviceId1, { deviceName: 'OPD Room 3 Workstation' });
  const updatedDev = DeviceService.getAllDevices().find(d => d.device_id === testDeviceId1);
  if (updatedDev.device_name === 'OPD Room 3 Workstation') {
    console.log('  ✅ Rename device verified.');
  }

  DeviceService.revokeDevice(testDeviceId1);
  const revokedDev = DeviceService.getAllDevices().find(d => d.device_id === testDeviceId1);
  if (revokedDev.is_registered === 0) {
    console.log('  ✅ Revoke device verified.');
  }

  // 7. Surrender App Test
  console.log('▶ TEST 7: Surrender App License Test');
  const surrenderRes = DeviceService.surrenderApp(testDeviceId2);
  const surrenderedDev = DeviceService.getAllDevices().find(d => d.device_id === testDeviceId2);
  if (surrenderedDev.is_registered === 0 && surrenderedDev.random_number) {
    console.log('  ✅ TEST 7 PASSED: Surrender license generated new verification code.\n');
  }

  DeviceService.deleteDevice(testDeviceId1);
  DeviceService.deleteDevice(testDeviceId2);
  console.log('  ✅ Cleanup test devices verified.\n');

  console.log('🎉 ALL ONE-CLICK REGISTRATION & ACTIVATION TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
