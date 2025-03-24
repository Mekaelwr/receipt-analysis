import styles from './receipt.module.css';

interface ReceiptCardProps {
  store: string;
  address: string;
  date: string;
  items: {
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
  // Calculate the number of items with cheaper alternatives and total savings
  const itemsWithAlternatives = items.filter(item => item.cheaper_alternative);
  const calculatedSavings = itemsWithAlternatives.reduce((sum, item) => 
    sum + (item.cheaper_alternative?.savings || 0)
  , 0);
  
  return (
    <div className={styles.receiptWrapper}>
      <div className={styles.receiptHero}>
        <h2 className={styles.receiptTitle}>
          <span className={styles.receiptHighlight}>
            {totalSavings || `$${calculatedSavings.toFixed(2)}`}
          </span> in savings found!
        </h2>
        
        <div className={styles.receipt}>
          <div className={styles.receiptStore}>{store}</div>
          <div className={styles.receiptAddress}>{address}</div>
          <div className={styles.receiptDivider}></div>
          <div className={styles.receiptDate}>{date}</div>
          
          {/* Savings Summary */}
          {itemsWithAlternatives.length > 0 && (
            <>
              <div className={styles.receiptDivider}></div>
              <div className={styles.savingsSummary}>
                <div>
                  <i className="fa-solid fa-piggy-bank" aria-hidden="true"></i>
                  <span className={styles.savingsText}>Found {itemsWithAlternatives.length} cheaper alternatives!</span>
                </div>
                <span className={styles.savingsAmount}>Save ${calculatedSavings.toFixed(2)}</span>
              </div>
            </>
          )}
          
          <div className={styles.receiptDivider}></div>

          {items.map((item) => (
            <div 
              key={item.id}
              className={`${styles.receiptItem} ${item.cheaper_alternative ? styles.receiptItemSavings : ''}`}
            >
              {item.cheaper_alternative ? (
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
                    <div className={styles.savingsInfo}>
                      <span>Better price at {item.cheaper_alternative.store_name}</span>
                      <span className={styles.savingsPercent}>
                        Save {item.cheaper_alternative.percentage_savings.toFixed(0)}%
                      </span>
                    </div>
                    <span className={styles.savingsPrice}>${item.cheaper_alternative.price.toFixed(2)}</span>
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