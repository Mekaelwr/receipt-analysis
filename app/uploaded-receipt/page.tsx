"use client";

import { PageLayout } from '@/components/layout/PageLayout';
import { ReceiptCard } from '@/components/receipt/ReceiptCard';

export default function UploadedReceipt() {
  const receiptData = {
    store: "Aldi",
    address: "4500 n. broadway Chicago, IL",
    date: "Thursday April 15, 2025 at 11:29 AM",
    items: [
      { id: "01", name: "Crispy oats", price: "$1.89" },
      { id: "02", name: "Insulated Bags", price: "$0.98" },
      {
        id: "03",
        name: "Milk",
        price: "$5.39",
        cheaper_alternative: {
          store_name: "Jewel Osco",
          price: 2.49,
          item_name: "Jewel Osco Brand Milk",
          savings: 2.90,
          percentage_savings: 53.8
        }
      },
      {
        id: "04",
        name: "Orange Juice",
        price: "$4.99",
        cheaper_alternative: {
          store_name: "Whole Foods Market",
          price: 3.69,
          item_name: "Not From Concentrate Orange Juice No Pulp",
          savings: 1.30,
          percentage_savings: 26.05
        }
      }
    ],
    totals: {
      subtotal: "$32.92",
      tax: "$4.92",
      total: "$34.92"
    },
    totalSavings: "$49.50"
  };

  return (
    <PageLayout
      icon="fa-piggy-bank"
      subtitle="Penny pincher"
      title="Upload receipts and find out if you got the best price!"
      receipts={23409}
      savings={1400024}
    >
      <ReceiptCard {...receiptData} />
    </PageLayout>
  );
} 