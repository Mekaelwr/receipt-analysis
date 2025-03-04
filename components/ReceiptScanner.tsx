"use client";

import { useState } from 'react';
import { ReceiptCard } from '@/components/receipt/ReceiptCard';
import { StatsBar } from '@/components/receipt/StatsBar';
import styles from './ReceiptScanner.module.css';

const ReceiptScanner = () => {
  const [image, setImage] = useState<File | null>(null);
  const [analyzedReceipt, setAnalyzedReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.type, file.size);
      setImage(file);
      setError(null);
      await analyzeReceipt(file);
    }
  };

  const analyzeReceipt = async (imageFile: File) => {
    setLoading(true);
    try {
      console.log('Starting receipt analysis...');
      const formData = new FormData();
      formData.append('image', imageFile);

      console.log('Sending request to API...');
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze receipt');
      }

      const data = await response.json();
      console.log('Received data:', data);
      
      // Transform the data to match the ReceiptCard props format
      const transformedData = {
        store: data.storeName,
        address: data.address || 'Address not available',
        date: data.date,
        items: data.items.map((item: any, index: number) => ({
          id: String(index + 1).padStart(2, '0'),
          name: item.name,
          price: `$${item.price.toFixed(2)}`
        })),
        totals: {
          subtotal: `$${data.subtotal.toFixed(2)}`,
          tax: `$${data.tax.toFixed(2)}`,
          total: `$${data.total.toFixed(2)}`
        },
        totalSavings: '$0.00' // This would come from price comparison logic
      };
      
      setAnalyzedReceipt(transformedData);
    } catch (error) {
      console.error('Error analyzing receipt:', error);
      setError(error instanceof Error ? error.message : 'Failed to analyze receipt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <i className={`fa-solid fa-piggy-bank fa-2x ${styles.logoIcon}`}></i>
      </div>
      
      <header className={styles.header}>
        <h6 className={styles.headerTitle}>Penny pincher</h6>
        <h1 className={styles.headerSubtitle}>Upload receipts and find out if you got the best price!</h1>
      </header>

      <StatsBar receipts={23409} savings={1400024} />

      <div className={styles.receiptContainer}>
        <div className={styles.receiptHero}>
          <h2 className={styles.heroText}>
            Take a photo of your<br />receipt to see the<br /><span className={styles.highlight}>details</span>
          </h2>
          <label htmlFor="receipt-upload" className={styles.uploadButton}>
            <i className="fa-solid fa-camera"></i>Take Photo
          </label>
          <input 
            id="receipt-upload" 
            type="file" 
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload} 
            style={{ display: 'none' }} 
          />
        </div>
      </div>
      
      {error && (
        <div className={styles.errorMessage}>
          <span>{error}</span>
        </div>
      )}
      
      {loading && (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Analyzing receipt...</p>
        </div>
      )}
      
      {analyzedReceipt && <ReceiptCard {...analyzedReceipt} />}
      
      <footer className={styles.footer}>
        <h6 className={styles.footerText}>
          Need help? <a href="mailto:mekaelwr@gmail.com" className={styles.footerLink}>Email us.</a>
        </h6>
      </footer>
    </div>
  );
};

export default ReceiptScanner; 