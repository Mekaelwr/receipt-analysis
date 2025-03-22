'use client';

import { useState, useRef } from 'react';
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
          setReceiptJSON(data.receipt_json);
          
          // Save the receipt data to Supabase
          await saveReceiptToSupabase(processedFile, data.receipt_json);
        } else {
          console.error("Invalid receipt JSON structure");
          setAnalysisError("The receipt data structure is invalid. Please try again.");
        }
      } else {
        console.error("No receipt_json in response");
        setAnalysisError("No receipt data was returned. Please try again.");
      }
      
      // Hide the preview once analysis is complete
      setShowPreview(false);
    } catch (error) {
      console.error('Error analyzing receipt:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze receipt');
    } finally {
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
  const saveReceiptToSupabase = async (imageFile: File, receiptJSON: Record<string, unknown>) => {
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
        let errorMessage = `HTTP error! Status: ${response.status}`;
        
        try {
          // Try to parse error as JSON
          const errorData = await response.json();
          console.error("Error saving receipt:", errorData);
          
          // Add more specific error message if available
          if (errorData && errorData.error) {
            errorMessage += ` - ${errorData.error}`;
          }
        } catch (parseError) {
          // Handle case where response isn't valid JSON
          console.error("Error parsing response:", parseError);
          
          // Try to get error as text instead
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage += ` - ${errorText}`;
            }
          } catch (textError) {
            console.error("Could not read error response as text:", textError);
          }
        }
        
        console.error(errorMessage);
        // You could also set an error state here to display to the user
        return;
      }
      
      const data = await response.json();
      console.log("Receipt saved successfully:", data);
      
      // You can add a success message or redirect here if needed
      
    } catch (error) {
      console.error("Error saving receipt to Supabase:", error);
      // Continue execution - we've already analyzed the receipt
    }
  };

  return (
    <div className={styles.receiptUploaderContainer}>
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
  );
} 