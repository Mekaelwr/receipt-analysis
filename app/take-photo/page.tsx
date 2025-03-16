'use client';

import { useState, useRef, useEffect } from 'react';
import { ReceiptCard } from '@/components/receipt/ReceiptCard';
import { StatsBar } from '@/components/receipt/StatsBar';
import styles from './take-photo.module.css';

interface ReceiptData {
  store: string;
  address: string;
  date: string;
  items: {
    id: string;
    name: string;
    price: string;
    savings?: {
      store: string;
      price: string;
    };
  }[];
  totals: {
    subtotal: string;
    tax: string;
    total: string;
  };
  totalSavings: string;
}

export default function TakePhotoPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isLoading, setIsLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        if (stream) {
          // Stop previous stream
          stream.getTracks().forEach(track => track.stop());
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false
        });
        
        setStream(newStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access the camera. Please make sure you have granted camera permissions.');
      }
    };

    startCamera();

    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const switchCamera = () => {
    setFacingMode(prevMode => prevMode === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        console.error('Failed to capture image');
        return;
      }

      // Create a File object from the blob
      const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
      
      // Process the captured image
      await processImage(file);
    }, 'image/jpeg', 0.95);
  };

  const processImage = async (file: File) => {
    setIsLoading(true);
    
    try {
      // Create a FormData object to send the image
      const formData = new FormData();
      formData.append('image', file);

      // Send the image to your API for analysis
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Receipt data:', data);

      // Transform the API response to match the ReceiptCard component's expected format
      const transformedData: ReceiptData = {
        store: data.storeName || 'Unknown Store',
        address: data.storeLocation || 'Address not available',
        date: data.date || new Date().toLocaleDateString(),
        items: (data.items || []).map((item: any, index: number) => ({
          id: String(index + 1).padStart(2, '0'),
          name: item.name || 'Unknown Item',
          price: `$${typeof item.price === 'number' ? item.price.toFixed(2) : '0.00'}`
        })),
        totals: {
          subtotal: `$${typeof data.subtotal === 'number' ? data.subtotal.toFixed(2) : '0.00'}`,
          tax: `$${typeof data.tax === 'number' ? data.tax.toFixed(2) : '0.00'}`,
          total: `$${typeof data.total === 'number' ? data.total.toFixed(2) : '0.00'}`
        },
        totalSavings: '$0.00' // This would be calculated based on price comparisons
      };

      setReceiptData(transformedData);
    } catch (error) {
      console.error('Error processing receipt:', error);
      alert('Failed to process the receipt. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetCamera = () => {
    setReceiptData(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.logoSquare}>
        <i className="fa-solid fa-camera fa-2x" style={{ color: '#EAA300' }}></i>
      </div>
      
      <div className={styles.headlineLockup}>
        <h6 className={styles.subtitle}>Take Photo</h6>
        <h1 className={styles.title}>Capture your receipt and find out if you got the best price!</h1>
      </div>
      
      <StatsBar receipts={23409} savings={1400024} />
      
      {!receiptData ? (
        <>
          <div className={styles.cameraContainer}>
            <div className={styles.cameraPreview}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            </div>
            <div className={styles.cameraControls}>
              <div className={styles.switchCameraButton} onClick={switchCamera}>
                <i className="fa-solid fa-camera-rotate"></i>
              </div>
              <div className={styles.captureButton} onClick={capturePhoto}>
                <i className="fa-solid fa-camera"></i>
              </div>
            </div>
          </div>
          {/* Hidden canvas for capturing images */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </>
      ) : (
        <div className={styles.resultsContainer}>
          <ReceiptCard {...receiptData} />
          <button 
            onClick={resetCamera}
            className={styles.uploadButton}
            style={{ marginTop: '1rem' }}
          >
            <i className="fa-solid fa-camera"></i> Take Another Photo
          </button>
        </div>
      )}
      
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner}></div>
          <div className={styles.loadingText}>Analyzing receipt...</div>
        </div>
      )}
      
      <div className={styles.footer}>
        <h6 className={styles.footerText}>
          Need help? <a href="mailto:mekaelwr@gmail.com" className={styles.footerLink}>Email us.</a>
        </h6>
      </div>
    </div>
  );
} 