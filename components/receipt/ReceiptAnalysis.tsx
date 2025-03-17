'use client';

import styles from './receipt.module.css';

interface ReceiptAnalysisProps {
  analysisText: string;
}

export function ReceiptAnalysis({ analysisText }: ReceiptAnalysisProps) {
  // Parse the analysis text to extract structured data
  const parseAnalysis = (text: string) => {
    console.log("Raw analysis text:", text);
    
    // Extract store name
    const storeNameMatch = text.match(/\*\*Store Name:\*\* (.*?)(?:\s{2,}|\n)/);
    const storeName = storeNameMatch ? storeNameMatch[1].trim() : 'Unknown Store';
    
    // Extract address
    const addressMatch = text.match(/\*\*Address:\*\* (.*?)(?:\s{2,}|\n)/);
    const address = addressMatch ? addressMatch[1].trim() : '';
    
    // Extract phone number
    const phoneMatch = text.match(/\*\*Phone Number:\*\* (.*?)(?:\s{2,}|\n)/);
    const phone = phoneMatch ? phoneMatch[1].trim() : '';
    
    // Extract date
    const dateMatch = text.match(/\*\*Purchase Date:\*\* (.*?)(?:\s{2,}|\n)/);
    const date = dateMatch ? dateMatch[1].trim() : '';
    
    // Extract time if available
    const timeMatch = text.match(/\*\*Time:\*\* (.*?)(?:\s{2,}|\n)/);
    const time = timeMatch ? timeMatch[1].trim() : '';
    
    // Extract items - improved regex to handle various formats
    const itemsSection = text.match(/(?:### Purchased Items:|\*\*Purchased Items:\*\*)([\s\S]*?)(?=###|(?:\*\*Tax)|(?:\*\*Total)|$)/i);
    console.log("Items section match:", itemsSection);
    
    const itemsText = itemsSection ? itemsSection[1].trim() : '';
    console.log("Items text:", itemsText);
    
    // Try different item formats
    // Format 1: "1. Item Name - $Price"
    // Format 2: "Item Name - $Price"
    const itemRegex = /(?:\d+\.\s+)?(.*?)\s+-\s+\$([\d.]+)/g;
    
    const items = [];
    let itemMatch;
    let itemId = 1;
    
    while ((itemMatch = itemRegex.exec(itemsText)) !== null) {
      console.log("Item match:", itemMatch);
      items.push({
        id: itemId.toString().padStart(2, '0'),
        name: itemMatch[1].trim(),
        price: '$' + itemMatch[2].trim()
      });
      itemId++;
    }
    
    // If no items found with the first regex, try an alternative format
    if (items.length === 0) {
      const alternativeItemRegex = /(?:\d+\.\s+)?([^$]+)\s+\$([\d.]+)/g;
      while ((itemMatch = alternativeItemRegex.exec(itemsText)) !== null) {
        items.push({
          id: itemId.toString().padStart(2, '0'),
          name: itemMatch[1].trim(),
          price: '$' + itemMatch[2].trim()
        });
        itemId++;
      }
    }
    
    console.log("Extracted items:", items);
    
    // Extract tax items
    const taxSection = text.match(/(?:### Tax Items:|\*\*Tax Items:\*\*)([\s\S]*?)(?=###|\*\*Total|$)/i);
    const taxText = taxSection ? taxSection[1].trim() : '';
    
    // Try different tax formats
    const taxRegex = /(?:-\s+)?(.*?)\s+-\s+\$([\d.]+)/g;
    
    const taxes = [];
    let taxMatch;
    
    while ((taxMatch = taxRegex.exec(taxText)) !== null) {
      taxes.push({
        name: taxMatch[1].trim(),
        amount: '$' + taxMatch[2].trim()
      });
    }
    
    // If no taxes found with the first regex, try an alternative format
    if (taxes.length === 0) {
      const alternativeTaxRegex = /([^$]+)\s+\$([\d.]+)/g;
      while ((taxMatch = alternativeTaxRegex.exec(taxText)) !== null) {
        taxes.push({
          name: taxMatch[1].trim(),
          amount: '$' + taxMatch[2].trim()
        });
      }
    }
    
    // Extract total - try multiple formats
    let total = '$0.00';
    const totalMatch = 
      text.match(/\*\*Total:\*\*\s+\$([\d.]+)/) || 
      text.match(/\*\*Total Purchase Amount:\*\*\s+\*\*Total:\*\*\s+\$([\d.]+)/) ||
      text.match(/Total:\s+\$([\d.]+)/i) ||
      text.match(/Total\s+\$([\d.]+)/i);
    
    if (totalMatch) {
      total = '$' + totalMatch[1].trim();
    }
    
    console.log("Extracted total:", total);
    
    // Calculate subtotal (total - sum of taxes) or extract if available
    let subtotal = '$0.00';
    const subtotalMatch = text.match(/Subtotal:?\s+\$([\d.]+)/i);
    
    if (subtotalMatch) {
      subtotal = '$' + subtotalMatch[1].trim();
    } else {
      const taxTotal = taxes.reduce((sum, tax) => {
        const amount = parseFloat(tax.amount.replace('$', ''));
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      
      const totalAmount = parseFloat(total.replace('$', ''));
      subtotal = isNaN(totalAmount) ? '$0.00' : '$' + (totalAmount - taxTotal).toFixed(2);
    }
    
    return {
      store: storeName,
      address: address,
      phone: phone,
      date: date + (time ? ' at ' + time : ''),
      items: items,
      taxes: taxes,
      totals: {
        subtotal: subtotal,
        tax: taxes.length > 0 
          ? taxes.map(t => t.amount).join(' + ') 
          : '$0.00',
        total: total
      }
    };
  };
  
  const receiptData = parseAnalysis(analysisText);
  
  return (
    <div className={styles.receiptWrapper}>
      <div className={styles.receiptHero}>
        <h2 className={styles.receiptTitle}>
          Receipt Analysis <span className={styles.receiptHighlight}>Complete</span>
        </h2>
        
        <div className={styles.receipt}>
          <div className={styles.receiptStore}>{receiptData.store}</div>
          <div className={styles.receiptAddress}>{receiptData.address}</div>
          {receiptData.phone && (
            <div className={styles.receiptAddress}>{receiptData.phone}</div>
          )}
          <div className={styles.receiptDivider}></div>
          <div className={styles.receiptDate}>{receiptData.date}</div>
          <div className={styles.receiptDivider}></div>

          {receiptData.items.length > 0 ? (
            receiptData.items.map((item) => (
              <div key={item.id} className={styles.receiptItem}>
                <div className={styles.receiptNumber}>{item.id}</div>
                <div className={styles.receiptName}>{item.name}</div>
                <div className={styles.receiptPrice}>{item.price}</div>
              </div>
            ))
          ) : (
            <div className={styles.receiptItem}>
              <div className={styles.receiptName}>No items found in receipt</div>
            </div>
          )}

          <div className={styles.receiptDivider}></div>
          
          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Subtotal</div>
            <div className={styles.receiptPrice}>{receiptData.totals.subtotal}</div>
          </div>

          {receiptData.taxes.length > 0 ? (
            receiptData.taxes.map((tax, index) => (
              <div key={index} className={styles.receiptItem}>
                <div className={styles.receiptName}>{tax.name}</div>
                <div className={styles.receiptPrice}>{tax.amount}</div>
              </div>
            ))
          ) : (
            <div className={styles.receiptItem}>
              <div className={styles.receiptName}>Tax</div>
              <div className={styles.receiptPrice}>$0.00</div>
            </div>
          )}

          <div className={styles.receiptDivider}></div>

          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Total</div>
            <div className={styles.receiptPrice}><strong>{receiptData.totals.total}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
} 