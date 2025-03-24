'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPiggyBank } from '@fortawesome/free-solid-svg-icons';
import styles from './receipt-shared.module.css';

export interface ReceiptItem {
  id: string;
  name: string;
  price: string;
  cheaper_alternative?: {
    store_name: string;
    price: number;
    item_name: string;
    savings: number;
    percentage_savings: number;
  };
}

export interface ReceiptData {
  store: string;
  address: string;
  date: string;
  items: ReceiptItem[];
  totals: {
    subtotal: string;
    tax: string;
    total: string;
  };
  totalSavings: string;
}

interface Props {
  receipt: ReceiptData;
}

export function ReceiptDisplay({ receipt }: Props) {
  return (
    <div className={styles.receiptWrapper}>
      <div className={styles.receiptHero}>
        <h2 className={styles.receiptHeroTitle}>
          <span className={styles.receiptHeroHighlight}>{receipt.totalSavings}</span> in savings found!
        </h2>
        
        <div className={styles.receipt}>
          <div className={styles.receiptStore}>{receipt.store}</div>
          <div className={styles.receiptAddress}>{receipt.address}</div>
          <div className={styles.receiptDivider}></div>
          <div className={styles.receiptDate}>{receipt.date}</div>
          <div className={styles.receiptDivider}></div>

          {receipt.items.map((item, index) => {
            const itemNumber = (index + 1).toString().padStart(2, '0');
            
            if (item.cheaper_alternative) {
              return (
                <div key={item.id} className={styles.receiptItemSavings}>
                  <div className={styles.receiptMain}>
                    <div className={styles.receiptNumber}>{itemNumber}</div>
                    <div className={styles.receiptName}>{item.name}</div>
                    <div className={`${styles.receiptPrice} ${styles.receiptPriceStrike}`}>{item.price}</div>
                  </div>
                  <div className={styles.receiptSavings}>
                    <div className={styles.receiptNumber}>
                      <FontAwesomeIcon icon={faPiggyBank} className={styles.statsIcon} />
                    </div>
                    <span>Better price at {item.cheaper_alternative.store_name}</span>
                    <span className={styles.receiptSavingsPrice}>${item.cheaper_alternative.price.toFixed(2)}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id} className={styles.receiptItem}>
                <div className={styles.receiptNumber}>{itemNumber}</div>
                <div className={styles.receiptName}>{item.name}</div>
                <div className={styles.receiptPrice}>{item.price}</div>
              </div>
            );
          })}

          <div className={styles.receiptDivider}></div>
          
          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Subtotal</div>
            <div className={styles.receiptPrice}>{receipt.totals.subtotal}</div>
          </div>

          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Tax</div>
            <div className={styles.receiptPrice}>{receipt.totals.tax}</div>
          </div>

          <div className={styles.receiptDivider}></div>

          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Total</div>
            <div className={styles.receiptPrice}><strong>{receipt.totals.total}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
} 