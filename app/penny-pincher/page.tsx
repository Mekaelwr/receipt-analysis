'use client';

import { useState } from 'react';
import styles from './penny-pincher.module.css';

export default function PennyPincherPage() {
  // Remove unused state if not implementing file handling yet
  // const [file, setFile] = useState<File | null>(null);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Handle file upload when implementing the feature
      console.log("File selected:", e.target.files[0].name);
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
      
      <div className={styles.statsBubble}>
        <div>
          <p className={styles.small}>
            <i className="fa-solid fa-receipt" style={{ color: '#EAA300' }}></i>
            <strong>23,409</strong> receipts
          </p>
        </div>
        <div>
          <p className={styles.small}>
            <i className="fa-solid fa-piggy-bank" style={{ color: '#EAA300' }}></i>
            <strong>1,400,024</strong> savings
          </p>
        </div>
      </div>
      
      <div className={styles.receiptContainer}>
        <div className={styles.receiptHero}>
          <h2 className={styles.heroText}>
            Wanna find out if your<br />neighbor got a better price<br />on that <span className={styles.highlight}>milk carton?</span>
          </h2>
          <label htmlFor="receipt-upload" className={styles.uploadButton}>
            <i className="fa-solid fa-upload"></i>Upload your receipt
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
      
      <div className={styles.footer}>
        <h6 className={styles.footerText}>
          Need help? <a href="mailto:mekaelwr@gmail.com" className={styles.footerLink}>Email us.</a>
        </h6>
      </div>
    </div>
  );
} 