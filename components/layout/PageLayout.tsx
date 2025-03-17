'use client';

import { StatsBar } from '@/components/receipt/StatsBar';
import styles from './layout.module.css';

interface PageLayoutProps {
  icon: string;
  subtitle: string;
  title: string;
  receipts: number;
  savings: number;
  children: React.ReactNode;
}

export function PageLayout({ 
  icon, 
  subtitle, 
  title, 
  receipts, 
  savings, 
  children 
}: PageLayoutProps) {
  return (
    <div className={styles.container}>
      <div className={styles.logoSquare}>
        <i className={`fa-solid ${icon} fa-2x`} style={{ color: '#EAA300' }}></i>
      </div>
      
      <div className={styles.headlineLockup}>
        <h6 className={styles.subtitle}>{subtitle}</h6>
        <h1 className={styles.title}>{title}</h1>
      </div>
      
      <StatsBar receipts={receipts} savings={savings} />
      
      {children}
      
      <div className={styles.footer}>
        <h6 className={styles.footerText}>
          Need help? <a href="mailto:mekaelwr@gmail.com" className={styles.footerLink}>Email us.</a>
        </h6>
      </div>
    </div>
  );
} 