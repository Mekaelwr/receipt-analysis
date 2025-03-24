'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPiggyBank, faReceipt } from '@fortawesome/free-solid-svg-icons';
import styles from './receipt-shared.module.css';
import { ReceiptDisplay } from './ReceiptDisplay';

// Define the receipt JSON structure
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

// Helper function to format receipt data
function formatReceiptData(json: ReceiptJSON) {
  return {
    store: json.store_information.name,
    address: json.store_information.address,
    date: `${json.purchase_details.date} at ${json.purchase_details.time}`,
    items: json.items.map((item, index) => ({
      id: index.toString(),
      name: item.name,
      price: `$${item.final_price.toFixed(2)}`,
      cheaper_alternative: item.cheaper_alternative
    })),
    totals: {
      subtotal: `$${json.financial_summary.subtotal.toFixed(2)}`,
      tax: `$${json.financial_summary.total_taxes.toFixed(2)}`,
      total: `$${json.financial_summary.total_amount.toFixed(2)}`
    },
    totalSavings: `$${json.savings_summary.total_savings.toFixed(2)}`
  };
}

export function ReceiptUploader() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [receiptJSON, setReceiptJSON] = useState<ReceiptJSON | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [usePreprocessing, setUsePreprocessing] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Debug effect - will run whenever receiptJSON changes
  useEffect(() => {
    if (receiptJSON) {
      console.log("🚨 FINAL PRE-RENDER CHECK");
      console.log("🧾 receiptJSON before rendering:", receiptJSON);
      
      const alternativeItems = receiptJSON.items.filter(item => item.cheaper_alternative);
      console.log(`🔎 Found ${alternativeItems.length} items with alternatives before rendering`);
      
      alternativeItems.forEach((item, idx) => {
        console.log(`📋 Item ${idx+1}: ${item.name} has alternative:`);
        console.dir(item.cheaper_alternative);
      });
    }
  }, [receiptJSON]);

  const preprocessImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (!usePreprocessing) {
        resolve(file);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = canvasRef.current;
          if (!canvas) {
            resolve(file);
            return;
          }

          // Set canvas dimensions to match image
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          
          // Draw original image
          ctx.drawImage(img, 0, 0);
          
          // Get image data for processing
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Apply basic preprocessing
          for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            
            // Increase contrast
            const contrast = 1.5; // Adjust as needed
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            const newValue = factor * (avg - 128) + 128;
            
            // Apply threshold for better text recognition
            const threshold = 150; // Adjust as needed
            const finalValue = newValue > threshold ? 255 : 0;
            
            data[i] = finalValue;     // R
            data[i + 1] = finalValue; // G
            data[i + 2] = finalValue; // B
            // Alpha remains unchanged
          }
          
          // Put processed image data back on canvas
          ctx.putImageData(imageData, 0, 0);
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            
            // Create new file from blob
            const processedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            
            resolve(processedFile);
          }, 'image/jpeg', 0.9);
        } catch (error) {
          console.error('Error preprocessing image:', error);
          resolve(file); // Fall back to original file
        }
      };
      
      img.onerror = () => {
        console.error('Error loading image');
        resolve(file); // Fall back to original file
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];
    
    // Create a preview URL for the image
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setFileName(file.name);
    setShowPreview(true);
    
    // Reset previous analysis
    setAnalysisText(null);
    setReceiptJSON(null);
    setAnalysisError(null);
    
    // Start analyzing the receipt
    setIsAnalyzing(true);
    
    try {
      // Preprocess the image client-side
      const processedFile = await preprocessImage(file);
      
      const formData = new FormData();
      formData.append('image', processedFile);
      
      console.log("Sending receipt image for analysis...");
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze receipt');
      }
      
      const data = await response.json();
      console.log("API response received:", data);
      
      // Store the raw analysis text
      setAnalysisText(data.analysis);
      
      // Check if we have receipt JSON data
      if (data.receipt_json) {
        console.log("Receipt JSON data:", JSON.stringify(data.receipt_json, null, 2));
        
        // Check if there was a parse error
        if (data.parse_error) {
          console.warn("Parse error occurred:", data.parse_error);
          console.warn("Using fallback parsed data");
        }
        
        // Validate the JSON structure
        const validJSON = validateReceiptJSON(data.receipt_json);
        if (validJSON) {
          // Don't update UI with receipt data yet
          // First save to Supabase and get alternatives
          const processedReceipt = await saveReceiptToSupabase(processedFile, data.receipt_json);
          
          // Now update UI with the processed receipt that includes alternatives
          setReceiptJSON(processedReceipt || data.receipt_json);
          
          // Debug: Verify the final receipt JSON contains alternatives
          const finalReceipt = processedReceipt || data.receipt_json;
          const finalAlternativesCount = finalReceipt.items?.filter((item: any) => item.cheaper_alternative).length || 0;
          console.log(`🧾 FINAL RECEIPT: Contains ${finalAlternativesCount} items with alternatives`);
          if (finalAlternativesCount > 0) {
            finalReceipt.items?.forEach((item: any, index: number) => {
              if (item.cheaper_alternative) {
                console.log(`✅ Item #${index+1} (${item.name}) has alternative: ${item.cheaper_alternative.item_name} at $${item.cheaper_alternative.price} (Save ${item.cheaper_alternative.percentage_savings}%)`);
              }
            });
          }
          
          // Hide the preview once analysis is complete
          setShowPreview(false);
        } else {
          console.error("Invalid receipt JSON structure");
          setAnalysisError("The receipt data structure is invalid. Please try again.");
        }
      } else {
        console.error("No receipt_json in response");
        setAnalysisError("No receipt data was returned. Please try again.");
      }
    } catch (error) {
      console.error('Error analyzing receipt:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze receipt');
    } finally {
      // Analysis is complete
      setIsAnalyzing(false);
    }
  };

  // Function to validate the receipt JSON structure
  const validateReceiptJSON = (json: Record<string, unknown>): boolean => {
    if (!json) return false;
    
    // Check for required top-level properties
    const requiredProps = [
      'store_information',
      'purchase_details',
      'items',
      'financial_summary'
    ];
    
    for (const prop of requiredProps) {
      if (!json[prop]) {
        console.error(`Missing required property: ${prop}`);
        return false;
      }
    }
    
    // Check if items is an array
    if (!Array.isArray((json as Record<string, unknown>).items)) {
      console.error('Items property is not an array');
      return false;
    }
    
    // Check if taxes is an array (if present)
    if ((json as Record<string, unknown>).taxes && !Array.isArray((json as Record<string, unknown>).taxes)) {
      console.error('Taxes property is not an array');
      return false;
    }
    
    return true;
  };

  // Function to save the receipt data to Supabase
  const saveReceiptToSupabase = async (imageFile: File, receiptJSON: ReceiptJSON): Promise<ReceiptJSON> => {
    try {
      console.log("Saving receipt data to Supabase...");
      
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('receiptData', JSON.stringify(receiptJSON));
      
      const response = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Unknown error occurred';
        console.error("Error saving receipt:", errorMessage);
        throw new Error(`Error saving receipt: ${errorMessage}`);
      }
      
      // Get the API response with alternatives
      const data = await response.json();
      
      if (!data || !data.success) {
        console.error("Invalid response format:", data);
        throw new Error('Invalid response from server');
      }
      
      // Update the receipt JSON with the processed data
      const processedReceipt = {
        ...receiptJSON,
        items: data.items || receiptJSON.items
      };
      
      console.log("Receipt saved successfully with alternatives");
      return processedReceipt;
      
    } catch (error) {
      console.error("Error in saveReceiptToSupabase:", error);
      throw error instanceof Error ? error : new Error('Failed to save receipt');
    }
  };

  return (
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

      {!receiptJSON && (
        <div className={styles.uploadSection}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="receipt-upload"
          />
          <label htmlFor="receipt-upload" className={styles.uploadButton}>
            {isAnalyzing ? 'Analyzing...' : 'Upload Receipt'}
          </label>
          
          {previewUrl && showPreview && (
            <div className={styles.previewContainer}>
              <Image
                src={previewUrl}
                alt="Receipt preview"
                width={300}
                height={400}
                style={{ objectFit: 'contain' }}
              />
            </div>
          )}
          
          {analysisError && (
            <div className={styles.error}>
              Error: {analysisError}
            </div>
          )}
        </div>
      )}

      {receiptJSON && (
        <ReceiptDisplay receipt={formatReceiptData(receiptJSON)} />
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
} 