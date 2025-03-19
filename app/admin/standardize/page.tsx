'use client';

import { useState } from 'react';
import styles from './standardize.module.css';

export default function StandardizePage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  const handleStandardize = async () => {
    if (!apiKey) {
      setError('API key is required');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/standardize-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to standardize items');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Item Standardization</h1>
      <p className={styles.description}>
        This tool uses GPT to standardize item names in the database. It processes items that don't have a standardized name yet.
      </p>

      <div className={styles.apiKeyInput}>
        <label htmlFor="apiKey">API Key:</label>
        <input
          type="password"
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          className={styles.input}
        />
      </div>

      <button
        onClick={handleStandardize}
        disabled={isProcessing}
        className={styles.button}
      >
        {isProcessing ? 'Processing...' : 'Standardize Items'}
      </button>

      {error && (
        <div className={styles.error}>
          <p>Error: {error}</p>
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <h2>Result</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      <div className={styles.infoBox}>
        <h3>How It Works</h3>
        <ol>
          <li>The system fetches items without standardized names from the database</li>
          <li>It sends these items to GPT for standardization</li>
          <li>The standardized names are saved back to the database</li>
          <li>Standardization mappings are added to the item_standardization table</li>
          <li>Categories are automatically assigned based on the standardized names</li>
        </ol>
        <p>This process runs automatically every day at 3 AM, but you can also trigger it manually here.</p>
      </div>
    </div>
  );
} 