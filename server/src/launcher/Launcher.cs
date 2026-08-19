using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace GlobalIVFAMS
{
    static class Program
    {
        private static Mutex mutex = null;
        private const string MutexName = "Global_IVF_AMS_SingleInstance_Mutex_2026";
        private const string AppTitle = "Global IVF Hospital - AMS";
        private const string ServerUrl = "http://localhost:5050";

        [STAThread]
        static void Main()
        {
            bool createdNew;
            mutex = new Mutex(true, MutexName, out createdNew);

            if (!createdNew)
            {
                // Already running, just open the browser and exit
                OpenBrowser(ServerUrl);
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            Application.Run(new AMSApplicationContext());
        }

        public class AMSApplicationContext : ApplicationContext
        {
            private Process serverProcess = null;
            private NotifyIcon trayIcon = null;
            private StreamWriter logWriter = null;

            public AMSApplicationContext()
            {
                InitializeTray();
                StartServer();
            }

            private void InitializeTray()
            {
                ContextMenuStrip menu = new ContextMenuStrip();

                ToolStripMenuItem openItem = new ToolStripMenuItem("🌐 Open AMS (Web App)", null, (s, e) => OpenBrowser(ServerUrl));
                openItem.Font = new Font(openItem.Font, FontStyle.Bold);
                menu.Items.Add(openItem);

                menu.Items.Add(new ToolStripSeparator());

                ToolStripMenuItem restartItem = new ToolStripMenuItem("🔄 Restart Server", null, (s, e) => RestartServer());
                menu.Items.Add(restartItem);

                ToolStripMenuItem viewLogsItem = new ToolStripMenuItem("📄 View Server Logs", null, (s, e) => OpenLogs());
                menu.Items.Add(viewLogsItem);

                menu.Items.Add(new ToolStripSeparator());

                ToolStripMenuItem exitItem = new ToolStripMenuItem("❌ Stop & Exit", null, (s, e) => ExitApp());
                menu.Items.Add(exitItem);

                Icon appIcon = SystemIcons.Application;
                try
                {
                    Icon extracted = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                    if (extracted != null) appIcon = extracted;
                }
                catch { }

                trayIcon = new NotifyIcon()
                {
                    Icon = appIcon,
                    ContextMenuStrip = menu,
                    Text = AppTitle,
                    Visible = true
                };

                trayIcon.DoubleClick += (s, e) => OpenBrowser(ServerUrl);

                trayIcon.ShowBalloonTip(3000, AppTitle, "AMS is running in the background at " + ServerUrl, ToolTipIcon.Info);
            }

            private void StartServer()
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string bundlePath = Path.Combine(baseDir, "server.bundle.js");

                if (!File.Exists(bundlePath))
                {
                    MessageBox.Show("Could not find 'server.bundle.js' in the application directory:\n\n" + baseDir,
                        "Global IVF AMS - Missing File", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    ExitApp();
                    return;
                }

                string nodeExe = ResolveNodeExecutable();
                if (string.IsNullOrEmpty(nodeExe))
                {
                    DialogResult result = MessageBox.Show(
                        "Node.js runtime was not found embedded or installed on this system.\n\n" +
                        "Would you like to open the official Node.js download page?",
                        "Node.js Required - Global IVF AMS",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Warning);

                    if (result == DialogResult.Yes)
                    {
                        OpenBrowser("https://nodejs.org/");
                    }
                    ExitApp();
                    return;
                }

                // Terminate any previous lingering processes on port 5050
                KillProcessOnPort(5050);

                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = nodeExe,
                        Arguments = "server.bundle.js",
                        WorkingDirectory = baseDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    };
                    psi.EnvironmentVariables["NODE_ENV"] = "production";

                    serverProcess = new Process();
                    serverProcess.StartInfo = psi;
                    serverProcess.EnableRaisingEvents = true;

                    string logPath = Path.Combine(baseDir, "ams_server.log");
                    logWriter = new StreamWriter(logPath, false);
                    logWriter.AutoFlush = true;

                    serverProcess.OutputDataReceived += (s, e) => { if (e.Data != null) logWriter.WriteLine(e.Data); };
                    serverProcess.ErrorDataReceived += (s, e) => { if (e.Data != null) logWriter.WriteLine("[ERROR] " + e.Data); };

                    serverProcess.Start();
                    serverProcess.BeginOutputReadLine();
                    serverProcess.BeginErrorReadLine();

                    // Wait for server to boot, then open browser
                    ThreadPool.QueueUserWorkItem(_ =>
                    {
                        Thread.Sleep(1500);
                        OpenBrowser(ServerUrl);
                    });
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Failed to launch AMS Server:\n" + ex.Message, "AMS Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }

            private void RestartServer()
            {
                StopServerProcess();
                Thread.Sleep(500);
                StartServer();
                if (trayIcon != null)
                {
                    trayIcon.ShowBalloonTip(2000, AppTitle, "AMS Server restarted.", ToolTipIcon.Info);
                }
            }

            private void OpenLogs()
            {
                string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ams_server.log");
                if (File.Exists(logPath))
                {
                    Process.Start(new ProcessStartInfo("notepad.exe", logPath));
                }
                else
                {
                    MessageBox.Show("Log file is empty or not created yet.", "AMS Logs", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }

            private void ExitApp()
            {
                StopServerProcess();
                if (trayIcon != null)
                {
                    trayIcon.Visible = false;
                    trayIcon.Dispose();
                }
                Application.Exit();
            }

            private void StopServerProcess()
            {
                try
                {
                    if (serverProcess != null && !serverProcess.HasExited)
                    {
                        serverProcess.Kill();
                        serverProcess.WaitForExit(2000);
                    }
                }
                catch { }

                try
                {
                    if (logWriter != null)
                    {
                        logWriter.Close();
                        logWriter = null;
                    }
                }
                catch { }

                KillProcessOnPort(5050);
            }
        }

        private static string ResolveNodeExecutable()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;

            // 1. Check embedded bin/node.exe
            string embeddedBinNode = Path.Combine(baseDir, "bin", "node.exe");
            if (File.Exists(embeddedBinNode)) return embeddedBinNode;

            // 2. Check local node.exe alongside the exe
            string localNode = Path.Combine(baseDir, "node.exe");
            if (File.Exists(localNode)) return localNode;

            // 3. Fallback to system-installed node.exe
            if (IsSystemNodeInstalled()) return "node.exe";

            return null;
        }

        private static bool IsSystemNodeInstalled()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "node.exe",
                    Arguments = "-v",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true
                };
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(3000);
                    return p.ExitCode == 0;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void KillProcessOnPort(int port)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = string.Format("/c for /f \"tokens=5\" %a in ('netstat -aon ^| findstr \":{0}\" ^| findstr \"LISTENING\"') do taskkill /F /PID %a", port),
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(3000);
                }
            }
            catch { }
        }

        private static void OpenBrowser(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
            catch
            {
                try
                {
                    Process.Start("cmd.exe", "/c start " + url);
                }
                catch { }
            }
        }
    }
}
