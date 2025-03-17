'use client';

import { useState, useRef } from 'react';
import styles from './receipt.module.css';

export function ReceiptUploader() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [usePreprocessing, setUsePreprocessing] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const preprocessImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!usePreprocessing) {
        resolve(file);
        return;
      }

      const img = new Image();
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
    setAnalysisError(null);
    
    // Start analyzing the receipt
    setIsAnalyzing(true);
    
    try {
      // Preprocess the image client-side
      const processedFile = await preprocessImage(file);
      
      const formData = new FormData();
      formData.append('image', processedFile);
      
      const response = await fetch('/api/analyze-receipt', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze receipt');
      }
      
      const data = await response.json();
      console.log("API response:", data);
      
      setAnalysisText(data.analysis);
      
      // Hide the preview once analysis is complete
      setShowPreview(false);
    } catch (error) {
      console.error('Error analyzing receipt:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze receipt');
    } finally {
      setIsAnalyzing(false);
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
                <img src={previewUrl} alt="Receipt preview" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.analysisResults}>
            <h3 className={styles.analysisTitle}>Receipt Analysis</h3>
            <div className={styles.analysisContent}>
              {analysisText.split('\n').map((line, index) => (
                <p key={index}>{line || <br />}</p>
              ))}
            </div>
          </div>
          
          <div className={styles.actionButtons}>
            <button 
              className={styles.resetButton}
              onClick={() => {
                setFileName(null);
                setPreviewUrl(null);
                setAnalysisText(null);
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
          </div>
          
          {previewUrl && showPreview && (
            <div className={styles.imagePreviewLarge}>
              <img src={previewUrl} alt="Receipt preview" />
            </div>
          )}
        </>
      )}
    </div>
  );
} 