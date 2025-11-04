import React from 'react';
import QRCode from 'react-qr-code';

interface QRCodeGeneratorProps {
  roomNumber: string;
  baseUrl: string;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ roomNumber, baseUrl }) => {
  // QR kodun içereceği URL
  const qrValue = `${baseUrl}/portal?room=${roomNumber}`;

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <QRCode value={qrValue} size={200} />
      </div>
      <p className="mt-3 text-sm text-gray-600">Oda {roomNumber} için QR Kod</p>
      <p className="text-xs text-gray-500">Bu kodu taratarak misafir portalına erişebilirsiniz</p>
    </div>
  );
};

export default QRCodeGenerator;