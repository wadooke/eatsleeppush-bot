// services/revenue-reporter.js - VERSI LENGKAP DIPERBAIKI
const fs = require('fs').promises;
const path = require('path');

class RevenueReporter {
  constructor(analyticsClient, bot) {
    this.analyticsClient = analyticsClient;
    this.bot = bot;
    this.adminChatId = process.env.ADMIN_CHAT_ID;
    this.laporanThreadId = parseInt(process.env.LAPORAN_THREAD_ID || 3);
    this.reportsDir = path.join(__dirname, '../reports');
    
    // Load utility functions
    this.utils = this.loadUtils();
  }

  /**
   * Load utility functions
   */
  loadUtils() {
    // Define utility functions inline since file might not exist
    return {
      formatCurrencyIDR: (amount) => {
        if (typeof amount !== 'number') {
          amount = parseFloat(amount) || 0;
        }
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(amount);
      },
      
      getYesterdayDate: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
      
      getTanggalIndo: (type = 'today') => {
        const date = new Date();
        if (type === 'yesterday') {
          date.setDate(date.getDate() - 1);
        }
        return date.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Jakarta'
        });
      },
      
      getCurrentTimeWIB: () => {
        return new Date().toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).replace(/\./g, ':');
      },
      
      getReportDateRange: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        return {
          startDate: `${year}-${month}-${day}`,
          endDate: `${year}-${month}-${day}`,
          formatted: yesterday.toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        };
      }
    };
  }

  /**
   * Fetch total revenue data untuk kemarin
   */
  async fetchTotalRevenue() {
    try {
      const { startDate, endDate } = this.utils.getReportDateRange();
      console.log(`📊 Fetching revenue data for: ${startDate} to ${endDate}`);
      
      const [response] = await this.analyticsClient.runReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [],
        metrics: [
          { name: 'totalRevenue' },
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'eventCount' },
          { name: 'userEngagementDuration' },
          { name: 'transactions' },
          { name: 'purchaseRevenue' }
        ],
        keepEmptyRows: false
      });
      
      // Process response
      let totalRevenue = 0;
      let totalUsers = 0;
      let totalViews = 0;
      let totalEvents = 0;
      let engagementDuration = 0;
      let totalTransactions = 0;
      let purchaseRevenue = 0;
      
      if (response && response.rows && response.rows.length > 0) {
        const row = response.rows[0];
        const metrics = row.metricValues;
        
        totalRevenue = parseFloat(metrics[0]?.value) || 0;
        totalUsers = parseInt(metrics[1]?.value) || 0;
        totalViews = parseInt(metrics[2]?.value) || 0;
        totalEvents = parseInt(metrics[3]?.value) || 0;
        engagementDuration = parseFloat(metrics[4]?.value) || 0;
        totalTransactions = parseInt(metrics[5]?.value) || 0;
        purchaseRevenue = parseFloat(metrics[6]?.value) || 0;
      }
      
      return {
        totalRevenue,
        totalUsers,
        totalViews,
        totalEvents,
        engagementDuration,
        totalTransactions,
        purchaseRevenue,
        startDate,
        endDate
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch total revenue:', error.message);
      throw error;
    }
  }

  /**
   * Fetch detailed page data untuk kemarin
   */
  async fetchDetailedPageData() {
    try {
      const { startDate, endDate } = this.utils.getReportDateRange();
      
      const [response] = await this.analyticsClient.runReport({
        property: `properties/${process.env.GA4_PROPERTY_ID}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'averageSessionDuration' },
          { name: 'eventCount' },
          { name: 'totalRevenue' }
        ],
        orderBys: [{ metric: { metricName: 'totalRevenue' }, desc: true }],
        limit: 15,
        keepEmptyRows: false
      });
      
      return response;
      
    } catch (error) {
      console.error('❌ Failed to fetch detailed page data:', error.message);
      // Return empty structure instead of throwing
      return { rows: [] };
    }
  }

  /**
   * Buat struktur HTML untuk laporan
   */
  generateHTMLReport(revenueData, detailedData) {
    const tanggal = this.utils.getTanggalIndo('yesterday');
    const waktu = this.utils.getCurrentTimeWIB();
    
    // Hitung rata-rata engagement dari data detail
    let totalEngagement = 0;
    let engagementCount = 0;
    let pageRows = '';
    let totalViews = 0;
    let totalUsers = 0;
    let totalEvents = 0;
    let totalRevenue = 0;
    
    if (detailedData?.rows && detailedData.rows.length > 0) {
      detailedData.rows.forEach((row, index) => {
        const pagePath = row.dimensionValues[0]?.value || '(not set)';
        const views = parseInt(row.metricValues[0]?.value) || 0;
        const users = parseInt(row.metricValues[1]?.value) || 0;
        const engagement = row.metricValues[2]?.value ? 
                          parseFloat(row.metricValues[2]?.value) : 0;
        const events = parseInt(row.metricValues[3]?.value) || 0;
        const revenue = parseFloat(row.metricValues[4]?.value) || 0;
        
        // Accumulate totals
        totalViews += views;
        totalUsers += users;
        totalEngagement += engagement;
        totalEvents += events;
        totalRevenue += revenue;
        if (engagement > 0) engagementCount++;
        
        // Shorten long page paths
        const displayPath = pagePath.length > 50 ? 
          pagePath.substring(0, 47) + '...' : pagePath;
        
        pageRows += `
          <tr>
            <td>${index + 1}</td>
            <td class="page-path" title="${pagePath}">${displayPath}</td>
            <td class="number">${views.toLocaleString('id-ID')}</td>
            <td class="number">${users.toLocaleString('id-ID')}</td>
            <td class="number">${engagement.toFixed(1)}s</td>
            <td class="number">${events.toLocaleString('id-ID')}</td>
            <td class="revenue">${this.utils.formatCurrencyIDR(revenue)}</td>
          </tr>`;
      });
      
      // Update revenueData dengan totals dari detail (lebih akurat)
      revenueData.totalViews = totalViews || revenueData.totalViews;
      revenueData.totalUsers = totalUsers || revenueData.totalUsers;
      revenueData.totalEvents = totalEvents || revenueData.totalEvents;
      revenueData.totalRevenue = totalRevenue || revenueData.totalRevenue;
    } else {
      pageRows = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #666;">Tidak ada data halaman untuk periode ini</td></tr>';
    }
    
    const avgEngagement = engagementCount > 0 ? 
      (totalEngagement / engagementCount).toFixed(1) : '0.0';
    
    // Estimate clicks (30% of events)
    const estimatedClicks = Math.floor((totalEvents || revenueData.totalEvents) * 0.3);

    // HTML template lengkap dengan CSS inline
    return `<!DOCTYPE html>
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
            cursor: help;
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
                <div class="value">${this.utils.formatCurrencyIDR(revenueData.totalRevenue)}</div>
                <div class="sub-label">Dari ${estimatedClicks.toLocaleString('id-ID')} klik estimasi</div>
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
                    ${pageRows}
                </tbody>
                <tfoot>
                    <tr style="background-color: #f1f5f9; font-weight: 700;">
                        <td colspan="2">TOTAL</td>
                        <td class="number">${revenueData.totalViews.toLocaleString('id-ID')}</td>
                        <td class="number">${revenueData.totalUsers.toLocaleString('id-ID')}</td>
                        <td class="number">${avgEngagement}s</td>
                        <td class="number">${revenueData.totalEvents.toLocaleString('id-ID')}</td>
                        <td class="revenue">${this.utils.formatCurrencyIDR(revenueData.totalRevenue)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; font-size: 14px;">
                <strong>📝 Catatan:</strong>
                <ul style="margin-top: 10px; padding-left: 20px;">
                    <li>Data berdasarkan periode: ${revenueData.startDate} (00:00 - 23:59 WIB)</li>
                    <li>Revenue dihitung dari semua konversi dan transaksi</li>
                    <li>Klik diestimasi dari 30% total events</li>
                    <li>Laporan dibuat otomatis setiap hari jam 12:00 WIB</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <div class="info">📅 <b>Periode Laporan:</b> ${revenueData.startDate} (00:00 - 23:59 WIB)</div>
            <div class="info">🕐 <b>Waktu Pembuatan:</b> ${waktu} WIB</div>
            <div class="info">⚙️ <b>Sumber Data:</b> Google Analytics 4 Property ${process.env.GA4_PROPERTY_ID || ''}</div>
            <div class="info" style="margin-top: 15px; font-style: italic;">
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
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `laporan-${timestamp}.html`;
      const filepath = path.join(this.reportsDir, filename);
      
      // Simpan file
      await fs.writeFile(filepath, htmlContent, 'utf8');
      console.log(`✅ File HTML disimpan: ${filepath}`);
      
      return {
        filename,
        filepath,
        url: `/reports/${filename}`
      };
      
    } catch (error) {
      console.error('❌ Gagal menyimpan file HTML:', error.message);
      throw error;
    }
  }

  /**
   * Kirim file HTML ke Telegram
   */
  async sendHTMLReport(fileInfo) {
    try {
      const tanggal = this.utils.getTanggalIndo('yesterday');
      const caption = `📊 <b>Laporan Harian EatSleepPush - ${tanggal}</b>\n\n` +
                     `📁 File HTML terlampir untuk analisis detail.\n` +
                     `📅 Periode: ${this.utils.getYesterdayDate()}\n` +
                     `👥 Users: ${this.utils.getCurrentTimeWIB()} WIB\n\n` +
                     `<i>Buka file di browser untuk tampilan terbaik.</i>`;
      
      // Baca file sebagai buffer
      const fileBuffer = await fs.readFile(fileInfo.filepath);
      
      // Kirim ke Telegram sebagai document
      // Periksa tipe bot terlebih dahulu
      const isTelegraf = typeof this.bot.telegram?.sendDocument === 'function';
      const isNodeTelegramBotApi = typeof this.bot.sendDocument === 'function';
      
      if (isTelegraf) {
        await this.bot.telegram.sendDocument(
          this.adminChatId,
          { source: fileBuffer, filename: fileInfo.filename },
          {
            caption: caption,
            parse_mode: 'HTML',
            message_thread_id: this.laporanThreadId
          }
        );
      } else if (isNodeTelegramBotApi) {
        await this.bot.sendDocument(
          this.adminChatId,
          fileBuffer,
          {},
          {
            caption: caption,
            parse_mode: 'HTML'
          }
        );
      } else {
        // Fallback: kirim pesan saja
        await this.bot.sendMessage(
          this.adminChatId,
          `${caption}\n\n📄 File: ${fileInfo.filename}\n🔗 URL: ${fileInfo.url}`,
          { parse_mode: 'HTML' }
        );
      }
      
      console.log(`✅ File HTML berhasil dikirim ke Telegram: ${fileInfo.filename}`);
      return true;
      
    } catch (error) {
      console.error('❌ Gagal mengirim file HTML ke Telegram:', error.message);
      // Coba kirim pesan error
      try {
        await this.bot.sendMessage(
          this.adminChatId,
          `❌ Gagal mengirim laporan HTML: ${error.message}`,
          { parse_mode: 'HTML' }
        );
      } catch (botError) {
        console.error('⚠️  Gagal mengirim notifikasi error:', botError.message);
      }
      throw error;
    }
  }

  /**
   * Buat dan kirim laporan HTML harian
   */
  async sendDailyReport() {
    console.log(`🕐 ${this.utils.getCurrentTimeWIB()} - Memulai proses laporan HTML harian...`);
    
    try {
      // 1. Ambil data total
      console.log('📊 Mengambil data revenue total...');
      const revenueData = await this.fetchTotalRevenue();
      console.log(`   ✅ Data revenue berhasil diambil:`);
      console.log(`      • Revenue: ${this.utils.formatCurrencyIDR(revenueData.totalRevenue)}`);
      console.log(`      • Users: ${revenueData.totalUsers}`);
      console.log(`      • Views: ${revenueData.totalViews}`);
      
      // 2. Ambil data detail per halaman
      console.log('📊 Mengambil data detail halaman...');
      const detailedData = await this.fetchDetailedPageData();
      console.log(`   ✅ Data detail berhasil diambil (${detailedData?.rows?.length || 0} halaman)`);
      
      // 3. Generate HTML
      console.log('🛠️  Membuat laporan HTML...');
      const htmlContent = this.generateHTMLReport(revenueData, detailedData);
      
      // 4. Simpan ke file
      console.log('💾 Menyimpan file HTML...');
      const fileInfo = await this.saveHTMLReport(htmlContent);
      
      // 5. Kirim ke Telegram
      console.log('📤 Mengirim ke Telegram...');
      await this.sendHTMLReport(fileInfo);
      
      // 6. Kirim pesan konfirmasi
      const successMessage = `✅ <b>Laporan Harian Berhasil Dikirim</b>\n\n` +
                            `📅 <b>Periode:</b> ${revenueData.startDate}\n` +
                            `💰 <b>Total Revenue:</b> ${this.utils.formatCurrencyIDR(revenueData.totalRevenue)}\n` +
                            `👥 <b>Active Users:</b> ${revenueData.totalUsers.toLocaleString('id-ID')}\n` +
                            `📈 <b>Page Views:</b> ${revenueData.totalViews.toLocaleString('id-ID')}\n\n` +
                            `📁 <b>File:</b> ${fileInfo.filename}\n` +
                            `🕐 <b>Waktu:</b> ${this.utils.getCurrentTimeWIB()} WIB`;
      
      await this.bot.sendMessage(this.adminChatId, successMessage, {
        parse_mode: 'HTML',
        message_thread_id: this.laporanThreadId
      });
      
      console.log(`✅ Laporan HTML harian berhasil diproses dan dikirim.`);
      
      // 7. (Opsional) Hapus file lama
      await this.cleanupOldReports();
      
      return {
        success: true,
        revenueData,
        fileInfo,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Gagal mengirim laporan HTML harian:', error.message);
      
      // Kirim pesan error ke admin
      const errorMessage = `❌ <b>Gagal Mengirim Laporan Harian</b>\n\n` +
                          `<code>${error.message}</code>\n\n` +
                          `<i>Waktu: ${this.utils.getCurrentTimeWIB()} WIB</i>\n` +
                          `<i>Cek log server untuk detail lebih lanjut.</i>`;
      
      try {
        await this.bot.sendMessage(this.adminChatId, errorMessage, {
          parse_mode: 'HTML',
          message_thread_id: this.laporanThreadId
        });
      } catch (botError) {
        console.error('❌ Gagal mengirim error ke Telegram:', botError.message);
      }
      
      throw error;
    }
  }

  /**
   * Hapus file laporan lama (lebih dari 7 hari)
   */
  async cleanupOldReports(daysToKeep = 7) {
    try {
      const files = await fs.readdir(this.reportsDir);
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.html')) {
          const filepath = path.join(this.reportsDir, file);
          const stats = await fs.stat(filepath);
          const fileAge = now - stats.mtime.getTime();
          
          if (fileAge > daysToKeep * msPerDay) {
            await fs.unlink(filepath);
            deletedCount++;
            console.log(`🗑️  File lama dihapus: ${file}`);
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(`📊 Cleaned ${deletedCount} old report files`);
      }
      
    } catch (error) {
      console.error('⚠️  Gagal menghapus file lama:', error.message);
    }
  }
}

module.exports = RevenueReporter;
