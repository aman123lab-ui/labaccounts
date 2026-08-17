'use client';

import React, { useState } from 'react';
import { generateQrCodeSvgPath } from '@/utils/qrGenerator';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCodeDisplay({ value, size = 240, className = '' }: QRCodeDisplayProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const { svgPath, size: totalSize } = generateQrCodeSvgPath(value, 5);

  // High-definition 450x450 PNG via standard libqrencode API for desktop scan clarity
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&margin=15&format=png&data=${encodeURIComponent(
    value
  )}`;

  return (
    <>
      <div className={`p-2.5 bg-white rounded-2xl flex flex-col items-center justify-center shadow-lg border border-slate-200 group relative ${className}`}>
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="focus:outline-none cursor-pointer flex flex-col items-center w-full"
          title="Click to enlarge QR Code for scanning"
        >
          {!useFallback ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrImageUrl}
              alt="Scannable UPI QR Code"
              width={size}
              height={size}
              onError={() => setUseFallback(true)}
              className="w-full h-auto max-w-[150px] aspect-square object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <svg
              viewBox={`0 0 ${totalSize} ${totalSize}`}
              width={size}
              height={size}
              className="w-full h-auto max-w-[150px]"
              shapeRendering="crispEdges"
            >
              <rect width={totalSize} height={totalSize} fill="#ffffff" />
              <path d={svgPath} fill="#000000" />
            </svg>
          )}

          <span className="text-[9px] font-bold text-slate-500 hover:text-emerald-600 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            Click to Enlarge
          </span>
        </button>
      </div>

      {/* Full Screen Zoom Modal for Desktop Scanning */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 mb-1">
              Google Pay / PhonePe QR
            </span>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Scan to Pay</h3>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-inner mb-4">
              {!useFallback ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrImageUrl}
                  alt="Scannable Large UPI QR Code"
                  width={280}
                  height={280}
                  className="w-full h-auto max-w-[280px] aspect-square object-contain"
                />
              ) : (
                <svg
                  viewBox={`0 0 ${totalSize} ${totalSize}`}
                  width={280}
                  height={280}
                  className="w-full h-auto max-w-[280px]"
                  shapeRendering="crispEdges"
                >
                  <rect width={totalSize} height={totalSize} fill="#ffffff" />
                  <path d={svgPath} fill="#000000" />
                </svg>
              )}
            </div>

            <p className="text-xs text-center text-slate-500 font-mono">
              UPI ID: <span className="font-bold text-slate-800">muhammedanfaz123-1@oksbi</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
