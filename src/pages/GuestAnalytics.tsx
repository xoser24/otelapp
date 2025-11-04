import React from 'react';

const GuestAnalytics: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">Misafir Memnuniyeti Analizi</h1>
      
      {/* Genel Bakış */}
      <div className="premium-card p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Genel Bakış</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-blue-700">Ortalama Puan</h3>
            <div className="flex items-center mt-2">
              <span className="text-3xl font-bold">4.2</span>
              <span className="text-sm ml-2">/ 5.0</span>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-green-700">Olumlu Yorumlar</h3>
            <div className="flex items-center mt-2">
              <span className="text-3xl font-bold">78%</span>
              <span className="text-green-500 ml-2">↑ 5%</span>
            </div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-red-700">Olumsuz Yorumlar</h3>
            <div className="flex items-center mt-2">
              <span className="text-3xl font-bold">12%</span>
              <span className="text-green-500 ml-2">↓ 3%</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Detaylı Geri Bildirimler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="premium-card p-6">
            <h2 className="text-xl font-bold mb-4">Detaylı Geri Bildirimler</h2>
            <div className="space-y-4">
              <div className="border-b pb-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-medium">Ahmet Y.</span>
                    <span className="text-gray-500 text-sm ml-2">Oda 302</span>
                  </div>
                  <div className="flex">
                    <span className="text-yellow-500">★★★★★</span>
                  </div>
                </div>
                <p className="text-gray-700">Odamız çok temiz ve rahattı. Personel her konuda yardımcı oldu. Kahvaltı seçenekleri çok zengindi. Kesinlikle tekrar geleceğiz!</p>
                <div className="mt-2 flex">
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">temizlik</span>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">personel</span>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">yemek</span>
                </div>
              </div>
              
              <div className="border-b pb-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-medium">Zeynep K.</span>
                    <span className="text-gray-500 text-sm ml-2">Oda 118</span>
                  </div>
                  <div className="flex">
                    <span className="text-yellow-500">★★★</span><span className="text-gray-300">★★</span>
                  </div>
                </div>
                <p className="text-gray-700">Oda temizliği iyiydi ancak ses yalıtımı yetersizdi. Yan odadan ve koridordan gelen sesler rahatsız ediciydi. Personel ilgiliydi.</p>
                <div className="mt-2 flex">
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">temizlik</span>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded mr-2">ses yalıtımı</span>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">personel</span>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <span className="font-medium">Mehmet A.</span>
                    <span className="text-gray-500 text-sm ml-2">Oda 215</span>
                  </div>
                  <div className="flex">
                    <span className="text-yellow-500">★★★★</span><span className="text-gray-300">★</span>
                  </div>
                </div>
                <p className="text-gray-700">Genel olarak memnun kaldım. Otel konumu mükemmel, her yere yürüme mesafesinde. Tek sorun banyodaki su basıncının düşük olmasıydı.</p>
                <div className="mt-2 flex">
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">konum</span>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">banyo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <div className="premium-card p-6">
            <h2 className="text-xl font-bold mb-4">Kategori Analizi</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span>Temizlik</span>
                  <span>4.6/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span>Personel</span>
                  <span>4.8/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '96%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span>Konfor</span>
                  <span>4.2/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '84%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span>Yemek</span>
                  <span>3.9/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '78%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span>Ses Yalıtımı</span>
                  <span>3.2/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: '64%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Trend Analizi ve Öneriler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="premium-card p-6">
          <h2 className="text-xl font-bold mb-4">Memnuniyet Trendi</h2>
          <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
            <p className="text-gray-500">Memnuniyet trendi grafiği burada görüntülenecek</p>
          </div>
        </div>
        
        <div className="premium-card p-6">
          <h2 className="text-xl font-bold mb-4">Yapay Zeka Önerileri</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-blue-100 p-2 rounded-full mr-3">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Ses yalıtımı iyileştirme çalışması</p>
                <p className="text-xs text-gray-500">Özellikle 1. ve 2. kattaki odalarda ses yalıtımı şikayetleri artış gösteriyor.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-blue-100 p-2 rounded-full mr-3">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Kahvaltı menüsü çeşitliliği</p>
                <p className="text-xs text-gray-500">Kahvaltı seçeneklerinin artırılması ve yerel lezzetlere yer verilmesi önerilir.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-blue-100 p-2 rounded-full mr-3">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Banyo tesisatı kontrolü</p>
                <p className="text-xs text-gray-500">Bazı odalarda su basıncı sorunları bildirilmiş, teknik ekip tarafından kontrol edilmeli.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestAnalytics;