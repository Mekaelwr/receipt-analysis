import styles from './receipt.module.css';

interface StatsBarProps {
  receipts: number;
  savings: number;
}

export function StatsBar({ receipts, savings }: StatsBarProps) {
  return (
    <div className={styles.stats}>
      <p className={styles.statsItem}>
        <i className={`fa-solid fa-receipt ${styles.statsIcon}`}></i>
        <strong>{receipts.toLocaleString()}</strong> receipts
      </p>
      <p className={styles.statsItem}>
        <i className={`fa-solid fa-piggy-bank ${styles.statsIcon}`}></i>
        <strong>{savings.toLocaleString()}</strong> savings
      </p>
    </div>
  );
} 