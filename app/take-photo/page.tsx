'use client';

import { ReceiptUploader } from '@/components/receipt/ReceiptUploader';
import styles from '@/components/receipt/receipt-shared.module.css';

export default function TakePhoto() {
  return (
    <div className={styles.body}>
      <ReceiptUploader />
    </div>
  );
} 