'use client';

import styles from './receipt.module.css';

interface ReceiptJSON {
  store_information: {
    name: string;
    address: string;
    phone_number: string;
  };
  purchase_details: {
    date: string;
    time: string;
  };
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    regular_price: number;
    discounts: Array<{
      type: string;
      amount: number;
    }>;
    final_price: number;
    cheaper_alternative?: {
      store_name: string;
      price: number;
      item_name: string;
      savings: number;
      percentage_savings: number;
      is_temporal: boolean;
      days_ago: number;
    };
  }>;
  taxes: Array<{
    category: string;
    rate: string;
    amount: number;
  }>;
  financial_summary: {
    subtotal: number;
    total_discounts: number;
    net_sales: number;
    total_taxes: number;
    total_amount: number;
    change_given: number;
  };
  payment_information: {
    method: string;
  };
  savings_summary: {
    store_savings: number;
    membership_savings: number;
    total_savings: number;
    savings_percentage: string;
  };
  points_summary: {
    earned: number;
    available: number;
    expiring_date: string;
  };
  summary: {
    total_items: number;
  };
  return_policy: {
    return_window_days: number;
    proof_of_purchase_required: boolean;
  };
}

interface ReceiptAnalysisProps {
  analysisText: string;
  receiptJSON?: ReceiptJSON;
}

interface CheaperAlternative {
  store_name: string;
  price: number;
  item_name: string;
  savings: number;
  percentage_savings: number;
  is_temporal: boolean;
  days_ago: number;
}

interface ReceiptItem {
  id: string;
  name: string;
  price: string;
  cheaper_alternative?: CheaperAlternative;
}

export function ReceiptAnalysis({ analysisText, receiptJSON }: ReceiptAnalysisProps) {
  // Log the received data for debugging
  console.log("%c🔎 DEBUG: ReceiptAnalysis component received data", "background: #e8f5e9; color: #2e7d32; font-weight: bold; padding: 5px; border-radius: 5px;");
  console.log("* analysisText length:", analysisText ? analysisText.length : "null", "characters");
  console.log("* receiptJSON:", receiptJSON ? "Present" : "null");
  
  // Super detailed inspection of alternatives
  if (receiptJSON && receiptJSON.items) {
    console.log("%c🧾 Receipt Items Structure Check", "background: #e8f5e9; color: #2e7d32; font-weight: bold; padding: 5px; border-radius: 5px;");
    console.log(`Found ${receiptJSON.items.length} items in receipt`);
    
    const itemsWithAlts = receiptJSON.items.filter(item => item.cheaper_alternative);
    console.log(`🎯 Found ${itemsWithAlts.length} items with alternatives directly in receiptJSON`);
    
    if (itemsWithAlts.length > 0) {
      console.log("Items with alternatives:");
      itemsWithAlts.forEach((item, i) => {
        console.log(`Item #${i+1}: ${item.name}`);
        console.dir(item.cheaper_alternative);
      });
    } else {
      console.log("NO ALTERNATIVES FOUND IN RECEIPT JSON - THIS IS THE ISSUE");
      console.log("Entire receiptJSON structure:");
      console.dir(receiptJSON, { depth: null });
    }
  }
  
  // Legacy parsing function for backward compatibility
  const parseAnalysis = (text: string): {
    store: string;
    address: string;
    phone: string;
    date: string;
    items: ReceiptItem[];
    taxes: { name: string; amount: string }[];
    totals: { subtotal: string; tax: string; total: string };
    payment: string;
    savings: string;
    returnPolicy: string;
  } => {
    console.log("Raw analysis text:", text);
    
    // Extract store name
    const storeNameMatch = text.match(/\*\*Store Name:\*\*\s+(.*?)(?:\s{2,}|\n)/);
    const storeName = storeNameMatch ? storeNameMatch[1].trim() : 'Unknown Store';
    
    // Extract address
    const addressMatch = text.match(/\*\*Address:\*\*\s+(.*?)(?:\s{2,}|\n)/);
    const address = addressMatch ? addressMatch[1].trim() : '';
    
    // Extract phone number
    const phoneMatch = text.match(/\*\*Phone Number:\*\*\s+(.*?)(?:\s{2,}|\n)/);
    const phone = phoneMatch ? phoneMatch[1].trim() : '';
    
    // Extract date
    const dateMatch = text.match(/\*\*Purchase Date:\*\*\s+(.*?)(?:\s{2,}|\n)/);
    const date = dateMatch ? dateMatch[1].trim() : '';
    
    // Extract time if available
    const timeMatch = text.match(/\*\*Time:\*\*\s+(.*?)(?:\s{2,}|\n)/);
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
    
    const items: ReceiptItem[] = [];
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
      },
      payment: '',
      savings: '',
      returnPolicy: ''
    };
  };

  // If receiptJSON is provided, use it directly
  // Otherwise, fall back to parsing the analysis text
  const receiptData = receiptJSON ? {
    store: receiptJSON.store_information.name || 'Unknown Store',
    address: receiptJSON.store_information.address || '',
    phone: receiptJSON.store_information.phone_number || '',
    date: `${receiptJSON.purchase_details.date || ''}${receiptJSON.purchase_details.time ? ' at ' + receiptJSON.purchase_details.time : ''}`,
    items: receiptJSON.items.map((item, index) => {
      const result: ReceiptItem = {
        id: (index + 1).toString().padStart(2, '0'),
        name: item.name || 'Unknown Item',
        price: `$${(item.final_price || 0).toFixed(2)}`
      };
      
      // Add cheaper alternative if available
      if (item.cheaper_alternative) {
        result.cheaper_alternative = {
          store_name: item.cheaper_alternative.store_name,
          price: item.cheaper_alternative.price,
          item_name: item.cheaper_alternative.item_name,
          savings: item.cheaper_alternative.savings,
          percentage_savings: item.cheaper_alternative.percentage_savings || 0,
          is_temporal: item.cheaper_alternative.is_temporal,
          days_ago: item.cheaper_alternative.days_ago
        };
      }
      
      return result;
    }),
    taxes: receiptJSON.taxes ? receiptJSON.taxes.map(tax => ({
      name: tax.category || 'Tax',
      amount: `$${(tax.amount || 0).toFixed(2)}`
    })) : [],
    totals: {
      subtotal: `$${(receiptJSON.financial_summary.subtotal || 0).toFixed(2)}`,
      tax: receiptJSON.taxes && receiptJSON.taxes.length > 0 
        ? receiptJSON.taxes.map(t => `$${(t.amount || 0).toFixed(2)}`).join(' + ') 
        : '$0.00',
      total: `$${(receiptJSON.financial_summary.total_amount || 0).toFixed(2)}`
    },
    payment: receiptJSON.payment_information && receiptJSON.payment_information.method ? 
      receiptJSON.payment_information.method : '',
    savings: receiptJSON.savings_summary && receiptJSON.savings_summary.total_savings > 0 ? 
      `$${receiptJSON.savings_summary.total_savings.toFixed(2)}` : 
      '',
    returnPolicy: receiptJSON.return_policy && receiptJSON.return_policy.return_window_days > 0 ? 
      `${receiptJSON.return_policy.return_window_days} days` : 
      ''
  } : parseAnalysis(analysisText || '');
  
  // Log the data being used for rendering
  console.log("Receipt data for rendering:", receiptData);
  
  // Calculate total potential savings from cheaper alternatives
  const itemsWithAlternatives = receiptData.items.filter(item => item.cheaper_alternative);
  const totalSavings = itemsWithAlternatives.reduce((sum, item) => {
    if (!item.cheaper_alternative) return sum;
    
    const originalPrice = typeof item.price === 'string' 
      ? parseFloat(item.price.replace('$', '')) 
      : Number(item.price) || 0;
      
    const alternativePrice = typeof item.cheaper_alternative.price === 'string'
      ? parseFloat(String(item.cheaper_alternative.price).replace('$', ''))
      : Number(item.cheaper_alternative.price) || 0;
      
    const itemSavings = item.cheaper_alternative.savings || (originalPrice - alternativePrice);
    
    console.log(`Calculating savings for ${item.name}: Original $${originalPrice} → Alternative $${alternativePrice} = Savings $${itemSavings}`);
    
    return sum + (itemSavings > 0 ? itemSavings : 0);
  }, 0);
  
  // Debug logging for alternatives
  console.log("🔍 RECEIPT RENDERING DEBUG:");
  console.log(`Found ${itemsWithAlternatives.length} items with alternatives`);
  console.dir(receiptJSON, { depth: null });

  if (itemsWithAlternatives.length > 0) {
    console.log("Items with alternatives:");
    itemsWithAlternatives.forEach(item => {
      console.log(`- ${item.name}: ${item.cheaper_alternative?.item_name} at $${item.cheaper_alternative?.price.toFixed(2)} (Save ${item.cheaper_alternative?.percentage_savings.toFixed(2)}%)`);
    });
  }
  
  // Debug for all items
  console.log("All receipt items:");
  receiptData.items.forEach((item, index) => {
    console.log(`${index+1}. ${item.name} - Has alternative: ${item.cheaper_alternative ? "YES" : "NO"}`);
    if (receiptJSON && receiptJSON.items[index] && receiptJSON.items[index].cheaper_alternative) {
      console.log(`   Original JSON has alternative: ${JSON.stringify(receiptJSON.items[index].cheaper_alternative)}`);
    }
  });
  
  return (
    <div className={styles.receiptWrapper}>
      <div className={styles.receiptHero}>
        <h2 className={styles.receiptTitle}>
          Receipt Analysis <span className={styles.receiptHighlight}>Complete</span>
        </h2>
        
        {/* Direct alternatives display - will show regardless of component-level issues */}
        {itemsWithAlternatives.length > 0 && (
          <div style={{ 
            backgroundColor: '#e8f5e9', 
            padding: '15px', 
            borderRadius: '8px',
            marginBottom: '15px',
            color: '#2e7d32',
            textAlign: 'left',
            fontWeight: 'bold'
          }}>
            <div style={{ fontSize: '18px', marginBottom: '10px' }}>🔍 Found {itemsWithAlternatives.length} Cheaper Alternatives! Save ${totalSavings.toFixed(2)}</div>
            {itemsWithAlternatives.map((item, idx) => (
              <div key={idx} style={{ 
                marginBottom: '10px', 
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: idx < itemsWithAlternatives.length - 1 ? '1px dashed #a5d6a7' : 'none',
                paddingBottom: '8px'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                  <div style={{ color: '#43a047' }}>
                    Instead buy: {item.cheaper_alternative?.item_name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ textDecoration: 'line-through' }}>${item.price}</div>
                  <div style={{ fontWeight: 'bold', color: '#43a047' }}>
                    ${item.cheaper_alternative?.price.toFixed(2)} ({item.cheaper_alternative?.percentage_savings.toFixed(0)}% off)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className={styles.receipt}>
          <div className={styles.receiptStore}>{receiptData.store}</div>
          {receiptData.address && (
            <div className={styles.receiptAddress}>{receiptData.address}</div>
          )}
          {receiptData.phone && (
            <div className={styles.receiptAddress}>{receiptData.phone}</div>
          )}
          <div className={styles.receiptDivider}></div>
          {receiptData.date && (
            <div className={styles.receiptDate}>{receiptData.date}</div>
          )}
          
          {/* Savings Summary */}
          {itemsWithAlternatives.length > 0 && (
            <>
              <div className={styles.receiptDivider}></div>
              <div className={styles.savingsSummary}>
                <div>
                  <i className="fa-solid fa-piggy-bank" aria-hidden="true"></i>
                  <span className={styles.savingsText}>Found {itemsWithAlternatives.length} cheaper alternatives!</span>
                </div>
                <span className={styles.savingsAmount}>Save ${totalSavings.toFixed(2)}</span>
              </div>
            </>
          )}
          
          <div className={styles.receiptDivider}></div>

          {receiptData.items && receiptData.items.length > 0 ? (
            <>
              <div className={styles.receiptSectionHeader}>Items</div>
              {receiptData.items.map((item) => (
                <div key={item.id} className={`${styles.receiptItem} ${item.cheaper_alternative ? styles.receiptItemSavings : ''}`}>
                  <div className={styles.receiptItemMain}>
                    <div className={styles.receiptNumber}>{item.id}</div>
                    <div className={styles.receiptName}>
                      {item.name}
                      {receiptJSON && 
                       receiptJSON.items && 
                       parseInt(item.id) > 0 &&
                       receiptJSON.items[parseInt(item.id) - 1] && 
                       receiptJSON.items[parseInt(item.id) - 1].quantity > 1 && (
                        <span className={styles.receiptQuantity}>
                          x{receiptJSON.items[parseInt(item.id) - 1].quantity}
                        </span>
                      )}
                    </div>
                    <div className={`${styles.receiptPrice} ${item.cheaper_alternative ? styles.receiptPriceStrike : ''}`}>
                      {item.price}
                    </div>
                  </div>
                  
                  {item.cheaper_alternative && (
                    <div className={styles.savingsRow}>
                      <div className={styles.receiptNumber}>
                        <i className={`fa-solid ${item.cheaper_alternative.is_temporal ? 'fa-clock-rotate-left' : 'fa-piggy-bank'}`} aria-hidden="true"></i>
                      </div>
                      <div className={styles.savingsInfo}>
                        {item.cheaper_alternative.is_temporal ? (
                          <span>Better price {item.cheaper_alternative.days_ago} days ago</span>
                        ) : (
                          <span>{item.cheaper_alternative.item_name || `Better price at ${item.cheaper_alternative.store_name}`}</span>
                        )}
                        <span className={styles.savingsPercent}>
                          Save {(item.cheaper_alternative.percentage_savings || 0).toFixed(0)}%
                        </span>
                      </div>
                      <span className={styles.savingsPrice}>
                        ${(typeof item.cheaper_alternative.price === 'number' ? item.cheaper_alternative.price : parseFloat(String(item.cheaper_alternative.price))).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Display discounts if available */}
              {receiptJSON && receiptJSON.items && receiptJSON.items.some(item => 
                item.discounts && item.discounts.length > 0 && 
                item.discounts.some(d => d.amount > 0)
              ) && (
                <>
                  <div className={styles.receiptSectionHeader}>Discounts</div>
                  {receiptJSON.items.map((item, index) => 
                    item.discounts && item.discounts.map((discount, discountIndex) => 
                      discount.amount > 0 && (
                        <div key={`${index}-${discountIndex}`} className={styles.receiptItem}>
                          <div className={styles.receiptNumber}></div>
                          <div className={styles.receiptName}>{item.name} - {discount.type || 'Discount'}</div>
                          <div className={styles.receiptPrice}>-${(discount.amount || 0).toFixed(2)}</div>
                        </div>
                      )
                    )
                  )}
                </>
              )}
            </>
          ) : (
            <div className={styles.receiptItem}>
              <div className={styles.receiptName}>No items found in receipt</div>
            </div>
          )}

          <div className={styles.receiptDivider}></div>
          
          <div className={styles.receiptSectionHeader}>Summary</div>
          
          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Subtotal</div>
            <div className={styles.receiptPrice}>{receiptData.totals.subtotal}</div>
          </div>

          {receiptData.taxes && receiptData.taxes.length > 0 ? (
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
          
          {receiptJSON && receiptJSON.financial_summary && receiptJSON.financial_summary.total_discounts > 0 && (
            <div className={styles.receiptItem}>
              <div className={styles.receiptName}>Total Discounts</div>
              <div className={styles.receiptPrice}>-${receiptJSON.financial_summary.total_discounts.toFixed(2)}</div>
            </div>
          )}

          <div className={styles.receiptDivider}></div>

          <div className={styles.receiptItem}>
            <div className={styles.receiptName}>Total</div>
            <div className={styles.receiptPrice}><strong>{receiptData.totals.total}</strong></div>
          </div>
          
          {receiptData.payment && (
            <div className={styles.receiptItem}>
              <div className={styles.receiptName}>Payment Method</div>
              <div className={styles.receiptPrice}>{receiptData.payment}</div>
            </div>
          )}
          
          {receiptJSON && receiptJSON.financial_summary && receiptJSON.financial_summary.change_given > 0 && (
            <div className={styles.receiptItem}>
              <div className={styles.receiptName}>Change Given</div>
              <div className={styles.receiptPrice}>${receiptJSON.financial_summary.change_given.toFixed(2)}</div>
            </div>
          )}
          
          {/* Savings Section */}
          {receiptJSON && receiptJSON.savings_summary && (
            (receiptJSON.savings_summary.total_savings > 0 || 
             receiptJSON.savings_summary.store_savings > 0 || 
             receiptJSON.savings_summary.membership_savings > 0) && (
            <>
              <div className={styles.receiptDivider}></div>
              <div className={styles.receiptSectionHeader}>Savings</div>
              
              {receiptJSON.savings_summary.store_savings > 0 && (
                <div className={styles.receiptItem}>
                  <div className={styles.receiptName}>Store Savings</div>
                  <div className={styles.receiptPrice}>${receiptJSON.savings_summary.store_savings.toFixed(2)}</div>
                </div>
              )}
              
              {receiptJSON.savings_summary.membership_savings > 0 && (
                <div className={styles.receiptItem}>
                  <div className={styles.receiptName}>Membership Savings</div>
                  <div className={styles.receiptPrice}>${receiptJSON.savings_summary.membership_savings.toFixed(2)}</div>
                </div>
              )}
              
              {receiptJSON.savings_summary.total_savings > 0 && (
                <div className={styles.receiptItem}>
                  <div className={styles.receiptName}>Total Savings</div>
                  <div className={styles.receiptPrice}>${receiptJSON.savings_summary.total_savings.toFixed(2)}</div>
                </div>
              )}
              
              {receiptJSON.savings_summary.savings_percentage && receiptJSON.savings_summary.savings_percentage !== "0%" && (
                <div className={styles.receiptItem}>
                  <div className={styles.receiptName}>You Saved</div>
                  <div className={styles.receiptPrice}>{receiptJSON.savings_summary.savings_percentage}</div>
                </div>
              )}
            </>
          ))}
          
          {/* Points Section */}
          {receiptJSON && receiptJSON.points_summary && (
            (receiptJSON.points_summary.earned > 0 || 
             receiptJSON.points_summary.available > 0 ||
             receiptJSON.points_summary.expiring_date) && (
            <>
              <div className={styles.receiptDivider}></div>
              <div className={styles.receiptSectionHeader}>Rewards Points</div>
              
              {receiptJSON.points_summary.earned > 0 && (
                <div className={styles.receiptItem}>
                  <div className={styles.receiptName}>Points Earned</div>
                  <div className={styles.receiptPrice}>{receiptJSON.points_summary.earned}</div>
                </div>
              )}
              
              {receiptJSON.points_summary.available > 0 && (
                <div className={styles.receiptItem}>
                  <div className={styles.receiptName}>Points Available</div>
                  <div className={styles.receiptPrice}>{receiptJSON.points_summary.available}</div>
                </div>
              )}
              
              {receiptJSON.points_summary.expiring_date && (
                <div className={styles.receiptItem}>
                  <div className={styles.receiptName}>Points Expiring</div>
                  <div className={styles.receiptPrice}>{receiptJSON.points_summary.expiring_date}</div>
                </div>
              )}
            </>
          ))}
          
          {/* Return Policy */}
          {receiptJSON && receiptJSON.return_policy && receiptJSON.return_policy.return_window_days > 0 && (
            <>
              <div className={styles.receiptDivider}></div>
              <div className={styles.receiptSectionHeader}>Return Policy</div>
              
              <div className={styles.receiptItem}>
                <div className={styles.receiptName}>Return Window</div>
                <div className={styles.receiptPrice}>{receiptJSON.return_policy.return_window_days} days</div>
              </div>
              
              {receiptJSON.return_policy.proof_of_purchase_required && (
                <div className={styles.receiptItem}>
                  <div className={styles.receiptName}>Receipt Required</div>
                  <div className={styles.receiptPrice}>Yes</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 