import { createLogger, format, transports } from 'winston';

// Create a logger instance
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'price-comparison-error.log' })
  ]
});

// Price comparison specific logging
export const priceComparisonLogger = {
  logComparison: (receiptId: string, itemName: string, currentPrice: number, comparisonPrice: number, comparisonStore: string, comparisonType: 'temporal' | 'cross-store') => {
    logger.info('Price comparison found', {
      receiptId,
      itemName,
      currentPrice,
      comparisonPrice,
      comparisonStore,
      comparisonType,
      savings: currentPrice - comparisonPrice,
      savingsPercentage: ((currentPrice - comparisonPrice) / currentPrice) * 100
    });
  },

  logError: (receiptId: string, itemName: string, error: string) => {
    logger.error('Price comparison error', {
      receiptId,
      itemName,
      error
    });
  },

  logTotalSavings: (receiptId: string, calculatedSavings: number, displayedSavings: number) => {
    if (Math.abs(calculatedSavings - displayedSavings) > 0.01) {
      logger.error('Savings calculation mismatch', {
        receiptId,
        calculatedSavings,
        displayedSavings,
        difference: Math.abs(calculatedSavings - displayedSavings)
      });
    }
  }
}; 