// services/revenue-reporter.js - VERSI HTML FILE
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { formatCurrencyIDR, getYesterdayDate, getTanggalIndo, getCurrentTimeWIB } = require('../utils/ga4-reports');
const fs = require('fs').promises;
const path = require('path');

class RevenueReporter {
  constructor(analyticsClient, bot) {
    this.analyticsClient = analyticsClient;
    this.bot = bot;
    this.adminChatId = process.env.ADMIN_CHAT_ID;
    this.laporanThreadId = parseInt(process.env.LAPORAN_THREAD_ID || 3);
    this.reportsDir = path.join(__dirname, '../reports');
  }

  /**
   * Buat struktur HTML untuk laporan
   */
  generateHTMLReport(revenueData, detailedData) {
    const tanggal = getTanggalIndo('yesterday');
    const waktu = getCurrentTimeWIB();
    
    // Hitung rata-rata engagement
    let totalEngagement = 0;
    let engagementCount = 0;
    
    if (detailedData?.rows) {
      detailedData.rows.forEach(row => {
        const engagement = parseFloat(row.metricValues[2]?.value) || 0;
        if (engagement > 0) {
          totalEngagement += engagement;
          engagementCount++;
        }
      });
    }
    
    const avgEngagement = engagementCount > 0 ? 
      (totalEngagement / engagementCount).toFixed(2) : '0.00';

    // Buat baris tabel untuk halaman
    let pageRows = '';
    if (detailedData?.rows) {
      detailedData.rows.slice(0, 15).forEach((row, index) => {
        const pagePath = row.dimensionValues[0]?.value || '(not set)';
        const views = parseInt(row.metricValues[0]?.value) || 0;
        const users = parseInt(row.metricValues[1]?.value) || 0;
        const engagement = row.metricValues[2]?.value ? 
                          parseFloat(row.metricValues[2]?.value).toFixed(1) : '0.0';
        const events = parseInt(row.metricValues[3]?.value) || 0;
        const revenue = parseFloat(row.metricValues[4]?.value) || 0;
        
        pageRows += `
          <tr>
            <td>${index + 1}</td>
            <td class="page-path">${pagePath}</td>
            <td class="number">${views.toLocaleString('id-ID')}</td>
            <td class="number">${users.toLocaleString('id-ID')}</td>
            <td class="number">${engagement}s</td>
            <td class="number">${events.toLocaleString('id-ID')}</td>
            <td class="revenue">${formatCurrencyIDR(revenue)}</td>
          </tr>`;
      });
    }

    // HTML template lengkap dengan CSS inline
    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laporan Harian EatSleepPush - ${tanggal}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background-color: #f5f7fa;
            color: #333;
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 5px;
            font-weight: 700;
        }
        
        .header .date {
            font-size: 18px;
            opacity: 0.9;
            margin-bottom: 15px;
        }
        
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 25px 30px;
            background-color: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
            transition: transform 0.2s;
        }
        
        .card:hover {
            transform: translateY(-5px);
        }
        
        .card .value {
            font-size: 32px;
            font-weight: 700;
            margin: 10px 0;
            color: #4a5568;
        }
        
        .card .label {
            font-size: 14px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .card.revenue .value {
            color: #10b981;
        }
        
        .card.users .value {
            color: #3b82f6;
        }
        
        .card.views .value {
            color: #8b5cf6;
        }
        
        .table-container {
            padding: 30px;
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        th {
            background-color: #4f46e5;
            color: white;
            text-align: left;
            padding: 15px;
            font-weight: 600;
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        td {
            padding: 15px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
        }
        
        tr:hover {
            background-color: #f7fafc;
        }
        
        .page-path {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            max-width: 400px;
            word-break: break-all;
        }
        
        .number {
            text-align: right;
            font-family: 'Consolas', 'Monaco', monospace;
            font-weight: 500;
        }
        
        .revenue {
            text-align: right;
            font-weight: 700;
            color: #059669;
        }
        
        .footer {
            background-color: #f8fafc;
            padding: 20px 30px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer .info {
            margin: 5px 0;
        }
        
        @media (max-width: 768px) {
            .container {
                border-radius: 8px;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 22px;
            }
            
            .summary-cards {
                grid-template-columns: repeat(2, 1fr);
                padding: 15px;
            }
            
            .table-container {
                padding: 15px;
            }
            
            th, td {
                padding: 10px;
                font-size: 14px;
            }
        }
        
        @media print {
            body {
                background-color: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                border-radius: 0;
            }
            
            .card:hover {
                transform: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Laporan Harian EatSleepPush</h1>
            <div class="date">${tanggal}</div>
            <div class="time">Dibuat: ${waktu} WIB</div>
        </div>
        
        <div class="summary-cards">
            <div class="card revenue">
                <div class="label">Total Revenue</div>
                <div class="value">${formatCurrencyIDR(revenueData.totalRevenue)}</div>
                <div class="sub-label">Dari ${revenueData.totalClicks.toLocaleString('id-ID')} klik</div>
            </div>
            
            <div class="card users">
                <div class="label">Active Users</div>
                <div class="value">${revenueData.totalUsers.toLocaleString('id-ID')}</div>
                <div class="sub-label">Pengguna aktif</div>
            </div>
            
            <div class="card views">
                <div class="label">Page Views</div>
                <div class="value">${revenueData.totalViews.toLocaleString('id-ID')}</div>
                <div class="sub-label">Total tampilan</div>
            </div>
            
            <div class="card">
                <div class="label">Rata-rata Engagement</div>
                <div class="value">${avgEngagement}s</div>
                <div class="sub-label">Per sesi</div>
            </div>
        </div>
        
        <div class="table-container">
            <h2 style="margin-bottom: 20px; color: #4a5568;">📈 Performa Halaman Teratas</h2>
            
            <table>
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="45%">Halaman Landing</th>
                        <th width="10%">Views</th>
                        <th width="10%">Active User</th>
                        <th width="10%">Avg. Engage</th>
                        <th width="10%">Event Count</th>
                        <th width="10%">Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageRows || '<tr><td colspan="7" style="text-align: center; padding: 40px;">Tidak ada data</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background-color: #f1f5f9; font-weight: 700;">
                        <td colspan="2">TOTAL</td>
                        <td class="number">${revenueData.totalViews.toLocaleString('id-ID')}</td>
                        <td class="number">${revenueData.totalUsers.toLocaleString('id-ID')}</td>
                        <td class="number">${avgEngagement}s</td>
                        <td class="number">${revenueData.totalEvents.toLocaleString('id-ID')}</td>
                        <td class="revenue">${formatCurrencyIDR(revenueData.totalRevenue)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        <div class="footer">
            <div class="info">📅 <b>Periode Laporan:</b> ${getYesterdayDate()} (00:00 - 23:59 WIB)</div>
            <div class="info">🕐 <b>Waktu Pembuatan:</b> ${waktu} WIB</div>
            <div class="info">⚙️ <b>Sumber Data:</b> Google Analytics 4 Property ${process.env.GA4_PROPERTY_ID || ''}</div>
            <div class="info" style="margin-top: 15px;">
                Laporan ini dibuat otomatis oleh EatSleepPush GA4 Bot dan dikirim setiap hari pukul 12:00 WIB.
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Simpan HTML ke file
   */
  async saveHTMLReport(htmlContent) {
    try {
      // Buat folder reports jika belum ada
      await fs.mkdir(this.reportsDir, { recursive: true });
      
      // Generate nama file dengan timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `laporan-${timestamp}.html`;
      const filepath = path.join(this.reportsDir, filename);
      
      // Simpan file
      await fs.writeFile(filepath, htmlContent, 'utf8');
      console.log(`✅ File HTML disimpan: ${filepath}`);
      
      return filepath;
      
    } catch (error) {
      console.error('❌ Gagal menyimpan file HTML:', error.message);
      throw error;
    }
  }

  /**
   * Kirim file HTML ke Telegram
   */
  async sendHTMLReport(filepath) {
    try {
      const tanggal = getTanggalIndo('yesterday');
      const caption = `📊 <b>Laporan Harian EatSleepPush - ${tanggal}</b>\n\n` +
                     `📁 File HTML terlampir untuk analisis lebih detail.\n` +
                     `📅 Data periode: ${getYesterdayDate()}\n` +
                     `🕐 Dikirim: ${getCurrentTimeWIB()} WIB\n\n` +
                     `<i>Buka file di browser untuk tampilan terbaik.</i>`;
      
      // Baca file sebagai stream/buffer
      const fileStream = await fs.readFile(filepath);
      
      // Kirim ke Telegram sebagai document
      await this.bot.sendDocument(this.adminChatId, fileStream, {}, {
        caption: caption,
        parse_mode: 'HTML',
        message_thread_id: this.laporanThreadId
      });
      
      console.log(`✅ File HTML berhasil dikirim ke Telegram`);
      
    } catch (error) {
      console.error('❌ Gagal mengirim file HTML ke Telegram:', error.message);
      throw error;
    }
  }

  /**
   * Buat dan kirim laporan HTML harian
   */
  async sendDailyReport() {
    try {
      console.log(`🕐 ${getCurrentTimeWIB()} - Memulai proses laporan HTML harian...`);
      
      // 1. Ambil data total
      const revenueData = await this.fetchTotalRevenue();
      
      // 2. Ambil data detail per halaman
      const detailedData = await this.fetchDetailedPageData();
      
      // 3. Generate HTML
      const htmlContent = this.generateHTMLReport(revenueData, detailedData);
      
      // 4. Simpan ke file
      const filepath = await this.saveHTMLReport(htmlContent);
      
      // 5. Kirim ke Telegram
      await this.sendHTMLReport(filepath);
      
      // 6. (Opsional) Hapus file lama (misalnya lebih dari 7 hari)
      await this.cleanupOldReports();
      
      console.log(`✅ Laporan HTML harian berhasil diproses dan dikirim.`);
      
    } catch (error) {
      console.error('❌ Gagal mengirim laporan HTML harian:', error.message);
      
      // Kirim pesan error ke admin
      try {
        await this.bot.sendMessage(this.adminChatId, 
          `❌ <b>Gagal mengirim laporan HTML harian</b>\n\n` +
          `<code>${error.message}</code>\n\n` +
          `<i>Cek log server untuk detail lebih lanjut.</i>`, {
          parse_mode: 'HTML',
          message_thread_id: this.laporanThreadId
        });
      } catch (botError) {
        console.error('❌ Gagal mengirim error ke Telegram:', botError.message);
      }
    }
  }

  /**
   * Hapus file laporan lama (opsional)
   */
  async cleanupOldReports(daysToKeep = 7) {
    try {
      const files = await fs.readdir(this.reportsDir);
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        if (file.endsWith('.html')) {
          const filepath = path.join(this.reportsDir, file);
          const stats = await fs.stat(filepath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > daysToKeep * msPerDay) {
            await fs.unlink(filepath);
            console.log(`🗑️  File lama dihapus: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('⚠️  Gagal menghapus file lama:', error.message);
    }
  }

  /**
   * Method lain (fetchTotalRevenue, fetchDetailedPageData) tetap sama seperti sebelumnya
   */
}

module.exports = RevenueReporter;
