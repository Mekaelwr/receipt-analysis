"use client";

import styles from './uploaded-receipt.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPiggyBank, faReceipt } from '@fortawesome/free-solid-svg-icons';

export default function UploadedReceipt() {
  return (
    <div className={styles.body}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <FontAwesomeIcon icon={faPiggyBank} size="2x" className={styles.logoIcon} />
        </div>
        
        <header className={styles.header}>
          <h6 className={styles.headerTitle}>Penny pincher</h6>
          <h1 className={styles.headerSubtitle}>Upload receipts and find out if you got the best price!</h1>
        </header>

        <div className={styles.stats}>
          <p className={styles.statsItem}>
            <FontAwesomeIcon icon={faReceipt} className={styles.statsIcon} />
            <strong>23,409</strong> receipts
          </p>
          <p className={styles.statsItem}>
            <FontAwesomeIcon icon={faPiggyBank} className={styles.statsIcon} />
            <strong>1,400,024</strong> savings
          </p>
        </div>

        <div className={styles.receiptWrapper}>
          <div className={styles.receiptHero}>
            <h2 className={styles.receiptHeroTitle}>
              <span className={styles.receiptHeroHighlight}>$49.50</span> in savings found!
            </h2>
            
            <div className={styles.receipt}>
              <div className={styles.receiptStore}>Aldi</div>
              <div className={styles.receiptAddress}>4500 n. broadway Chicago, IL</div>
              <div className={styles.receiptDivider}></div>
              <div className={styles.receiptDate}>Thursday April 15, 2025 at 11:29 AM</div>
              <div className={styles.receiptDivider}></div>

              <div className={styles.receiptItem}>
                <div className={styles.receiptNumber}>01</div>
                <div className={styles.receiptName}>Crispy oats</div>
                <div className={styles.receiptPrice}>$1.89</div>
              </div>

              <div className={styles.receiptItem}>
                <div className={styles.receiptNumber}>02</div>
                <div className={styles.receiptName}>Insulated Bags</div>
                <div className={styles.receiptPrice}>$0.98</div>
              </div>

              <div className={styles.receiptItemSavings}>
                <div className={styles.receiptMain}>
                  <div className={styles.receiptNumber}>03</div>
                  <div className={styles.receiptName}>Milk</div>
                  <div className={`${styles.receiptPrice} ${styles.receiptPriceStrike}`}>$5.39</div>
                </div>
                <div className={styles.receiptSavings}>
                  <div className={styles.receiptNumber}>
                    <FontAwesomeIcon icon={faPiggyBank} className={styles.statsIcon} />
                  </div>
                  <span>Better price at jewel osco</span>
                  <span className={styles.receiptSavingsPrice}>$2.49</span>
                </div>
              </div>

              <div className={styles.receiptItem}>
                <div className={styles.receiptNumber}>04</div>
                <div className={styles.receiptName}>NFC Oj no pulp</div>
                <div className={styles.receiptPrice}>$3.69</div>
              </div>

              <div className={styles.receiptDivider}></div>
              
              <div className={styles.receiptItem}>
                <div className={styles.receiptName}>Subtotal</div>
                <div className={styles.receiptPrice}>$32.92</div>
              </div>

              <div className={styles.receiptItem}>
                <div className={styles.receiptName}>Tax</div>
                <div className={styles.receiptPrice}>$4.92</div>
              </div>

              <div className={styles.receiptDivider}></div>

              <div className={styles.receiptItem}>
                <div className={styles.receiptName}>Total</div>
                <div className={styles.receiptPrice}><strong>$34.92</strong></div>
              </div>
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          <h6 className={styles.footerText}>
            Need help? <a href="mailto:mekaelwr@gmail.com" className={styles.footerLink}>Email us.</a>
          </h6>
        </footer>
      </div>
    </div>
  );
} 