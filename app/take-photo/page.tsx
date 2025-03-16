'use client';

import { useState } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      console.log("Photo selected:", file.name);
      await processImage(file);
    }
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

  const resetUpload = () => {
    setReceiptData(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.logoSquare}>
        <i className="fa-solid fa-piggy-bank fa-2x" style={{ color: '#EAA300' }}></i>
      </div>
      
      <div className={styles.headlineLockup}>
        <h6 className={styles.subtitle}>Penny pincher</h6>
        <h1 className={styles.title}>Upload receipts and find out if you got the best price!</h1>
      </div>
      
      <StatsBar receipts={23409} savings={1400024} />
      
      {!receiptData ? (
        <div className={styles.receiptContainer}>
          <div className={styles.receiptHero}>
            <h2 className={styles.heroText}>
              Wanna find out if your<br />neighbor got a better price<br />on that <span className={styles.highlight}>milk carton?</span>
            </h2>
            <label htmlFor="receipt-upload" className={styles.uploadButton}>
              <i className="fa-solid fa-upload"></i> Upload Photo
            </label>
            <input 
              id="receipt-upload" 
              type="file" 
              accept="image/*"
              onChange={handleFileUpload} 
              style={{ display: 'none' }} 
            />
          </div>
        </div>
      ) : (
        <div className={styles.resultsContainer}>
          <ReceiptCard {...receiptData} />
          <button 
            onClick={resetUpload}
            className={styles.uploadButton}
            style={{ marginTop: '1rem' }}
          >
            <i className="fa-solid fa-upload"></i> Upload Another Photo
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