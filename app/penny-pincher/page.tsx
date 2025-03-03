'use client';

// Remove the useState import since we're not using it
// import { useState } from 'react';
import { ReceiptCard } from '@/components/receipt/ReceiptCard';
import { StatsBar } from '@/components/receipt/StatsBar';
import styles from './penny-pincher.module.css';

export default function PennyPincher() {
  // Remove unused state if not implementing file handling yet
  // const [file, setFile] = useState<File | null>(null);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      console.log("Photo captured:", e.target.files[0].name);
      // Handle the captured image here
    }
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
      
      <div className={styles.receiptContainer}>
        <div className={styles.receiptHero}>
          <h2 className={styles.heroText}>
            Wanna find out if your<br />neighbor got a better price<br />on that <span className={styles.highlight}>milk carton?</span>
          </h2>
          <label htmlFor="receipt-upload" className={styles.uploadButton}>
            <i className="fa-solid fa-camera"></i>Take Photo
          </label>
          <input 
            id="receipt-upload" 
            type="file" 
            accept="image/*"
            capture    // This will open the native camera without specifying which one
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
        </div>
      </div>
      
      <div className={styles.footer}>
        <h6 className={styles.footerText}>
          Need help? <a href="mailto:mekaelwr@gmail.com" className={styles.footerLink}>Email us.</a>
        </h6>
      </div>
    </div>
  );
} 