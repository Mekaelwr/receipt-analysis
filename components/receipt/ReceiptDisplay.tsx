'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPiggyBank } from '@fortawesome/free-solid-svg-icons';
import styles from './receipt-shared.module.css';

export interface ReceiptItem {
  id: string;
  name: string;
  original_price: string;
  final_price: string;
  cheaper_alternative?: {
    store_name: string;
    price: string;
    item_name: string;
    savings: string;
    percentage_savings: string;
    is_temporal?: boolean;  // true if this is a historical price from same store
    days_ago?: number;      // how many days ago was this price available
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
  // Calculate total potential savings from cheaper alternatives
  const itemsWithAlternatives = receipt.items.filter(item => item.cheaper_alternative);
  console.log('Items with alternatives:', itemsWithAlternatives);

  const totalPotentialSavings = itemsWithAlternatives.reduce((sum, item) => {
    if (!item.cheaper_alternative) return sum;
    
    // Parse the original price and alternative price
    const originalPrice = parseFloat(item.original_price.replace('$', ''));
    const alternativePrice = parseFloat(item.cheaper_alternative.price.replace('$', ''));
    
    // Calculate savings as the difference between prices
    const savings = originalPrice - alternativePrice;
    
    console.log(`Item: ${item.name}`);
    console.log(`Original price: ${originalPrice}`);
    console.log(`Alternative price: ${alternativePrice}`);
    console.log(`Calculated savings: ${savings}`);
    
    return sum + (isNaN(savings) ? 0 : savings);
  }, 0);

  console.log('Total potential savings:', totalPotentialSavings);

  return (
    <div className={styles.receiptWrapper}>
      <div className={styles.receiptHero}>
        <h2 className={styles.receiptHeroTitle}>
          <span className={styles.receiptHeroHighlight}>${totalPotentialSavings.toFixed(2)}</span> in savings found!
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
                    <div className={`${styles.receiptPrice} ${styles.receiptPriceStrike}`}>{item.original_price}</div>
                  </div>
                  <div className={styles.receiptSavings}>
                    <div className={styles.receiptNumber}>
                      <FontAwesomeIcon icon={faPiggyBank} className={styles.statsIcon} />
                    </div>
                    {item.cheaper_alternative.is_temporal ? (
                      <span>Better price {item.cheaper_alternative.days_ago} days ago</span>
                    ) : (
                      <span>Better price at {item.cheaper_alternative.store_name}</span>
                    )}
                    <span className={styles.receiptSavingsPrice}>{item.cheaper_alternative.price}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id} className={styles.receiptItem}>
                <div className={styles.receiptNumber}>{itemNumber}</div>
                <div className={styles.receiptName}>{item.name}</div>
                <div className={styles.receiptPrice}>{item.original_price}</div>
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