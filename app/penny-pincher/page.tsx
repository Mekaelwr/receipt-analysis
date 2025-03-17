'use client';

import { PageLayout } from '@/components/layout/PageLayout';
import { ReceiptHero } from '@/components/receipt/ReceiptHero';
import styles from '@/components/receipt/receipt.module.css';

export default function PennyPincher() {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      console.log("Photo captured:", e.target.files[0].name);
      // Handle the captured image here
    }
  };

  return (
    <PageLayout
      icon="fa-piggy-bank"
      subtitle="Penny pincher"
      title="Upload receipts and find out if you got the best price!"
      receipts={23409}
      savings={1400024}
    >
      <ReceiptHero
        heroText={
          <>
            Wanna find out if your<br />neighbor got a better price<br />on that <span className={styles.receiptHighlight}>milk carton?</span>
          </>
        }
        buttonText="Take Photo"
        buttonIcon="fa-camera"
        onFileUpload={handleFileUpload}
      />
    </PageLayout>
  );
} 