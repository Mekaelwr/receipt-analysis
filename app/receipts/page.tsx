import ReceiptScanner from '@/components/ReceiptScanner';

export default function ReceiptsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Receipt Scanner</h1>
      <ReceiptScanner />
    </div>
  );
} 