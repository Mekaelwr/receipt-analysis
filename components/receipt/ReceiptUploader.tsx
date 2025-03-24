'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import styles from './receipt.module.css';
import { ReceiptAnalysis } from './ReceiptAnalysis';

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
        console.error("Error saving receipt:", errorData);
        return receiptJSON;
      }
      
      // Get the API response with alternatives
      const data = await response.json();
      console.log("⭐ API RESPONSE RECEIVED:", data);
      
      // Log what we received from the server
      if (data.items && Array.isArray(data.items)) {
        console.log(`⭐ Received ${data.items.length} items from API`);
        console.log(`⭐ ${data.items_with_alternatives} of them have alternatives`);
        
        // Check if we have alternatives in the response
        const serverItemsWithAlts = data.items.filter((item: any) => item.cheaper_alternative);
        console.log(`⭐ Found ${serverItemsWithAlts.length} items with alternatives in response`);
        
        serverItemsWithAlts.forEach((item: any) => {
          console.log(`⭐ Server item ${item.name || item.original_item_name} has alternative:`, item.cheaper_alternative);
        });
        
        // CRITICAL FIX: Create a new receiptJSON object with the alternatives from the server
        const updatedReceiptJSON = {
          ...receiptJSON,
          items: receiptJSON.items.map((item, index) => {
            // Find the matching item from server response
            const matchingServerItem = data.items.find((serverItem: any) => 
              (serverItem.name && item.name && serverItem.name.includes(item.name)) ||
              (serverItem.original_item_name && item.name && serverItem.original_item_name.includes(item.name)) ||
              (item.name && serverItem.name && item.name.includes(serverItem.name)) ||
              false
            );
            
            // If we found a match and it has an alternative, add it to our item
            if (matchingServerItem && matchingServerItem.cheaper_alternative) {
              console.log(`✅ Adding alternative for ${item.name}: ${matchingServerItem.cheaper_alternative.item_name}`);
              
              // Make sure all properties are properly formatted as numbers
              const cleanAlternative = {
                store_name: matchingServerItem.cheaper_alternative.store_name || "Unknown Store",
                item_name: matchingServerItem.cheaper_alternative.item_name || "Alternative Product",
                price: typeof matchingServerItem.cheaper_alternative.price === 'string' 
                  ? parseFloat(matchingServerItem.cheaper_alternative.price) 
                  : Number(matchingServerItem.cheaper_alternative.price) || 0,
                savings: typeof matchingServerItem.cheaper_alternative.savings === 'string' 
                  ? parseFloat(matchingServerItem.cheaper_alternative.savings) 
                  : Number(matchingServerItem.cheaper_alternative.savings) || 0,
                percentage_savings: typeof matchingServerItem.cheaper_alternative.percentage_savings === 'string' 
                  ? parseFloat(matchingServerItem.cheaper_alternative.percentage_savings) 
                  : Number(matchingServerItem.cheaper_alternative.percentage_savings) || 0
              };
              
              return {
                ...item,
                cheaper_alternative: cleanAlternative
              };
            }
            
            return item;
          })
        } as ReceiptJSON;
        
        // Final verification
        const finalItemsWithAlts = updatedReceiptJSON.items.filter(item => item.cheaper_alternative);
        console.log(`🔍 FINAL CHECK: ${finalItemsWithAlts.length} items have alternatives in the updated receiptJSON`);
        
        if (finalItemsWithAlts.length > 0) {
          finalItemsWithAlts.forEach((item, i) => {
            console.log(`📋 Final item ${i+1}: ${item.name} has alternative: ${item.cheaper_alternative?.item_name} at $${item.cheaper_alternative?.price} (${item.cheaper_alternative?.percentage_savings}% savings)`);
          });
        }
        
        return updatedReceiptJSON;
      }
      
      return receiptJSON;
    } catch (error) {
      console.error("Error saving receipt to Supabase:", error);
      return receiptJSON;
    }
  };

  return (
    <div className={styles.receiptUploaderContainer}>
      {/* Test button for development */}
      <div className={styles.testButtonContainer}>
        <button 
          className={styles.testButton}
          onClick={async () => {
            setIsAnalyzing(true);
            try {
              const response = await fetch('/api/test-take-photo');
              if (!response.ok) {
                throw new Error('Test endpoint failed');
              }
              const data = await response.json();
              
              // Process the response to include alternatives in the receipt JSON
              const receiptWithAlternatives = data.receipt_json;
              
              // FORCE TEST ALTERNATIVES - This guarantees we can see if the UI properly displays them
              // Create sample alternatives for 3 different items
              const forceAlternatives = [
                { 
                  name: "SIG HONEY MUSTARD", 
                  alternative: {
                    store_name: "Whole Foods",
                    price: 2.49,
                    item_name: "365 Organic Honey Mustard",
                    savings: 0.80,
                    percentage_savings: 24.32
                  }
                },
                {
                  name: "SIMPLY 2 PF 52Z",
                  alternative: {
                    store_name: "Target",
                    price: 3.69,
                    item_name: "Not From Concentrate OJ No Pulp",
                    savings: 1.30,
                    percentage_savings: 26.05
                  }
                },
                {
                  name: "RANA TAKE HOME",
                  alternative: {
                    store_name: "Trader Joe's",
                    price: 3.79,
                    item_name: "De Cecco Pasta 16 oz",
                    savings: 9.20,
                    percentage_savings: 70.82
                  }
                }
              ];
              
              // Only use if we don't already have alternatives
              if (!receiptWithAlternatives.items.some((item: any) => item.cheaper_alternative)) {
                console.log("✅ FORCING TEST ALTERNATIVES FOR DISPLAY TESTING");
                // Apply forced alternatives to receipt items
                receiptWithAlternatives.items = receiptWithAlternatives.items.map((item: any) => {
                  const testAlt = forceAlternatives.find(a => item.name.includes(a.name));
                  if (testAlt) {
                    console.log(`✅ Adding test alternative to ${item.name}`);
                    return { 
                      ...item, 
                      cheaper_alternative: testAlt.alternative 
                    };
                  }
                  return item;
                });
              }
              
              // Log the processed receipt data
              console.log("Test receipt with alternatives:", receiptWithAlternatives);
              
              // Count items with alternatives for verification
              const altItemCount = receiptWithAlternatives.items.filter((item: any) => item.cheaper_alternative).length;
              const totalSavings = receiptWithAlternatives.items.reduce((sum: number, item: any) => {
                if (!item.cheaper_alternative) return sum;
                return sum + (item.cheaper_alternative.savings || 0);
              }, 0);
              
              console.log(`✅ Final check: Found ${altItemCount} items with alternatives, total savings: $${totalSavings.toFixed(2)}`);
              
              setAnalysisText(data.analysis);
              setReceiptJSON(receiptWithAlternatives);
              setShowPreview(false);
            } catch (error) {
              console.error('Error testing receipt:', error);
              setAnalysisError(error instanceof Error ? error.message : 'Test failed');
            } finally {
              setIsAnalyzing(false);
            }
          }}
        >
          Load Test Receipt
        </button>
      </div>
      
      <div className={styles.uploaderHero}>
        {/* Hidden canvas for image processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {!analysisText ? (
          <div className={styles.receiptWrapper}>
            <div className={styles.receiptHero}>
              <h2 className={styles.receiptTitle}>
                Ready to capture your<br />receipt and start<br />saving <span className={styles.receiptHighlight}>money?</span>
              </h2>
              
              <div className={styles.preprocessingOption}>
                <label>
                  <input
                    type="checkbox"
                    checked={usePreprocessing}
                    onChange={() => setUsePreprocessing(!usePreprocessing)}
                  />
                  <span>Enhance image for better text recognition</span>
                </label>
              </div>
              
              <label htmlFor="receipt-upload" className={styles.uploadButton}>
                <i className="fa-solid fa-camera"></i>Take Photo
              </label>
              <input 
                id="receipt-upload" 
                type="file" 
                accept="image/*"
                capture
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
              
              {fileName && (
                <div className={styles.fileInfo}>
                  <p>Uploaded file: <strong>{fileName}</strong></p>
                </div>
              )}
              
              {isAnalyzing && (
                <div className={styles.uploadingIndicator}>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <p>Analyzing your receipt...</p>
                </div>
              )}
              
              {analysisError && (
                <div className={styles.errorMessage}>
                  <i className="fa-solid fa-exclamation-circle"></i>
                  <p>{analysisError}</p>
                </div>
              )}
              
              {previewUrl && showPreview && !isAnalyzing && (
                <div className={styles.imagePreview}>
                  {previewUrl && (
                    <Image 
                      src={previewUrl} 
                      alt="Receipt preview" 
                      width={300}
                      height={400}
                      style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Use the ReceiptAnalysis component with the JSON data */}
            <ReceiptAnalysis analysisText={analysisText} receiptJSON={receiptJSON || undefined} />
            
            <div className={styles.actionButtons}>
              <button 
                className={styles.resetButton}
                onClick={() => {
                  setFileName(null);
                  setPreviewUrl(null);
                  setAnalysisText(null);
                  setReceiptJSON(null);
                  setAnalysisError(null);
                }}
              >
                <i className="fa-solid fa-arrow-left"></i> Scan another receipt
              </button>
              
              <button 
                className={styles.viewImageButton}
                onClick={() => setShowPreview(!showPreview)}
              >
                <i className={`fa-solid ${showPreview ? 'fa-eye-slash' : 'fa-eye'}`}></i> 
                {showPreview ? 'Hide' : 'View'} Receipt Image
              </button>
              
              <button 
                className={styles.debugButton}
                onClick={() => setShowDebugInfo(!showDebugInfo)}
              >
                <i className={`fa-solid ${showDebugInfo ? 'fa-bug-slash' : 'fa-bug'}`}></i> 
                {showDebugInfo ? 'Hide' : 'Show'} Raw Analysis
              </button>
            </div>
            
            {previewUrl && showPreview && (
              <div className={styles.imagePreviewLarge}>
                {previewUrl && (
                  <Image 
                    src={previewUrl} 
                    alt="Receipt image" 
                    width={600}
                    height={800}
                    style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
                  />
                )}
              </div>
            )}
            
            {showDebugInfo && analysisText && (
              <div className={styles.rawAnalysis}>
                <h3>Raw GPT-4o-mini Analysis</h3>
                <pre>{analysisText}</pre>
                
                {receiptJSON && (
                  <>
                    <h3>Parsed JSON</h3>
                    <pre>{JSON.stringify(receiptJSON, null, 2)}</pre>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 