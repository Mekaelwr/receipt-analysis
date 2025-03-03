import styles from './receipt.module.css';

interface ReceiptCardProps {
  store: string;
  address: string;
  date: string;
  items: {
    id: string;
    name: string;
    price: string;
    savings?: {
      store: string;
      price: string;
    };
  }[];
  totals: {
    subtotal: string;
    tax: string;
    total: string;
  };
  totalSavings: string;
}

export function ReceiptCard({
  store,
  address,
  date,
  items,
  totals,
  totalSavings
}: ReceiptCardProps) {
  return (
    <div className={styles.receiptWrapper}>
      <div className={styles.receiptHero}>
        <h2 className={styles.receiptTitle}>
          <span className={styles.receiptHighlight}>{totalSavings}</span> in savings found!
        </h2>
        
        <div className={styles.receipt}>
          <div className={styles.receiptStore}>{store}</div>
          <div className={styles.receiptAddress}>{address}</div>
          <div className={styles.receiptDivider}></div>
          <div className={styles.receiptDate}>{date}</div>
          <div className={styles.receiptDivider}></div>

          {items.map((item) => (
            <div 
              key={item.id}
              className={`${styles.receiptItem} ${item.savings ? styles.receiptItemSavings : ''}`}
            >
              {item.savings ? (
                <>
                  <div className={styles.receiptItemMain}>
                    <div className={styles.receiptNumber}>{item.id}</div>
                    <div className={styles.receiptName}>{item.name}</div>
                    <div className={`${styles.receiptPrice} ${styles.receiptPriceStrike}`}>{item.price}</div>
                  </div>
                  <div className={styles.savingsRow}>
                    <div className={styles.receiptNumber}>
                      <i className={`fa-solid fa-piggy-bank ${styles.statsIcon}`}></i>
                    </div>
                    <span>Better price at {item.savings.store}</span>
                    <span className={styles.savingsPrice}>{item.savings.price}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.receiptNumber}>{item.id}</div>
                  <div className={styles.receiptName}>{item.name}</div>
                  <div className={styles.receiptPrice}>{item.price}</div>
                </>
              )}
            </div>
          ))}

          <div className={styles.receiptDivider}></div>
          
          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Subtotal</div>
            <div className={styles.receiptPrice}>{totals.subtotal}</div>
          </div>

          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Tax</div>
            <div className={styles.receiptPrice}>{totals.tax}</div>
          </div>

          <div className={styles.receiptDivider}></div>

          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Total</div>
            <div className={styles.receiptPrice}><strong>{totals.total}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
} 