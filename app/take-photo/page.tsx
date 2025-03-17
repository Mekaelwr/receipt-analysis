'use client';

import { PageLayout } from '@/components/layout/PageLayout';
import { ReceiptUploader } from '@/components/receipt/ReceiptUploader';

export default function TakePhoto() {
  return (
    <PageLayout
      icon="fa-camera"
      subtitle="Take Photo"
      title="Capture receipts to track your spending and find savings!"
      receipts={23409}
      savings={1400024}
    >
      <ReceiptUploader />
    </PageLayout>
  );
} 