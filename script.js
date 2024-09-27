const axios = require('axios');
const fs = require('fs');
const ProgressBar = require('progress');
const path = require('path');

// MB cinsinden boyutları formatlamak için yardımcı fonksiyon
function formatBytes(bytes) {
  if (bytes === 0) return '0 MB';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// İndirilmek istenen XML dosyalarının linkleri
const urls = [
  'https://mnm.saatvesaat.com.tr/shared/segmentify',
  // Diğer linkler...
];

// Tarih ve saat bilgisi ile klasör oluştur
function createDownloadDirectory() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const folderName = `${day}-${month}-${year}_${hours}-${minutes}-${seconds}`;
  const downloadDir = path.join(__dirname, folderName);

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
  }

  return downloadDir;
}


// Dosya indirme fonksiyonu
async function downloadFile(url, downloadDir) {
  // Dosya ismini URL'in son kısmından al
  const fileName = url.split('/').pop();
  const filePath = path.join(downloadDir, fileName);

  // Başlıkları kontrol etmek için HEAD isteği gönder
  let totalLength = 0;
  try {
    const headResponse = await axios.head(url);
    totalLength = parseInt(headResponse.headers['content-length']) || 0;
  } catch (error) {
    console.warn(`Başlık bilgileri alınamadı: ${error.message}`);
  }

  // Progress bar oluştur
  const progressBar = new ProgressBar(`Downloading ${fileName} [:bar] :percent :current/:total MB`, {
    width: 40,
    complete: '=',
    incomplete: ' ',
    renderThrottle: 1000, // 1 saniyede 1 güncelle
    total: totalLength || 1 // Eğer totalLength 0 ise, 1 olarak ayarla
  });

  // Dosyayı indir ve kaydet
  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(filePath);
  let downloadedLength = 0;

  // 1 saniyede bir güncelleme için interval ayarla
  const interval = setInterval(() => {
    progressBar.tick(downloadedLength - progressBar.curr);
    console.log(`İndirmeye devam ediliyor... İndirilen: ${formatBytes(downloadedLength)} / ${formatBytes(totalLength)}`);
  }, 1000);

  response.data.on('data', (chunk) => {
    downloadedLength += chunk.length;
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      clearInterval(interval);
      progressBar.tick(downloadedLength - progressBar.curr); // Kalanı tamamla
      // İndirme tamamlandıktan sonra dosya boyutunu ölç
      const fileStats = fs.statSync(filePath);
      console.log(`\n${fileName} indirildi! Dosya boyutu: ${formatBytes(fileStats.size)}`);
      resolve();
    });
    writer.on('error', (err) => {
      clearInterval(interval);
      reject(err);
    });
  });
}

// Tüm dosyaları indir
async function downloadAllFiles() {
  const downloadDir = createDownloadDirectory();
  for (let i = 0; i < urls.length; i++) {
    try {
      await downloadFile(urls[i], downloadDir);
    } catch (error) {
      console.error(`${urls[i]} indirilirken hata oluştu: `, error);
    }
  }
}

// İndirme işlemini başlat
downloadAllFiles();
