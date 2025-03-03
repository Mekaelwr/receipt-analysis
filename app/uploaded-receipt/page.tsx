"use client";

import { ReceiptCard } from '@/components/receipt/ReceiptCard';
import { StatsBar } from '@/components/receipt/StatsBar';
import styles from './uploaded-receipt.module.css';

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
        savings: {
          store: "jewel osco",
          price: "$2.49"
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
    <div className={styles.container}>
      <div className={styles.logo}>
        <i className={`fa-solid fa-piggy-bank fa-2x ${styles.logoIcon}`}></i>
      </div>
      
      <header className={styles.header}>
        <h6 className={styles.headerTitle}>Penny pincher</h6>
        <h1 className={styles.headerSubtitle}>Upload receipts and find out if you got the best price!</h1>
      </header>

      <StatsBar receipts={23409} savings={1400024} />
      <ReceiptCard {...receiptData} />

      <footer className={styles.footer}>
        <h6 className={styles.footerText}>
          Need help? <a href="mailto:mekaelwr@gmail.com" className={styles.footerLink}>Email us.</a>
        </h6>
      </footer>
    </div>
  );
} 