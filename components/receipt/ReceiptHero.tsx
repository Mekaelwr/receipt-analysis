'use client';

import styles from './receipt.module.css';

interface ReceiptHeroProps {
  heroText: React.ReactNode;
  buttonText: string;
  buttonIcon: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ReceiptHero({ 
  heroText, 
  buttonText, 
  buttonIcon, 
  onFileUpload 
}: ReceiptHeroProps) {
  return (
    <div className={styles.receiptWrapper}>
      <div className={styles.receiptHero}>
        <h2 className={styles.receiptTitle}>
          {heroText}
        </h2>
        <label htmlFor="receipt-upload" className={styles.uploadButton}>
          <i className={`fa-solid ${buttonIcon}`}></i>{buttonText}
        </label>
        <input 
          id="receipt-upload" 
          type="file" 
          accept="image/*"
          capture    // This will open the native camera without specifying which one
          onChange={onFileUpload} 
          style={{ display: 'none' }} 
        />
      </div>
    </div>
  );
} 