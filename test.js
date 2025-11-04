// Basit test script'i
console.log("Otel Yönetim Sistemi Test Başlatılıyor...");

// Proje yapısını kontrol et
const fs = require('fs');
const path = require('path');

function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Gerekli dosyaları kontrol et
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'tailwind.config.js',
  'src/index.tsx',
  'src/App.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/GuestPortal.tsx',
  'src/pages/HousekeepingPanel.tsx',
  'src/pages/GuestAnalytics.tsx',
  'src/pages/NotificationSystem.tsx',
  'src/pages/SustainabilityTracker.tsx'
];

console.log("\nDosya Yapısı Kontrolü:");
let allFilesExist = true;
requiredFiles.forEach(file => {
  const exists = checkFileExists(path.join(__dirname, file));
  console.log(`${file}: ${exists ? '✓' : '✗'}`);
  if (!exists) allFilesExist = false;
});

if (allFilesExist) {
  console.log("\n✅ Tüm gerekli dosyalar mevcut.");
} else {
  console.log("\n❌ Bazı dosyalar eksik. Lütfen kontrol ediniz.");
}

// Package.json kontrolü
try {
  const packageJson = require('./package.json');
  console.log("\nBağımlılık Kontrolü:");
  
  const requiredDependencies = [
    'react', 
    'react-dom', 
    'react-router-dom', 
    'typescript', 
    'tailwindcss'
  ];
  
  let allDepsExist = true;
  requiredDependencies.forEach(dep => {
    const exists = packageJson.dependencies && packageJson.dependencies[dep];
    console.log(`${dep}: ${exists ? '✓' : '✗'}`);
    if (!exists) allDepsExist = false;
  });
  
  if (allDepsExist) {
    console.log("\n✅ Tüm gerekli bağımlılıklar tanımlanmış.");
  } else {
    console.log("\n❌ Bazı bağımlılıklar eksik. Lütfen package.json dosyasını kontrol ediniz.");
  }
  
} catch (err) {
  console.log("\n❌ package.json dosyası okunamadı:", err.message);
}

console.log("\nTest Tamamlandı!");
console.log("\nUygulamayı başlatmak için Node.js kurulumu yapıp aşağıdaki komutları çalıştırın:");
console.log("npm install");
console.log("npm start");